import { Elysia, t } from 'elysia';
import { SearchController } from './search.controller';

const controller = new SearchController();

export const searchRoutes = new Elysia({ prefix: '/search' })
  .derive(async ({ request, jwt, set }: any) => {
    // Auth extraction matching job and document routes
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
  .post(
    '/',
    async ({ body, user }) => {
      return controller.search(user.sub, body);
    },
    {
      detail: { tags: ['search'], summary: 'Perform semantic, hybrid, or keyword search on indexed documents' },
    }
  )
  .post(
    '/retrieval',
    async ({ body, user }) => {
      return controller.retrieve(user.sub, body);
    },
    {
      detail: { tags: ['search'], summary: 'Retrieve context chunks optimized for RAG token budgets' },
    }
  );
