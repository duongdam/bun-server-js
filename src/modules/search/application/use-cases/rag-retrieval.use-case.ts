import { SearchService } from '../../domain/services/search.service';
import { RetrievalRequestDto } from '../dtos/retrieval-request.dto';
import { RetrievalResponseDto } from '../dtos/retrieval-response.dto';
import { EmbeddingService } from '../../../embedding/domain/services/embedding.service';
import { SearchFilter } from '../../domain/value-objects/search-filter.vo';

export class RagRetrievalUseCase {
  constructor(
    private readonly searchService: SearchService,
    private readonly embeddingService: EmbeddingService
  ) {}

  async execute(userId: string, request: RetrievalRequestDto): Promise<RetrievalResponseDto> {
    const startTime = Date.now();
    
    // Parse filters
    let searchFilters: SearchFilter[] = [];
    if (request.filters) {
      searchFilters = Object.entries(request.filters).map(([field, value]) => {
        return SearchFilter.create({ field, operator: 'eq', value });
      });
    }
    // Also enforce user scoping!
    searchFilters.push(SearchFilter.create({ field: 'userId', operator: 'eq', value: userId }));

    // Embed the query
    const embeddings = await this.embeddingService.embedBatch([request.query]);
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
      searchFilters
    );

    let currentTokens = 0;
    const context = [];
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
      
      context.push({
        text: result.content,
        score: result.similarityScore ?? 0,
        source: {
          documentId: result.documentId,
          filename: result.filename,
          pageNumber: result.pageNumber,
          chunkIndex: result.chunkIndex
        }
      });

      if (context.length >= request.topK) {
        break; // Reached requested Top K count
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      context,
      totalTokens: currentTokens,
      sources: Array.from(sourceIds),
      query: request.query,
      latencyMs
    };
  }
}
