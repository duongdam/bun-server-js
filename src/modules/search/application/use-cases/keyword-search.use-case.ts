import { SearchService } from '../../domain/services/search.service';
import { SearchRequestDto } from '../dtos/search-request.dto';
import { SearchResponseDto } from '../dtos/search-result.dto';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import { SearchFilter } from '../../domain/value-objects/search-filter.vo';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class KeywordSearchUseCase {
  constructor(private readonly searchService: SearchService) {}

  async execute(userId: string, request: SearchRequestDto): Promise<SearchResponseDto> {
    const startTime = Date.now();
    
    // Parse filters if provided
    let searchFilters: SearchFilter[] = [];
    if (request.filters) {
      searchFilters = Object.entries(request.filters).map(([field, value]) => {
        return SearchFilter.create({
          field,
          operator: 'eq',
          value
        });
      });
    }

    // Perform keyword search
    const results = await this.searchService.keywordSearch(
      request.query,
      request.topK,
      searchFilters
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
          filtersApplied: request.filters ?? {}
        }
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log search history');
    }

    return {
      results: results.map(r => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        filename: r.filename,
        content: r.content,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        rankScore: r.rankScore
      })),
      query: request.query,
      searchType: request.searchType,
      latencyMs
    };
  }
}
