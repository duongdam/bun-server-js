import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import type { SearchService } from '../../domain/services/search.service';
import { parseSearchFilters } from '../parse-search-filters';
import type { SearchRequestDto } from '../dtos/search-request.dto';
import type { SearchResponseDto } from '../dtos/search-result.dto';

export class KeywordSearchUseCase {
  constructor(private readonly searchService: SearchService) {}

  async execute(userId: string, request: SearchRequestDto): Promise<SearchResponseDto> {
    const startTime = Date.now();

    const searchFilters = parseSearchFilters(userId, request.filters);

    // Perform keyword search
    const results = await this.searchService.keywordSearch(
      request.query,
      request.topK,
      searchFilters,
    );

    const latencyMs = Date.now() - startTime;

    // Log to SearchHistory
    try {
      await prisma.searchHistory.create({
        data: {
          userId,
          query: request.query,
          searchType: 'KEYWORD',
          topK: request.topK,
          resultCount: results.length,
          latencyMs,
          filtersApplied: request.filters ?? {},
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log search history');
    }

    return {
      results: results.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        filename: r.filename,
        content: r.content,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        rankScore: r.rankScore,
      })),
      query: request.query,
      searchType: request.searchType,
      latencyMs,
    };
  }
}
