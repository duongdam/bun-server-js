import type { DocumentStatus, Prisma, Document as PrismaDocument } from '@prisma/client';
import type {
  FindAllOptions,
  PaginatedResult,
} from '../../../shared/domain/base.repository.interface';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { activityLogService } from '../../activity-log/domain/services/activity-log.service';
import { Document, type DocumentProps } from '../domain/entities/document.entity';
import type { IDocumentRepository } from '../domain/repositories/document.repository.interface';
import { ChunkingConfig, type ChunkingStrategy } from '../domain/value-objects/chunking-config.vo';

export class PrismaDocumentRepository implements IDocumentRepository {
  async findById(id: string): Promise<Document | null> {
    const data = await prisma.document.findUnique({ where: { id } });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
    status?: DocumentStatus,
    tags?: string[],
  ): Promise<PaginatedResult<Document>> {
    const where = {
      userId,
      ...(status && { status }),
      ...(tags && tags.length > 0 && { tags: { hasEvery: tags } }),
    };

    const [total, data] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: data.map((d) => this.mapToDomain(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAll(options?: FindAllOptions): Promise<Document[]> {
    const args: Prisma.DocumentFindManyArgs = {
      take: options?.limit ?? 100,
      skip: options?.page ? (options.page - 1) * (options.limit ?? 100) : 0,
    };
    if (options?.orderBy) {
      args.orderBy = { [options.orderBy]: options.orderDir ?? 'asc' };
    }
    const data = await prisma.document.findMany(args);
    return data.map((d) => this.mapToDomain(d));
  }

  async findByContentHash(userId: string, contentHash: string): Promise<Document | null> {
    const data = await prisma.document.findUnique({
      where: { userId_contentHash: { userId, contentHash } },
    });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(entity: Document): Promise<Document> {
    const data = {
      userId: entity.userId,
      filename: entity.filename,
      mimeType: entity.mimeType,
      fileSize: BigInt(entity.fileSize),
      status: entity.status,
      contentHash: entity.contentHash,
      chunkingStrategy: entity.chunkingConfig.strategy,
      chunkSize: entity.chunkingConfig.chunkSize,
      chunkOverlap: entity.chunkingConfig.chunkOverlap,
      embeddingModel: entity.embeddingModel,
      embeddingDimension: entity.embeddingDimension,
      embeddingProvider: entity.embeddingProvider,
      tags: entity.tags,
      metadata: entity.metadata as Prisma.InputJsonValue,
      pageCount: entity.pageCount ?? null,
      wordCount: entity.wordCount ?? null,
      language: entity.language ?? null,
      indexedAt: entity.indexedAt ?? null,
    };

    const saved = await prisma.document.upsert({
      where: { id: entity.id },
      update: data,
      create: {
        id: entity.id,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        ...data,
      },
    });

    // Clear domain events after save (in a real DDD setup, we'd dispatch them here)
    entity.events.clearDomainEvents();

    return this.mapToDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await prisma.document.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.document.count({ where: { id } });
    return count > 0;
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<void> {
    const existing = await prisma.document.findUnique({
      where: { id },
      select: { status: true, userId: true },
    });

    await prisma.document.update({
      where: { id },
      data: { status },
    });

    if (existing && existing.status !== status) {
      await activityLogService.record({
        userId: existing.userId,
        domain: 'DOCUMENT',
        entityId: id,
        action: 'STATUS_CHANGED',
        message: 'document.status_changed',
        metadata: { from: existing.status, to: status },
      });
    }
  }

  private mapToDomain(data: PrismaDocument): Document {
    const props: DocumentProps = {
      userId: data.userId,
      filename: data.filename,
      mimeType: data.mimeType,
      fileSize: Number(data.fileSize),
      status: data.status,
      contentHash: data.contentHash,
      chunkingConfig: new ChunkingConfig(
        data.chunkingStrategy as ChunkingStrategy,
        data.chunkSize,
        data.chunkOverlap,
      ),
      embeddingModel: data.embeddingModel,
      embeddingDimension: data.embeddingDimension,
      embeddingProvider: data.embeddingProvider,
      tags: data.tags,
      metadata:
        typeof data.metadata === 'object' && data.metadata !== null && !Array.isArray(data.metadata)
          ? (data.metadata as Record<string, unknown>)
          : {},
    };

    if (data.pageCount != null) props.pageCount = data.pageCount;
    if (data.wordCount != null) props.wordCount = data.wordCount;
    if (data.language != null) props.language = data.language;
    if (data.indexedAt != null) props.indexedAt = data.indexedAt;

    return new Document(data.id, props, data.createdAt, data.updatedAt);
  }
}
