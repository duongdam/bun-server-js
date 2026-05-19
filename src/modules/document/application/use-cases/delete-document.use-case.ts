import { NotFoundError } from '../../../../shared/middleware/error-handler.middleware';
import { activityLogService } from '../../../activity-log/domain/services/activity-log.service';
import type { IDocumentRepository } from '../../domain/repositories/document.repository.interface';

export class DeleteDocumentUseCase {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(userId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', documentId);
    }

    // Prisma schema has onDelete: Cascade for DocumentChunks and Embeddings
    await this.documentRepository.delete(documentId);

    await activityLogService.record({
      userId,
      domain: 'DOCUMENT',
      entityId: documentId,
      action: 'DELETED',
      message: 'document.deleted',
      metadata: { filename: doc.filename },
    });
  }
}
