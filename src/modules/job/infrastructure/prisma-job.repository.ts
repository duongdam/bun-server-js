import { AIProcessingJob, AIProcessingJobProps } from '../domain/entities/processing-job.entity';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { JobStatus } from '@prisma/client';

export class PrismaJobRepository {
  async findById(id: string): Promise<AIProcessingJob | null> {
    const data = await prisma.aIProcessingJob.findUnique({ where: { id } });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(entity: AIProcessingJob): Promise<AIProcessingJob> {
    const data: any = {
      documentId: entity.documentId,
      userId: entity.userId,
      status: entity.status,
      stage: entity.stage,
      progress: entity.progress,
      totalChunks: entity.totalChunks,
      processedChunks: entity.processedChunks,
      errorMessage: entity.errorMessage,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
    };

    const saved = await prisma.aIProcessingJob.upsert({
      where: { id: entity.id },
      update: data,
      create: { id: entity.id, createdAt: entity.createdAt, ...data },
    });

    return this.mapToDomain(saved);
  }

  async updateProgress(
    id: string,
    progress: number,
    stage: string,
    processed: number,
    total: number,
  ): Promise<void> {
    await prisma.aIProcessingJob.update({
      where: { id },
      data: {
        progress,
        stage,
        processedChunks: processed,
        totalChunks: total,
      },
    });
  }

  async markCompleted(id: string): Promise<void> {
    await prisma.aIProcessingJob.update({
      where: { id },
      data: {
        status: JobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await prisma.aIProcessingJob.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  private mapToDomain(data: any): AIProcessingJob {
    const props: AIProcessingJobProps = {
      documentId: data.documentId,
      userId: data.userId,
      status: data.status,
      stage: data.stage ?? undefined,
      progress: data.progress,
      totalChunks: data.totalChunks ?? undefined,
      processedChunks: data.processedChunks,
      errorMessage: data.errorMessage ?? undefined,
      retryCount: data.retryCount,
      maxRetries: data.maxRetries,
      startedAt: data.startedAt ?? undefined,
      completedAt: data.completedAt ?? undefined,
    };

    return new AIProcessingJob(data.id, props, data.createdAt, data.updatedAt);
  }
}
