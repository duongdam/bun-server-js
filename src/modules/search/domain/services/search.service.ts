import { ISearchRepository, SearchResultItem } from '../repositories/search.repository.interface';
import { SearchFilter } from '../value-objects/search-filter.vo';

export class SearchService {
  constructor(private readonly searchRepository: ISearchRepository) {}

  async semanticSearch(
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    return this.searchRepository.semanticSearch(queryVector, topK, threshold, filters);
  }

  async keywordSearch(
    queryText: string,
    topK: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    return this.searchRepository.keywordSearch(queryText, topK, filters);
  }

  async hybridSearch(
    queryText: string,
    queryVector: number[],
    topK: number,
    threshold: number,
    filters?: SearchFilter[],
  ): Promise<SearchResultItem[]> {
    return this.searchRepository.hybridSearch(queryText, queryVector, topK, threshold, filters);
  }
}
