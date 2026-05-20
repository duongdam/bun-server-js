import { SearchType } from '@prisma/client';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import { prisma } from '../../../../shared/infrastructure/prisma/client';

import type { EmbeddingService } from '../../../embedding/domain/services/embedding.service';
import type { SearchService } from '../../domain/services/search.service';
import type { RetrievalRequestDto } from '../dtos/retrieval-request.dto';
import type { RetrievalResponseDto } from '../dtos/retrieval-response.dto';
import { type RagContextLine, formatRagRetrievalMarkdown } from '../format-search-markdown';
import { parseSearchFilters } from '../parse-search-filters';

export class RagRetrievalUseCase {
  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(userId: string, request: RetrievalRequestDto): Promise<RetrievalResponseDto> {
    const startTime = Date.now();

    const searchFilters = parseSearchFilters(userId, request.filters);

    // Embed the query
    const embeddings = await this.embeddingService.embedBatch([request.query], {
      purpose: 'query',
    });
    const queryVector = embeddings[0];
    if (!queryVector) {
      throw new Error('Failed to embed retrieval query');
    }

    // Perform semantic search
    // We request topK * 2 from the DB to have a larger pool to pack into the token budget
    const results = await this.searchService.semanticSearch(
      queryVector,
      request.topK * 2,
      request.similarityThreshold,
      searchFilters,
    );

    let currentTokens = 0;
    const context: RagContextLine[] = [];
    const sourceIds = new Set<string>();

    for (const result of results) {
      if (currentTokens + result.tokenCount > request.maxTokens) {
        // Stop packing if this chunk exceeds the maxTokens budget
        // We could selectively pack smaller chunks, but greedy sequential packing
        // preserves the most relevant chunks first since results are ranked.
        continue;
      }

      currentTokens += result.tokenCount;
      sourceIds.add(result.documentId);

      const source: RagContextLine['source'] = {
        documentId: result.documentId,
        filename: result.filename,
        chunkIndex: result.chunkIndex,
      };
      if (result.pageNumber !== undefined) {
        source.pageNumber = result.pageNumber;
      }

      context.push({
        text: result.content,
        score: result.similarityScore ?? 0,
        source,
      });

      if (context.length >= request.topK) {
        break; // Reached requested Top K count
      }
    }

    const latencyMs = Date.now() - startTime;

    // Log to SearchHistory
    try {
      await prisma.searchHistory.create({
        data: {
          userId,
          query: request.query,
          searchType: SearchType.RAG,
          topK: request.topK,
          resultCount: results.length,
          latencyMs,
          filtersApplied: request.filters ?? {},
        },
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to log search history');
    }

    return {
      context,
      markdown: formatRagRetrievalMarkdown(
        request.query,
        context,
        currentTokens,
        Array.from(sourceIds),
      ),
      totalTokens: currentTokens,
      sources: Array.from(sourceIds),
      query: request.query,
      latencyMs,
    };
  }
}
