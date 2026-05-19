import type { SearchFilter } from '../value-objects/search-filter.vo';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  tokenCount: number;
  similarityScore?: number;
  rankScore?: number;
}

export interface ISearchRepository {
  semanticSearch(
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]>;

  keywordSearch(
    queryText: string,
    topK: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]>;

  hybridSearch(
    queryText: string,
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]>;
}
