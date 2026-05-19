import { type Job, Queue } from 'bullmq';
import { logger } from '../../../shared/infrastructure/logger/pino.logger';
import { redis } from '../../../shared/infrastructure/redis/client';
import { DOCUMENT_PROCESSING_QUEUE, type DocumentProcessingJobPayload } from '../../../worker';

export class DocumentQueue {
  private queue: Queue<DocumentProcessingJobPayload>;

  constructor() {
    this.queue = new Queue<DocumentProcessingJobPayload>(DOCUMENT_PROCESSING_QUEUE, {
      connection: redis,
      defaultJobOptions: {
        attempts: Number.parseInt(process.env.JOB_MAX_RETRIES ?? '3', 10),
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async addDocumentJob(
    payload: DocumentProcessingJobPayload,
  ): Promise<Job<DocumentProcessingJobPayload>> {
    try {
      const job = await this.queue.add('process-document', payload, {
        jobId: payload.jobId, // Custom Job ID to match our DB entity
      });
      logger.info(
        { jobId: job.id, documentId: payload.documentId },
        'Enqueued document processing job',
      );
      return job;
    } catch (error) {
      logger.error({ error, documentId: payload.documentId }, 'Failed to enqueue document job');
      throw new Error('Failed to enqueue job');
    }
  }

  async getJob(id: string): Promise<Job<DocumentProcessingJobPayload> | undefined> {
    return this.queue.getJob(id);
  }
}
