import { TextEncoder } from 'node:util';
import { SearchType } from '@prisma/client';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import type { EmbeddingService } from '../../../embedding/domain/services/embedding.service';
import type { SearchResultItem } from '../../domain/repositories/search.repository.interface';
import type { SearchService } from '../../domain/services/search.service';
import type { SearchRequestDto } from '../dtos/search-request.dto';
import {
  formatSearchResultsMarkdown,
  searchResultsToMarkdownHits,
} from '../format-search-markdown';
import { parseSearchFilters } from '../parse-search-filters';

function searchHistoryType(request: SearchRequestDto): SearchType {
  switch (request.searchType) {
    case 'hybrid':
      return SearchType.HYBRID;
    case 'keyword':
      return SearchType.KEYWORD;
    default:
      return SearchType.SEMANTIC;
  }
}

function formatContextForPrompt(results: SearchResultItem[], topK: number): string {
  return results
    .slice(0, Math.min(results.length, topK))
    .map((r, i) => `[${i + 1}] ${r.filename} (document ${r.documentId}):\n${r.content}`)
    .join('\n\n');
}

function mapResultsForMeta(results: SearchResultItem[]) {
  return searchResultsToMarkdownHits(results);
}

async function runVectorOrKeywordSearch(
  embeddingService: EmbeddingService,
  searchService: SearchService,
  userId: string,
  request: SearchRequestDto,
): Promise<SearchResultItem[]> {
  const searchFilters = parseSearchFilters(userId, request.filters);
  /** Same as non-streaming search / RAG: `RETRIEVAL_QUERY` pairs with chunk embeddings (`RETRIEVAL_DOCUMENT`). */
  const embedOpts = { purpose: 'query' as const };

  if (request.searchType === 'semantic') {
    const embeddings = await embeddingService.embedBatch([request.query], embedOpts);
    const queryVector = embeddings[0];
    if (!queryVector) {
      throw new Error('Failed to embed search query');
    }
    return searchService.semanticSearch(
      queryVector,
      request.topK,
      request.similarityThreshold,
      searchFilters,
    );
  }

  if (request.searchType === 'hybrid') {
    const embeddings = await embeddingService.embedBatch([request.query], embedOpts);
    const queryVector = embeddings[0];
    if (!queryVector) {
      throw new Error('Failed to embed search query');
    }
    return searchService.hybridSearch(
      request.query,
      queryVector,
      request.topK,
      request.similarityThreshold,
      searchFilters,
    );
  }

  return searchService.keywordSearch(request.query, request.topK, searchFilters);
}

async function appendGeminiAnswerStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  writeSse: (event: string, data: unknown) => Uint8Array,
  request: SearchRequestDto,
  results: SearchResultItem[],
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    controller.enqueue(
      writeSse('error', { message: 'GEMINI_API_KEY is required for streaming answers' }),
    );
    return;
  }

  const chatModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const contextBlock = formatContextForPrompt(results, request.topK);
  const prompt = `You are a helpful assistant. Answer the user's question using ONLY the following retrieved passages. If the passages are not enough to answer, say what is missing. Cite passage numbers [n] when you use them.

Formatting (required):
- Write the entire answer in valid **CommonMark / GitHub Flavored Markdown** only.
- Use \`##\` / \`###\` headings, bullet or numbered lists, **bold** / *italic*, and \`inline code\` where useful.
- Put verbatim quotes from passages in fenced code blocks with language \`text\`.
- Do not output raw HTML.

Passages:
${contextBlock}

Question: ${request.query}

Answer (Markdown only):`;

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: chatModel });
  const { stream } = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  for await (const chunk of stream) {
    try {
      const text = typeof chunk.text === 'function' ? chunk.text() : '';
      if (text) {
        controller.enqueue(writeSse('delta', { text }));
      }
    } catch {
      // ignore malformed stream chunks
    }
  }
}

async function logSearchHistoryStreaming(
  userId: string,
  request: SearchRequestDto,
  resultCount: number,
  started: number,
): Promise<void> {
  try {
    await prisma.searchHistory.create({
      data: {
        userId,
        query: request.query,
        searchType: searchHistoryType(request),
        topK: request.topK,
        resultCount,
        latencyMs: Date.now() - started,
        filtersApplied: request.filters ?? {},
      },
    });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to log search history (streaming)');
  }
}

async function runStreamingSession(
  controller: ReadableStreamDefaultController<Uint8Array>,
  writeSse: (event: string, data: unknown) => Uint8Array,
  embeddingService: EmbeddingService,
  searchService: SearchService,
  userId: string,
  request: SearchRequestDto,
): Promise<void> {
  const started = Date.now();
  const results = await runVectorOrKeywordSearch(embeddingService, searchService, userId, request);
  const latencyMs = Date.now() - started;

  const metaResults = mapResultsForMeta(results);
  controller.enqueue(
    writeSse('meta', {
      query: request.query,
      searchType: request.searchType,
      latencyMs,
      results: metaResults,
      markdown: formatSearchResultsMarkdown(request.query, request.searchType, metaResults),
    }),
  );

  if (results.length === 0) {
    controller.enqueue(
      writeSse('delta', {
        text: '## No passages retrieved\n\nSearch returned **no chunks** for this query with the current filters and `similarityThreshold`. Try lowering the threshold, using hybrid/keyword search, or confirm the document finished processing and embedding.',
      }),
    );
    return;
  }

  await appendGeminiAnswerStream(controller, writeSse, request, results);
  controller.enqueue(writeSse('done', {}));
  await logSearchHistoryStreaming(userId, request, results.length, started);
}

/**
 * Server-Sent Events search: retrieves chunks (semantic / hybrid / keyword), then streams a Gemini answer.
 * Query embeddings use the same options as JSON search / RAG (`purpose: 'query'`) so they align with stored chunk vectors.
 */
export class StreamingSearchUseCase {
  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  execute(userId: string, request: SearchRequestDto): Response {
    const encoder = new TextEncoder();
    const writeSse = (event: string, data: unknown) =>
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const { searchService, embeddingService } = this;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            await runStreamingSession(
              controller,
              writeSse,
              embeddingService,
              searchService,
              userId,
              request,
            );
          } catch (error: unknown) {
            logger.error({ error }, 'Streaming search failed');
            const message = error instanceof Error ? error.message : 'Streaming search failed';
            try {
              controller.enqueue(writeSse('error', { message }));
            } catch {
              // stream may already be closed
            }
          } finally {
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }
}
