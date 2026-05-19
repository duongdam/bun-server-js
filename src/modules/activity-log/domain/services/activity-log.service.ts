import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import { PrismaActivityLogRepository } from '../../infrastructure/prisma-activity-log.repository';
import type { AppendActivityLogInput } from '../repositories/activity-log.repository.interface';

export class ActivityLogService {
  constructor(
    private readonly repository: PrismaActivityLogRepository = new PrismaActivityLogRepository(),
  ) {}

  async record(input: AppendActivityLogInput): Promise<void> {
    try {
      await this.repository.append(input);
    } catch (error) {
      logger.warn(
        {
          error,
          domain: input.domain,
          entityId: input.entityId,
          action: input.action,
        },
        'Failed to record activity log',
      );
    }
  }
}

export const activityLogService = new ActivityLogService();
