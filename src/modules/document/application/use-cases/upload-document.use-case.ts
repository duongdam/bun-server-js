import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import {
  ConflictError,
  FileTooLargeError,
} from '../../../../shared/middleware/error-handler.middleware';
import { activityLogService } from '../../../activity-log/domain/services/activity-log.service';
import { AIProcessingJob } from '../../../job/domain/entities/processing-job.entity';
import { createEmbeddingProvider } from '../../../embedding/infrastructure/create-embedding-provider';
import { DocumentQueue } from '../../../job/infrastructure/bullmq.queue';
import { PrismaJobRepository } from '../../../job/infrastructure/prisma-job.repository';
import { Document } from '../../domain/entities/document.entity';
import { ChunkingConfig } from '../../domain/value-objects/chunking-config.vo';
import { FileType } from '../../domain/value-objects/file-type.vo';
import { PrismaDocumentRepository } from '../../infrastructure/prisma-document.repository';
import { type DocumentResponseDto, toDocumentResponseDto } from '../dtos/document-response.dto';
import type { UploadDocumentDto } from '../dtos/upload-document.dto';

export class UploadDocumentUseCase {
  private docRepo: PrismaDocumentRepository;
  private jobRepo: PrismaJobRepository;
  private docQueue: DocumentQueue;

  constructor() {
    this.docRepo = new PrismaDocumentRepository();
    this.jobRepo = new PrismaJobRepository();
    this.docQueue = new DocumentQueue();
  }

  async execute(
    userId: string,
    dto: UploadDocumentDto,
  ): Promise<{ document: DocumentResponseDto; jobId: string }> {
    const file = dto.file;
    const maxSize = Number.parseInt(process.env.MAX_FILE_SIZE || '104857600', 10);

    if (file.size > maxSize) {
      throw new FileTooLargeError(maxSize);
    }

    // Validate type
    FileType.fromFilename(file.name, file.type);

    // Validate chunking config
    const chunkingConfig = new ChunkingConfig(
      dto.chunkingStrategy,
      dto.chunkSize,
      dto.chunkOverlap,
    );

    // Compute SHA-256 hash
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate
    const existing = await this.docRepo.findByContentHash(userId, hash);
    if (existing) {
      throw new ConflictError(
        `Document with identical content already exists. Document ID: ${existing.id}`,
        { documentId: existing.id },
      );
    }

    const embeddingProvider = createEmbeddingProvider(dto.embeddingProvider);
    const embeddingDimension = embeddingProvider.dimension;

    // Create Document Entity
    const doc = Document.create({
      userId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      contentHash: hash,
      chunkingConfig,
      embeddingModel: embeddingProvider.model,
      embeddingDimension,
      embeddingProvider: embeddingProvider.provider,
      tags: dto.tags,
      metadata: dto.metadata,
    });

    const savedDoc = await this.docRepo.save(doc);

    // Write file to temporary storage for worker
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `upload_${savedDoc.id}_${file.name}`);
    await fs.writeFile(tempPath, buffer);

    // Create Job Entity
    const job = AIProcessingJob.create(savedDoc.id, userId);
    const savedJob = await this.jobRepo.save(job);

    // Enqueue
    await this.docQueue.addDocumentJob({
      documentId: savedDoc.id,
      userId,
      jobId: savedJob.id,
      filePath: tempPath,
      mimeType: file.type,
    });

    await activityLogService.record({
      userId,
      domain: 'DOCUMENT',
      entityId: savedDoc.id,
      action: 'CREATED',
      message: 'document.uploaded',
      metadata: {
        filename: savedDoc.filename,
        mimeType: savedDoc.mimeType,
        jobId: savedJob.id,
      },
    });

    return {
      document: toDocumentResponseDto(savedDoc),
      jobId: savedJob.id,
    };
  }
}
