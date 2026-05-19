import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { NotFoundError } from '../../../../shared/middleware/error-handler.middleware';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import { DocumentQueue } from '../../../job/infrastructure/bullmq.queue';

export interface ReindexDocumentParams {
  chunkingStrategy?: string | undefined;
  chunkSize?: number | undefined;
  chunkOverlap?: number | undefined;
  embeddingModel?: string | undefined;
  embeddingProvider?: string | undefined;
}

export class ReindexDocumentUseCase {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(userId: string, documentId: string, params: ReindexDocumentParams): Promise<void> {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', documentId);
    }

    // Use Prisma transaction to atomically delete old chunks, jobs, and reset document status
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing chunks for this document. 
      // Embeddings will be cascade deleted because of FK constraint on embeddings.chunkId
      await tx.documentChunk.deleteMany({
        where: { documentId }
      });

      // 2. Delete all previous jobs for this document
      await tx.aIProcessingJob.deleteMany({
        where: { documentId }
      });

      // 3. Update document settings and reset status
      await tx.document.update({
        where: { id: documentId },
        data: {
          chunkingStrategy: params.chunkingStrategy ?? doc.chunkingConfig.strategy,
          chunkSize: params.chunkSize ?? doc.chunkingConfig.chunkSize,
          chunkOverlap: params.chunkOverlap ?? doc.chunkingConfig.chunkOverlap,
          embeddingModel: params.embeddingModel ?? doc.embeddingModel,
          embeddingProvider: params.embeddingProvider ?? doc.embeddingProvider,
          status: 'PENDING',
          indexedAt: null
        }
      });
    });

    // 4. Enqueue a new processing job
    const queue = new DocumentQueue();
    await queue.addDocumentJob({ 
      documentId, 
      userId,
      jobId: `process-${documentId}-${Date.now()}`,
      filePath: `/tmp/upload_${documentId}_${doc.filename}`,
      mimeType: doc.mimeType
    });
  }
}
