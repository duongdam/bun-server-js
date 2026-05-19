import { SearchRequestDto, SearchRequestSchema } from '../application/dtos/search-request.dto';
import { SemanticSearchUseCase } from '../application/use-cases/semantic-search.use-case';
import { HybridSearchUseCase } from '../application/use-cases/hybrid-search.use-case';
import { KeywordSearchUseCase } from '../application/use-cases/keyword-search.use-case';
import { RagRetrievalUseCase } from '../application/use-cases/rag-retrieval.use-case';
import { RetrievalRequestDto, RetrievalRequestSchema } from '../application/dtos/retrieval-request.dto';
import { SearchService } from '../domain/services/search.service';
import { PgVectorSearchRepository } from '../infrastructure/pgvector-search.repository';
import { EmbeddingService } from '../../embedding/domain/services/embedding.service';
import { logger } from '../../../shared/infrastructure/logger/pino.logger';
import { z } from 'zod';

export class SearchController {
  private semanticSearchUseCase: SemanticSearchUseCase;
  private hybridSearchUseCase: HybridSearchUseCase;
  private keywordSearchUseCase: KeywordSearchUseCase;
  private ragRetrievalUseCase: RagRetrievalUseCase;

  constructor() {
    const searchRepo = new PgVectorSearchRepository();
    const searchService = new SearchService(searchRepo);
    const embeddingService = new EmbeddingService();

    this.semanticSearchUseCase = new SemanticSearchUseCase(searchService, embeddingService);
    this.hybridSearchUseCase = new HybridSearchUseCase(searchService, embeddingService);
    this.keywordSearchUseCase = new KeywordSearchUseCase(searchService);
    this.ragRetrievalUseCase = new RagRetrievalUseCase(searchService, embeddingService);
  }

  async search(userId: string, body: unknown) {
    logger.info({ userId, body }, 'Search request received');
    
    let request: SearchRequestDto;
    try {
      request = SearchRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw Object.assign(new Error('Validation failed'), { code: 'VALIDATION', details: error.errors });
      }
      throw error;
    }

    switch (request.searchType) {
      case 'keyword':
        return this.keywordSearchUseCase.execute(userId, request);
      case 'hybrid':
        return this.hybridSearchUseCase.execute(userId, request);
      case 'semantic':
      default:
        return this.semanticSearchUseCase.execute(userId, request);
    }
  }

  async retrieve(userId: string, body: unknown) {
    logger.info({ userId, body }, 'Retrieval request received');
    
    let request: RetrievalRequestDto;
    try {
      request = RetrievalRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw Object.assign(new Error('Validation failed'), { code: 'VALIDATION', details: error.errors });
      }
      throw error;
    }

    return this.ragRetrievalUseCase.execute(userId, request);
  }
}
