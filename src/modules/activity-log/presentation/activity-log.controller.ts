import type { ActivityAction, ActivityDomain } from '@prisma/client';
import { ListActivityLogsQuery } from '../application/queries/list-activity-logs.query';

export class ActivityLogController {
  private listQuery = new ListActivityLogsQuery();

  async list(
    userId: string,
    query: {
      domain?: string | undefined;
      entityId?: string | undefined;
      action?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
      page?: string | undefined;
      limit?: string | undefined;
    },
  ) {
    const domain = query.domain?.toUpperCase() as ActivityDomain | undefined;
    const action = query.action?.toUpperCase() as ActivityAction | undefined;

    return this.listQuery.execute({
      userId,
      domain,
      entityId: query.entityId,
      action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ? Number.parseInt(query.page, 10) : 1,
      limit: query.limit ? Number.parseInt(query.limit, 10) : 20,
    });
  }
}
