import { describe, expect, mock, test } from 'bun:test';
import type { EmbeddingService } from '../../../src/modules/embedding/domain/services/embedding.service';
import { HybridSearchUseCase } from '../../../src/modules/search/application/use-cases/hybrid-search.use-case';
import { RagRetrievalUseCase } from '../../../src/modules/search/application/use-cases/rag-retrieval.use-case';
import { SemanticSearchUseCase } from '../../../src/modules/search/application/use-cases/semantic-search.use-case';
import type { SearchService } from '../../../src/modules/search/domain/services/search.service';

describe('Search use cases (query embedding)', () => {
  test('SemanticSearchUseCase embeds query then runs semantic search', async () => {
    const queryVector = [0.1, 0.2, 0.3];
    const embedBatch = mock(() => Promise.resolve([queryVector]));
    const embeddingService = { embedBatch } as unknown as EmbeddingService;
    const semanticSearch = mock(() =>
      Promise.resolve([
        {
          chunkId: '00000000-0000-4000-8000-000000000001',
          documentId: '00000000-0000-4000-8000-000000000002',
          filename: 'a.txt',
          content: 'hello',
          chunkIndex: 0,
          tokenCount: 1,
          similarityScore: 0.9,
        },
      ]),
    );
    const searchService = { semanticSearch } as unknown as SearchService;

    const uc = new SemanticSearchUseCase(searchService, embeddingService);
    const res = await uc.execute('user-1', {
      query: 'hello **world**',
      searchType: 'semantic',
      topK: 10,
      similarityThreshold: 0.3,
      streaming: false,
    });

    expect(embedBatch).toHaveBeenCalledWith(['hello **world**'], { purpose: 'query' });
    expect(semanticSearch).toHaveBeenCalledWith(queryVector, 10, 0.3, expect.any(Array));
    expect(res.query).toBe('hello **world**');
    expect(res.results).toHaveLength(1);
    expect(res.markdown).toContain('## Search results');
    expect(res.markdown).toContain('hello **world**');
  });

  test('HybridSearchUseCase embeds query then runs hybrid search', async () => {
    const queryVector = [0.5, 0.6];
    const embedBatch = mock(() => Promise.resolve([queryVector]));
    const embeddingService = { embedBatch } as unknown as EmbeddingService;
    const hybridSearch = mock(() =>
      Promise.resolve([
        {
          chunkId: '00000000-0000-4000-8000-000000000003',
          documentId: '00000000-0000-4000-8000-000000000004',
          filename: 'b.txt',
          content: 'world',
          chunkIndex: 0,
          tokenCount: 1,
          similarityScore: 0.8,
          rankScore: 0.85,
        },
      ]),
    );
    const searchService = { hybridSearch } as unknown as SearchService;

    const uc = new HybridSearchUseCase(searchService, embeddingService);
    const res = await uc.execute('user-1', {
      query: 'find me',
      searchType: 'hybrid',
      topK: 5,
      similarityThreshold: 0.2,
      streaming: false,
    });

    expect(embedBatch).toHaveBeenCalledWith(['find me'], { purpose: 'query' });
    expect(hybridSearch).toHaveBeenCalledWith('find me', queryVector, 5, 0.2, expect.any(Array));
    expect(res.query).toBe('find me');
    expect(res.results[0]?.rankScore).toBe(0.85);
    expect(res.markdown).toContain('## Search results');
  });

  test('RagRetrievalUseCase embeds query then runs semantic search for retrieval', async () => {
    const queryVector = [0.01, 0.02];
    const embedBatch = mock(() => Promise.resolve([queryVector]));
    const embeddingService = { embedBatch } as unknown as EmbeddingService;
    const semanticSearch = mock(() =>
      Promise.resolve([
        {
          chunkId: '00000000-0000-4000-8000-000000000005',
          documentId: '00000000-0000-4000-8000-000000000006',
          filename: 'c.txt',
          content: 'context chunk',
          chunkIndex: 0,
          tokenCount: 50,
          similarityScore: 0.95,
        },
      ]),
    );
    const searchService = { semanticSearch } as unknown as SearchService;

    const uc = new RagRetrievalUseCase(searchService, embeddingService);
    const res = await uc.execute('user-1', {
      query: 'rag question',
      topK: 3,
      maxTokens: 500,
      similarityThreshold: 0.1,
    });

    expect(embedBatch).toHaveBeenCalledWith(['rag question'], { purpose: 'query' });
    expect(semanticSearch).toHaveBeenCalledWith(queryVector, 6, 0.1, expect.any(Array));
    expect(res.query).toBe('rag question');
    expect(res.context.length).toBeGreaterThan(0);
    expect(res.markdown).toContain('## RAG retrieval');
  });
});
