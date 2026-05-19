import { Elysia } from 'elysia';
import {
  type AuthDeriveContext,
  deriveAuthenticatedUser,
} from '../../../shared/middleware/derive-auth-user';
import { ActivityLogController } from './activity-log.controller';

const controller = new ActivityLogController();

export const activityLogRoutes = new Elysia({ prefix: '/activity-logs' })
  .derive((context) => deriveAuthenticatedUser(context as unknown as AuthDeriveContext))
  .get('/', async ({ query, user }) => controller.list(user.sub, query), {
    detail: {
      tags: ['activity-logs'],
      summary: 'List activity logs for the authenticated user',
    },
  });
