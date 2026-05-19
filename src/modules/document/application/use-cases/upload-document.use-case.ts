import { UploadDocumentDto } from '../dtos/upload-document.dto';
import { DocumentResponseDto, toDocumentResponseDto } from '../dtos/document-response.dto';
import { PrismaDocumentRepository } from '../../infrastructure/prisma-document.repository';
import { Document } from '../../domain/entities/document.entity';
import { FileType } from '../../domain/value-objects/file-type.vo';
import { ChunkingConfig } from '../../domain/value-objects/chunking-config.vo';
import {
  ConflictError,
  FileTooLargeError,
} from '../../../../shared/middleware/error-handler.middleware';
import { DocumentQueue } from '../../../job/infrastructure/bullmq.queue';
import { PrismaJobRepository } from '../../../job/infrastructure/prisma-job.repository';
import { AIProcessingJob } from '../../../job/domain/entities/processing-job.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import os from 'os';

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
    const maxSize = parseInt(process.env['MAX_FILE_SIZE'] || '104857600', 10);

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

    // Determine dimensions (mocking simple map for the example)
    const embeddingDimension = dto.embeddingModel.includes('large')
      ? 3072
      : dto.embeddingModel.includes('MiniLM')
        ? 384
        : 1536;

    // Create Document Entity
    const doc = Document.create({
      userId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      contentHash: hash,
      chunkingConfig,
      embeddingModel: dto.embeddingModel,
      embeddingDimension,
      embeddingProvider: dto.embeddingProvider,
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

    return {
      document: toDocumentResponseDto(savedDoc),
      jobId: savedJob.id,
    };
  }
}
