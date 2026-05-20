import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import type { Logger } from 'pino';
import type { DocumentProcessingJobPayload } from '../../../worker';
import { activityLogService } from '../../activity-log/domain/services/activity-log.service';
import { type Chunk, ChunkingService } from '../../document/domain/services/chunking.service';
import type { IFileParser } from '../../document/domain/services/file-parser.service';
import { DocxParser } from '../../document/infrastructure/parsers/docx.parser';
import { HtmlParser } from '../../document/infrastructure/parsers/html.parser';
import { PdfParser } from '../../document/infrastructure/parsers/pdf.parser';
import { TextParser } from '../../document/infrastructure/parsers/text.parser';
import { PrismaDocumentRepository } from '../../document/infrastructure/prisma-document.repository';
import { EmbeddingService } from '../../embedding/domain/services/embedding.service';
import { createEmbeddingProvider } from '../../embedding/infrastructure/create-embedding-provider';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { PrismaEmbeddingRepository } from '../../embedding/infrastructure/prisma-embedding.repository';
import { PrismaJobRepository } from './prisma-job.repository';

const jobRepo = new PrismaJobRepository();
const docRepo = new PrismaDocumentRepository();
const embedRepo = new PrismaEmbeddingRepository();
const chunkingService = new ChunkingService();

function getParserForMimeType(mimeType: string): IFileParser {
  switch (mimeType) {
    case 'application/pdf':
      return new PdfParser();
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return new DocxParser();
    case 'text/html':
      return new HtmlParser();
    default:
      // Covers text/plain, text/markdown, text/csv, application/json
      return new TextParser();
  }
}

export async function processDocument(payload: DocumentProcessingJobPayload, workerLogger: Logger) {
  const { documentId, jobId, filePath, mimeType } = payload;

  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const doc = await docRepo.findById(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  const logJobStage = async (stage: string, progress?: number) => {
    await activityLogService.record({
      userId: job.userId,
      domain: 'JOB',
      entityId: jobId,
      action: stage === 'started' ? 'CREATED' : 'STAGE_CHANGED',
      message: stage === 'started' ? 'job.started' : 'job.stage_changed',
      metadata: { documentId, stage, progress },
    });
  };

  try {
    await logJobStage('started', 0);

    // 1. Parsing
    workerLogger.info('Stage: parsing');
    job.markProcessing('parsing');
    await jobRepo.save(job);
    doc.markProcessing();
    await docRepo.save(doc);
    await logJobStage('parsing', 5);

    const fileBuffer = await fs.readFile(filePath);
    const parser = getParserForMimeType(mimeType);
    const parsed = await parser.parse(fileBuffer, mimeType);

    // 2. Chunking
    workerLogger.info('Stage: chunking');
    job.updateProgress(10, 100, 'chunking');
    await jobRepo.save(job);
    await logJobStage('chunking', 10);

    const chunkingConfig = doc.chunkingConfig;
    const metadata = { ...doc.metadata, ...parsed.metadata };

    const chunks = chunkingService.chunkText(parsed.text, chunkingConfig, metadata);
    if (chunks.length === 0) {
      throw new Error('No text chunks could be extracted from document');
    }

    // Assign UUIDs to chunks before embedding
    const chunksWithIds = chunks.map((c): Chunk & { id: string } => {
      const chunk: Chunk & { id: string } = {
        ...c,
        id: randomUUID(),
      };
      if (parsed.pageCount && c.pageNumber !== undefined) {
        chunk.pageNumber = c.pageNumber;
      }
      return chunk;
    });

    // 3. Embedding — use active EMBEDDING_PROVIDER from env and sync document metadata
    const embeddingProvider = createEmbeddingProvider();
    const embeddingService = new EmbeddingService(embeddingProvider);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        embeddingProvider: embeddingProvider.provider,
        embeddingModel: embeddingProvider.model,
        embeddingDimension: embeddingProvider.dimension,
      },
    });

    workerLogger.info(
      {
        chunkCount: chunks.length,
        provider: embeddingProvider.provider,
        model: embeddingProvider.model,
        dimension: embeddingProvider.dimension,
      },
      'Stage: embedding',
    );
    job.updateProgress(30, chunks.length, 'embedding');
    await jobRepo.save(job);
    await logJobStage('embedding', 30);

    const textsToEmbed = chunksWithIds.map((c) => c.content);
    const embedStart = Date.now();
    const embeddings = await embeddingService.embedBatch(textsToEmbed, { purpose: 'document' });
    const embedDurationMs = Date.now() - embedStart;

    await activityLogService.record({
      userId: job.userId,
      domain: 'EMBEDDING',
      entityId: documentId,
      action: 'BATCH_COMPLETED',
      message: 'embedding.batch_completed',
      metadata: {
        chunkCount: chunksWithIds.length,
        model: embeddingProvider.model,
        provider: embeddingProvider.provider,
        durationMs: embedDurationMs,
        jobId,
      },
    });

    if (embeddings.length !== chunksWithIds.length) {
      throw new Error('Mismatch between chunk count and embedding count');
    }

    // 4. Storing
    workerLogger.info('Stage: storing');
    job.updateProgress(80, chunks.length, 'storing');
    await jobRepo.save(job);
    await logJobStage('storing', 80);

    await embedRepo.saveChunksAndEmbeddings({
      documentId,
      model: embeddingProvider.model,
      provider: embeddingProvider.provider,
      chunks: chunksWithIds,
      embeddings,
    });

    // 5. Completion
    workerLogger.info('Stage: completed');
    doc.markIndexed(parsed.pageCount, textsToEmbed.join(' ').split(/\s+/).length, 'unknown'); // Naive word count
    await docRepo.save(doc);

    job.markCompleted();
    await jobRepo.save(job);

    await activityLogService.record({
      userId: job.userId,
      domain: 'JOB',
      entityId: jobId,
      action: 'STATUS_CHANGED',
      message: 'job.completed',
      metadata: { documentId },
    });

    // Cleanup temporary file
    try {
      await fs.unlink(filePath);
    } catch (cleanupErr) {
      workerLogger.warn({ err: cleanupErr }, 'Failed to cleanup temporary file');
    }
  } catch (error) {
    workerLogger.error({ error }, 'Document processing failed');
    const errMessage = error instanceof Error ? error.message : 'Unknown error';

    if (job.incrementRetry()) {
      await jobRepo.save(job);
      throw error; // Re-throws to BullMQ so it retries
    }
    job.markFailed(errMessage);
    await jobRepo.save(job);
    doc.markFailed(errMessage);
    await docRepo.save(doc);

    await activityLogService.record({
      userId: job.userId,
      domain: 'JOB',
      entityId: jobId,
      action: 'FAILED',
      message: 'job.failed',
      metadata: { documentId, error: errMessage },
    });
  }
}
