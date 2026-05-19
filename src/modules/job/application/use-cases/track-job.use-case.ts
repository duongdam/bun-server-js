import { NotFoundError } from '../../../../shared/middleware/error-handler.middleware';
import { PrismaJobRepository } from '../../infrastructure/prisma-job.repository';

export interface JobProgressDto {
  id: string;
  documentId: string;
  status: string;
  stage?: string | undefined;
  progress: number;
  totalChunks?: number | undefined;
  processedChunks: number;
  errorMessage?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export class TrackJobUseCase {
  private jobRepo: PrismaJobRepository;

  constructor() {
    this.jobRepo = new PrismaJobRepository();
  }

  async execute(userId: string, jobId: string): Promise<JobProgressDto> {
    const job = await this.jobRepo.findById(jobId);

    if (!job) {
      throw new NotFoundError('Job', jobId);
    }

    if (job.userId !== userId) {
      // Don't leak existence of other users' jobs
      throw new NotFoundError('Job', jobId);
    }

    return {
      id: job.id,
      documentId: job.documentId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      totalChunks: job.totalChunks,
      processedChunks: job.processedChunks,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }
}
