import { BaseEntity } from '../../../../shared/domain/base.entity';
import { JobStatus } from '@prisma/client';

export interface AIProcessingJobProps {
  documentId: string;
  userId: string;
  status: JobStatus;
  stage?: string | undefined;
  progress: number;
  totalChunks?: number | undefined;
  processedChunks: number;
  errorMessage?: string | undefined;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
}

export class AIProcessingJob extends BaseEntity {
  public readonly documentId: string;
  public readonly userId: string;
  public status: JobStatus;
  public stage?: string | undefined;
  public progress: number;
  public totalChunks?: number | undefined;
  public processedChunks: number;
  public errorMessage?: string | undefined;
  public retryCount: number;
  public readonly maxRetries: number;
  public startedAt?: Date | undefined;
  public completedAt?: Date | undefined;

  constructor(
    id: string | undefined,
    props: AIProcessingJobProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this.documentId = props.documentId;
    this.userId = props.userId;
    this.status = props.status;
    this.stage = props.stage;
    this.progress = props.progress;
    this.totalChunks = props.totalChunks;
    this.processedChunks = props.processedChunks;
    this.errorMessage = props.errorMessage;
    this.retryCount = props.retryCount;
    this.maxRetries = props.maxRetries;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
  }

  static create(documentId: string, userId: string, maxRetries = 3): AIProcessingJob {
    return new AIProcessingJob(undefined, {
      documentId,
      userId,
      status: JobStatus.PENDING,
      progress: 0,
      processedChunks: 0,
      retryCount: 0,
      maxRetries,
    });
  }

  markProcessing(stage?: string): void {
    if (this.status === JobStatus.PENDING) {
      this.startedAt = new Date();
    }
    this.status = JobStatus.PROCESSING;
    if (stage) this.stage = stage;
    this.touch();
  }

  updateProgress(processed: number, total: number, stage?: string): void {
    this.processedChunks = processed;
    this.totalChunks = total;
    this.progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    if (stage) this.stage = stage;
    this.touch();
  }

  markCompleted(): void {
    this.status = JobStatus.COMPLETED;
    this.progress = 100;
    this.completedAt = new Date();
    this.touch();
  }

  markFailed(error: string): void {
    this.status = JobStatus.FAILED;
    this.errorMessage = error;
    this.completedAt = new Date();
    this.touch();
  }

  incrementRetry(): boolean {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.status = JobStatus.RETRYING;
      this.touch();
      return true; // Should retry
    }
    return false; // Max retries exceeded
  }
}
