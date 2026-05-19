import { Elysia, t } from 'elysia';
import { DocumentController } from './document.controller';

// Note: To keep things Elysia-native and avoid heavy dependency injection for this size,
// we instantiate the controller here.
const controller = new DocumentController();

export const documentRoutes = new Elysia({ prefix: '/documents' })
  // Attach auth guard and extract user info
  // Because Elysia context resolution is static, we define the derived state.
  // Assuming a mocked auth for development if JWT isn't fully set up yet by the user,
  // but we'll use the proper header extraction if available.
  .derive(async ({ request, jwt, set }: any) => {
    // Basic mock user for testing if no auth header is provided (for local dev only)
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
  // Optional: Add rate limiting
  // .onBeforeHandle(async ({ user, set }) => {
  //   const rlError = await rateLimitMiddleware(user.sub, set);
  //   if (rlError) return rlError;
  // })

  .post(
    '/upload',
    async ({ body, user }) => {
      return controller.upload(user.sub, body);
    },
    {
      body: t.Object({
        file: t.File(),
        chunkingStrategy: t.Optional(t.String()),
        chunkSize: t.Optional(t.Numeric()),
        chunkOverlap: t.Optional(t.Numeric()),
        embeddingProvider: t.Optional(t.String()),
        embeddingModel: t.Optional(t.String()),
        tags: t.Optional(t.String()),
      }),
      detail: {
        tags: ['documents'],
        summary: 'Upload and index a document',
        description:
          'Uploads a file (PDF, DOCX, TXT, MD, CSV, JSON, HTML) for parsing, chunking, and vector embedding.',
      },
    },
  )

  .get(
    '/',
    async ({ query, user }) => {
      return controller.list(user.sub, query as any);
    },
    {
      detail: { tags: ['documents'], summary: 'List user documents' },
    },
  )

  .get(
    '/:id',
    async ({ params, user }) => {
      return controller.getById(user.sub, params.id);
    },
    {
      detail: { tags: ['documents'], summary: 'Get document details' },
    },
  )

  .delete(
    '/:id',
    async ({ params, user }) => {
      return controller.delete(user.sub, params.id);
    },
    {
      detail: { tags: ['documents'], summary: 'Delete a document and its embeddings' },
    },
  )
  .post(
    '/:id/reindex',
    async ({ params, body, user }) => {
      return controller.reindex(user.sub, params.id, body);
    },
    {
      detail: { tags: ['documents'], summary: 'Reindex a document with new settings' },
    }
  )
  .get(
    '/:id/chunks',
    async ({ params, query, user }) => {
      return controller.getChunks(user.sub, params.id, query as any);
    },
    {
      detail: { tags: ['documents'], summary: 'Get paginated chunks for a document' },
    }
  );
