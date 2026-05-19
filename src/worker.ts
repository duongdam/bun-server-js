import { type Job, Worker } from 'bullmq';
import { z } from 'zod';
import { maskSecret, parseServerEnv } from './shared/config/env';
import { logger } from './shared/infrastructure/logger/pino.logger';
import { connectDatabase, disconnectDatabase } from './shared/infrastructure/prisma/client';
import { disconnectRedis, redis } from './shared/infrastructure/redis/client';

// ─── Environment Validation ───────────────────────────────
const envSchema = z.object({
  WORKER_CONCURRENCY: z.string().default('4'),
  JOB_MAX_RETRIES: z.string().default('3'),
});

const env = envSchema.parse(process.env);
const CONCURRENCY = Number.parseInt(env.WORKER_CONCURRENCY, 10);

// ─── Queue Name Constants ─────────────────────────────────
export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

// ─── Job Payload Type ─────────────────────────────────────
export interface DocumentProcessingJobPayload {
  documentId: string;
  userId: string;
  jobId: string;
  filePath: string; // Temporary path to extracted file content
  mimeType: string;
}

// ─── Worker ───────────────────────────────────────────────
async function createWorker() {
  await connectDatabase();
  logger.info({ concurrency: CONCURRENCY }, 'Starting document processing worker');

  const worker = new Worker<DocumentProcessingJobPayload>(
    DOCUMENT_PROCESSING_QUEUE,
    async (job: Job<DocumentProcessingJobPayload>) => {
      const { documentId, userId, jobId } = job.data;
      const workerLogger = logger.child({ documentId, userId, jobId, bullJobId: job.id });

      workerLogger.info('Processing document job started');

      // TODO: Implement full pipeline in Phase 3 (T041)
      // This is the entrypoint stub — the full processor will be injected here
      const { processDocument } = await import(
        './modules/job/infrastructure/document-processing.worker'
      );
      await processDocument(job.data, workerLogger);

      workerLogger.info('Processing document job completed');
    },
    {
      connection: redis,
      concurrency: CONCURRENCY,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, documentId: job.data.documentId }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, documentId: job?.data?.documentId, err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  logger.info(
    { queue: DOCUMENT_PROCESSING_QUEUE, concurrency: CONCURRENCY },
    'Worker is listening for jobs',
  );

  return worker;
}

// ─── Graceful Shutdown ────────────────────────────────────
async function shutdown(worker: Worker, signal: string) {
  logger.info({ signal }, 'Worker graceful shutdown initiated');
  await worker.close();
  await disconnectDatabase();
  await disconnectRedis();
  logger.info('Worker shutdown complete');
  process.exit(0);
}

// ─── Bootstrap ────────────────────────────────────────────
if (import.meta.main) {
  const envResult = parseServerEnv();
  if (envResult.success) {
    logger.info(
      {
        embeddingProvider: envResult.data.EMBEDDING_PROVIDER,
        embeddingModel: envResult.data.EMBEDDING_MODEL,
        openaiApiKey: maskSecret(envResult.data.OPENAI_API_KEY),
      },
      'Worker embedding env (OPENAI_API_KEY masked)',
    );
  }

  const worker = await createWorker();
  process.on('SIGTERM', () => shutdown(worker, 'SIGTERM'));
  process.on('SIGINT', () => shutdown(worker, 'SIGINT'));
}
