import { Elysia } from 'elysia';
import {
  type AuthDeriveContext,
  deriveAuthenticatedUser,
} from '../../../shared/middleware/derive-auth-user';
import { SearchController } from './search.controller';

const controller = new SearchController();

export const searchRoutes = new Elysia({ prefix: '/search' })
  .derive((context) => deriveAuthenticatedUser(context as unknown as AuthDeriveContext))
  .post(
    '/',
    async ({ body, user }) => {
      return controller.search(user.sub, body);
    },
    {
      detail: {
        tags: ['search'],
        summary: 'Perform semantic, hybrid, or keyword search on indexed documents',
      },
    },
  )
  .post(
    '/retrieval',
    async ({ body, user }) => {
      return controller.retrieve(user.sub, body);
    },
    {
      detail: {
        tags: ['search'],
        summary: 'Retrieve context chunks optimized for RAG token budgets',
      },
    },
  );
