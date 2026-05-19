import type { DocumentStatus } from '@prisma/client';
import type {
  IBaseRepository,
  PaginatedResult,
} from '../../../../shared/domain/base.repository.interface';
import type { Document } from '../entities/document.entity';

export interface IDocumentRepository extends IBaseRepository<Document> {
  findByUserId(
    userId: string,
    page: number,
    limit: number,
    status?: DocumentStatus,
    tags?: string[],
  ): Promise<PaginatedResult<Document>>;
  findByContentHash(userId: string, contentHash: string): Promise<Document | null>;
  updateStatus(id: string, status: DocumentStatus): Promise<void>;
}
