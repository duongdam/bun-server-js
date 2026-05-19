import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../../../../shared/infrastructure/prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/middleware/error-handler.middleware';
import { activityLogService } from '../../../activity-log/domain/services/activity-log.service';
import { AIProcessingJob } from '../../../job/domain/entities/processing-job.entity';
import { DocumentQueue } from '../../../job/infrastructure/bullmq.queue';
import { PrismaJobRepository } from '../../../job/infrastructure/prisma-job.repository';
import type { IDocumentRepository } from '../../domain/repositories/document.repository.interface';

export interface ReindexDocumentParams {
  chunkingStrategy?: string | undefined;
  chunkSize?: number | undefined;
  chunkOverlap?: number | undefined;
  embeddingModel?: string | undefined;
  embeddingProvider?: string | undefined;
}

export class ReindexDocumentUseCase {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(
    userId: string,
    documentId: string,
    params: ReindexDocumentParams,
  ): Promise<{ jobId: string }> {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', documentId);
    }

    // Use Prisma transaction to atomically delete old chunks, jobs, and reset document status
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing chunks for this document.
      // Embeddings will be cascade deleted because of FK constraint on embeddings.chunkId
      await tx.documentChunk.deleteMany({
        where: { documentId },
      });

      // 2. Delete all previous jobs for this document
      await tx.aIProcessingJob.deleteMany({
        where: { documentId },
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
          indexedAt: null,
        },
      });
    });

    const filePath = path.join(os.tmpdir(), `upload_${documentId}_${doc.filename}`);
    try {
      await fs.access(filePath);
    } catch {
      throw new ValidationError(
        'Original upload file is no longer on disk. Upload the document again instead of reindexing.',
      );
    }

    const jobRepo = new PrismaJobRepository();
    const job = AIProcessingJob.create(documentId, userId);
    const savedJob = await jobRepo.save(job);

    const queue = new DocumentQueue();
    await queue.addDocumentJob({
      documentId,
      userId,
      jobId: savedJob.id,
      filePath,
      mimeType: doc.mimeType,
    });

    await activityLogService.record({
      userId,
      domain: 'DOCUMENT',
      entityId: documentId,
      action: 'UPDATED',
      message: 'document.reindex_requested',
      metadata: { jobId: savedJob.id, ...params },
    });

    return { jobId: savedJob.id };
  }
}
