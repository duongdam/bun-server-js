import { DocumentProcessingJobPayload } from '../../../worker';
import { Logger } from 'pino';
import { PrismaJobRepository } from './prisma-job.repository';
import { PrismaDocumentRepository } from '../../document/infrastructure/prisma-document.repository';
import { PrismaEmbeddingRepository } from '../../embedding/infrastructure/prisma-embedding.repository';
import { ChunkingService } from '../../document/domain/services/chunking.service';
import { EmbeddingService } from '../../embedding/domain/services/embedding.service';
import { PdfParser } from '../../document/infrastructure/parsers/pdf.parser';
import { DocxParser } from '../../document/infrastructure/parsers/docx.parser';
import { HtmlParser } from '../../document/infrastructure/parsers/html.parser';
import { TextParser } from '../../document/infrastructure/parsers/text.parser';
import { IFileParser } from '../../document/domain/services/file-parser.service';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

const jobRepo = new PrismaJobRepository();
const docRepo = new PrismaDocumentRepository();
const embedRepo = new PrismaEmbeddingRepository();
const chunkingService = new ChunkingService();
const embeddingService = new EmbeddingService();

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

  try {
    // 1. Parsing
    workerLogger.info('Stage: parsing');
    job.markProcessing('parsing');
    await jobRepo.save(job);
    doc.markProcessing();
    await docRepo.save(doc);

    const fileBuffer = await fs.readFile(filePath);
    const parser = getParserForMimeType(mimeType);
    const parsed = await parser.parse(fileBuffer, mimeType);

    // 2. Chunking
    workerLogger.info('Stage: chunking');
    job.updateProgress(10, 100, 'chunking');
    await jobRepo.save(job);

    const chunkingConfig = doc.chunkingConfig;
    const metadata = { ...doc.metadata, ...parsed.metadata };

    const chunks = chunkingService.chunkText(parsed.text, chunkingConfig, metadata);
    if (chunks.length === 0) {
      throw new Error('No text chunks could be extracted from document');
    }

    // Assign UUIDs to chunks before embedding
    const chunksWithIds = chunks.map(c => {
      const chunk: any = {
        ...c,
        id: randomUUID(),
      };
      if (parsed.pageCount && c.pageNumber !== undefined) {
        chunk.pageNumber = c.pageNumber;
      }
      return chunk;
    });

    // 3. Embedding
    workerLogger.info({ chunkCount: chunks.length }, 'Stage: embedding');
    job.updateProgress(30, chunks.length, 'embedding');
    await jobRepo.save(job);

    const textsToEmbed = chunksWithIds.map((c) => c.content);
    const embeddings = await embeddingService.embedBatch(textsToEmbed);

    if (embeddings.length !== chunksWithIds.length) {
      throw new Error('Mismatch between chunk count and embedding count');
    }

    // 4. Storing
    workerLogger.info('Stage: storing');
    job.updateProgress(80, chunks.length, 'storing');
    await jobRepo.save(job);

    await embedRepo.saveChunksAndEmbeddings({
      documentId,
      model: doc.embeddingModel,
      provider: doc.embeddingProvider,
      chunks: chunksWithIds,
      embeddings,
    });

    // 5. Completion
    workerLogger.info('Stage: completed');
    doc.markIndexed(parsed.pageCount, textsToEmbed.join(' ').split(/\s+/).length, 'unknown'); // Naive word count
    await docRepo.save(doc);

    job.markCompleted();
    await jobRepo.save(job);

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
    } else {
      job.markFailed(errMessage);
      await jobRepo.save(job);
      doc.markFailed(errMessage);
      await docRepo.save(doc);
    }
  }
}
