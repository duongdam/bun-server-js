import type { ActivityAction, ActivityDomain } from '@prisma/client';
import type { IActivityLogRepository } from '../../domain/repositories/activity-log.repository.interface';
import { PrismaActivityLogRepository } from '../../infrastructure/prisma-activity-log.repository';
import {
  type ActivityLogListResponseDto,
  toActivityLogDto,
} from '../dtos/activity-log-response.dto';

export interface ListActivityLogsParams {
  userId: string;
  domain?: ActivityDomain | undefined;
  entityId?: string | undefined;
  action?: ActivityAction | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class ListActivityLogsQuery {
  constructor(
    private readonly repository: IActivityLogRepository = new PrismaActivityLogRepository(),
  ) {}

  async execute(params: ListActivityLogsParams): Promise<ActivityLogListResponseDto> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);

    const result = await this.repository.findByFilters({
      userId: params.userId,
      domain: params.domain,
      entityId: params.entityId,
      action: params.action,
      from: params.from,
      to: params.to,
      page,
      limit,
    });

    return {
      data: result.data.map(toActivityLogDto),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }
}
