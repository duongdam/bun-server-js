import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import type { EmbeddingService } from '../../../embedding/domain/services/embedding.service';
import type { SearchService } from '../../domain/services/search.service';
import type { SearchRequestDto } from '../dtos/search-request.dto';
import type { SearchResponseDto } from '../dtos/search-result.dto';
import {
  formatSearchResultsMarkdown,
  searchResultsToMarkdownHits,
} from '../format-search-markdown';
import { parseSearchFilters } from '../parse-search-filters';

export class SemanticSearchUseCase {
  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(userId: string, request: SearchRequestDto): Promise<SearchResponseDto> {
    const startTime = Date.now();

    const searchFilters = parseSearchFilters(userId, request.filters);

    // Embed the query
    const embeddings = await this.embeddingService.embedBatch([request.query], {
      purpose: 'query',
    });
    const queryVector = embeddings[0];
    if (!queryVector) {
      throw new Error('Failed to embed search query');
    }

    // Perform search
    const results = await this.searchService.semanticSearch(
      queryVector,
      request.topK,
      request.similarityThreshold,
      searchFilters,
    );

    const latencyMs = Date.now() - startTime;

    // Log to SearchHistory
    try {
      await prisma.searchHistory.create({
        data: {
          userId,
          query: request.query,
          searchType: 'SEMANTIC',
          topK: request.topK,
          resultCount: results.length,
          latencyMs,
          filtersApplied: request.filters ?? {},
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log search history');
    }

    const resultDtos = results.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      filename: r.filename,
      content: r.content,
      pageNumber: r.pageNumber,
      chunkIndex: r.chunkIndex,
      similarityScore: r.similarityScore,
    }));

    return {
      results: resultDtos,
      markdown: formatSearchResultsMarkdown(
        request.query,
        request.searchType,
        searchResultsToMarkdownHits(results),
      ),
      query: request.query,
      searchType: request.searchType,
      latencyMs,
    };
  }
}
