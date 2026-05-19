import { Elysia } from 'elysia';
import { JobController } from './job.controller';

const controller = new JobController();

export const jobRoutes = new Elysia({ prefix: '/jobs' })
  .derive(async ({ request, jwt, set }: any) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader && process.env['NODE_ENV'] === 'development') {
      return { user: { sub: '00000000-0000-0000-0000-000000000001', role: 'admin' } };
    }

    if (!authHeader) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      throw new Error('Unauthorized');
    }

    return { user: payload };
  })
  .get(
    '/:id',
    async ({ params, user }) => {
      return controller.getJobStatus(user.sub, params.id);
    },
    {
      detail: { tags: ['jobs'], summary: 'Get background job status and progress' },
    },
  );
