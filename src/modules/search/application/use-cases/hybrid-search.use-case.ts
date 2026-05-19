import { SearchService } from '../../domain/services/search.service';
import { SearchRequestDto } from '../dtos/search-request.dto';
import { SearchResponseDto } from '../dtos/search-result.dto';
import { EmbeddingService } from '../../../embedding/domain/services/embedding.service';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import { SearchFilter } from '../../domain/value-objects/search-filter.vo';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class HybridSearchUseCase {
  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService
  ) {}

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

    // Embed the query
    const embeddings = await this.embeddingService.embedBatch([request.query]);
    const queryVector = embeddings[0];
    if (!queryVector) {
      throw new Error('Failed to embed search query');
    }

    // Perform hybrid search
    const results = await this.searchService.hybridSearch(
      request.query,
      queryVector,
      request.topK,
      request.similarityThreshold,
      searchFilters
    );

    const latencyMs = Date.now() - startTime;

    // Log to SearchHistory
    try {
      await prisma.searchHistory.create({
        data: {
          userId,
          query: request.query,
          searchType: 'HYBRID',
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
        similarityScore: r.similarityScore,
        rankScore: r.rankScore
      })),
      query: request.query,
      searchType: request.searchType,
      latencyMs
    };
  }
}
