/**
 * Generic repository interface following the Repository Pattern.
 * All domain repositories extend this interface.
 *
 * @typeParam T - The domain entity type
 */
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: FindAllOptions): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface FindAllOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
