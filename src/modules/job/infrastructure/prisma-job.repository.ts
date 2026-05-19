import { JobStatus, type AIProcessingJob as PrismaAIProcessingJob } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import {
  AIProcessingJob,
  type AIProcessingJobProps,
} from '../domain/entities/processing-job.entity';

export class PrismaJobRepository {
  async findById(id: string): Promise<AIProcessingJob | null> {
    const data = await prisma.aIProcessingJob.findUnique({ where: { id } });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(entity: AIProcessingJob): Promise<AIProcessingJob> {
    const data = {
      documentId: entity.documentId,
      userId: entity.userId,
      status: entity.status,
      stage: entity.stage ?? null,
      progress: entity.progress,
      totalChunks: entity.totalChunks ?? null,
      processedChunks: entity.processedChunks,
      errorMessage: entity.errorMessage ?? null,
      retryCount: entity.retryCount,
      maxRetries: entity.maxRetries,
      startedAt: entity.startedAt ?? null,
      completedAt: entity.completedAt ?? null,
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

  private mapToDomain(data: PrismaAIProcessingJob): AIProcessingJob {
    const props: AIProcessingJobProps = {
      documentId: data.documentId,
      userId: data.userId,
      status: data.status,
      progress: data.progress,
      processedChunks: data.processedChunks,
      retryCount: data.retryCount,
      maxRetries: data.maxRetries,
    };

    if (data.stage != null) props.stage = data.stage;
    if (data.totalChunks != null) props.totalChunks = data.totalChunks;
    if (data.errorMessage != null) props.errorMessage = data.errorMessage;
    if (data.startedAt != null) props.startedAt = data.startedAt;
    if (data.completedAt != null) props.completedAt = data.completedAt;

    return new AIProcessingJob(data.id, props, data.createdAt, data.createdAt);
  }
}
