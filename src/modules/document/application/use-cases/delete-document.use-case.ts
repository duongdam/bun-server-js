import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { NotFoundError } from '../../../../shared/middleware/error-handler.middleware';

export class DeleteDocumentUseCase {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(userId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', documentId);
    }

    // Prisma schema has onDelete: Cascade for DocumentChunks and Embeddings
    await this.documentRepository.delete(documentId);
  }
}
