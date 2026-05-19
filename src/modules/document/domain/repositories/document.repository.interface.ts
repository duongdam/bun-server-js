import { Document } from '../entities/document.entity';
import {
  IBaseRepository,
  PaginatedResult,
} from '../../../../shared/domain/base.repository.interface';
import { DocumentStatus } from '@prisma/client';

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
