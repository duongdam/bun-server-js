import type { Prisma, ActivityLog as PrismaActivityLog } from '@prisma/client';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { ActivityLog } from '../domain/entities/activity-log.entity';
import type {
  ActivityLogFilters,
  AppendActivityLogInput,
  IActivityLogRepository,
  PaginatedActivityLogs,
} from '../domain/repositories/activity-log.repository.interface';

export class PrismaActivityLogRepository implements IActivityLogRepository {
  async append(input: AppendActivityLogInput): Promise<ActivityLog> {
    const saved = await prisma.activityLog.create({
      data: {
        userId: input.userId,
        domain: input.domain,
        entityId: input.entityId,
        action: input.action,
        message: input.message ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.mapToDomain(saved);
  }

  async findByFilters(filters: ActivityLogFilters): Promise<PaginatedActivityLogs> {
    const where: Prisma.ActivityLogWhereInput = {
      userId: filters.userId,
    };

    if (filters.domain) where.domain = filters.domain;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [total, rows] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.mapToDomain(row)),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit) || 1,
    };
  }

  private mapToDomain(data: PrismaActivityLog): ActivityLog {
    const metadata =
      typeof data.metadata === 'object' && data.metadata !== null && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};

    const props = {
      userId: data.userId,
      domain: data.domain,
      entityId: data.entityId,
      action: data.action,
      metadata,
      createdAt: data.createdAt,
    };

    if (data.message != null) {
      return new ActivityLog(data.id, { ...props, message: data.message });
    }

    return new ActivityLog(data.id, props);
  }
}
