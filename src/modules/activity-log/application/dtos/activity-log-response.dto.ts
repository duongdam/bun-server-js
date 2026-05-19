import type { ActivityLog } from '../../domain/entities/activity-log.entity';

export interface ActivityLogDto {
  id: string;
  userId: string;
  domain: string;
  entityId: string;
  action: string;
  message?: string | undefined;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityLogListResponseDto {
  data: ActivityLogDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function toActivityLogDto(log: ActivityLog): ActivityLogDto {
  const dto: ActivityLogDto = {
    id: log.id,
    userId: log.userId,
    domain: log.domain,
    entityId: log.entityId,
    action: log.action,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  };
  if (log.message != null) {
    dto.message = log.message;
  }
  return dto;
}
