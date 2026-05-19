import { Elysia } from 'elysia';
import {
  type AuthDeriveContext,
  deriveAuthenticatedUser,
} from '../../../shared/middleware/derive-auth-user';
import { JobController } from './job.controller';

const controller = new JobController();

export const jobRoutes = new Elysia({ prefix: '/jobs' })
  .derive((context) => deriveAuthenticatedUser(context as unknown as AuthDeriveContext))
  .get(
    '/:id',
    async ({ params, user }) => {
      return controller.getJobStatus(user.sub, params.id);
    },
    {
      detail: { tags: ['jobs'], summary: 'Get background job status and progress' },
    },
  );
