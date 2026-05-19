import type { ActivityAction, ActivityDomain } from '@prisma/client';
import type { ActivityLog } from '../entities/activity-log.entity';

export interface AppendActivityLogInput {
  userId: string;
  domain: ActivityDomain;
  entityId: string;
  action: ActivityAction;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface ActivityLogFilters {
  userId: string;
  domain?: ActivityDomain | undefined;
  entityId?: string | undefined;
  action?: ActivityAction | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page: number;
  limit: number;
}

export interface PaginatedActivityLogs {
  data: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IActivityLogRepository {
  append(input: AppendActivityLogInput): Promise<ActivityLog>;
  findByFilters(filters: ActivityLogFilters): Promise<PaginatedActivityLogs>;
}
