import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { activityLogRoutes } from './modules/activity-log/presentation/activity-log.routes';
import { authRoutes } from './modules/auth/presentation/auth.routes';
import { documentRoutes } from './modules/document/presentation/document.routes';
import { jobRoutes } from './modules/job/presentation/job.routes';
import { searchRoutes } from './modules/search/presentation/search.routes';
import { maskSecret, parseServerEnv } from './shared/config/env';
import { logger } from './shared/infrastructure/logger/pino.logger';
import { connectDatabase, disconnectDatabase } from './shared/infrastructure/prisma/client';
import { disconnectRedis, pingRedis } from './shared/infrastructure/redis/client';
import { errorHandler } from './shared/middleware/error-handler.middleware';

// ─── Environment Validation ───────────────────────────────
const env = parseServerEnv();
if (!env.success) {
  logger.fatal({ errors: env.error.flatten() }, 'Invalid environment configuration');
  process.exit(1);
}

const envConfig = env.data;

const PORT = Number.parseInt(envConfig.PORT, 10);

// ─── Application Bootstrap ────────────────────────────────
export const app = new Elysia()
  // OpenAPI / Swagger
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'AI Document Platform API',
          version: '1.0.0',
          description:
            'Production-grade AI document processing platform with semantic search and RAG retrieval',
          contact: { name: 'API Support', email: 'support@example.com' },
        },
        tags: [
          { name: 'auth', description: 'Authentication (register, login)' },
          { name: 'activity-logs', description: 'Audit trail for documents, jobs, embeddings' },
          { name: 'documents', description: 'Document upload and management' },
          { name: 'search', description: 'Semantic and hybrid search' },
          { name: 'retrieval', description: 'RAG retrieval endpoints' },
          { name: 'jobs', description: 'Background job tracking' },
          { name: 'health', description: 'Health checks' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    }),
  )
  // JWT plugin
  .use(
    jwt({
      name: 'jwt',
      secret: envConfig.JWT_SECRET,
      exp: envConfig.JWT_EXPIRES_IN,
    }),
  )
  // CORS
  .use(
    cors({
      origin: envConfig.NODE_ENV === 'production' ? (envConfig.ALLOWED_ORIGINS ?? true) : true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )
  // Request logging
  .onRequest(({ request }) => {
    logger.info({ method: request.method, url: request.url }, 'Incoming request');
  })
  // Response logging
  .onAfterResponse(({ request, set }) => {
    logger.info(
      { method: request.method, url: request.url, status: set.status },
      'Request completed',
    );
  })
  // Global error handler
  .onError(errorHandler)
  // Health check endpoint (no auth required)
  .get(
    '/health',
    async () => {
      const [dbOk, redisOk] = await Promise.all([
        (async () => {
          try {
            const { prisma } = await import('./shared/infrastructure/prisma/client');
            await prisma.$queryRaw`SELECT 1`;
            return true;
          } catch {
            return false;
          }
        })(),
        pingRedis(),
      ]);

      const status = dbOk && redisOk ? 'ok' : 'degraded';
      return {
        status,
        version: envConfig.NPM_PACKAGE_VERSION ?? '1.0.0',
        services: {
          database: dbOk ? 'ok' : 'error',
          redis: redisOk ? 'ok' : 'error',
          embeddingProvider: envConfig.EMBEDDING_PROVIDER,
        },
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: { tags: ['health'], summary: 'Service health check' },
    },
  )
  // Mount module routes
  .group('/api/v1', (api) =>
    api.use(authRoutes).use(activityLogRoutes).use(documentRoutes).use(jobRoutes).use(searchRoutes),
  );

// ─── Server Lifecycle ─────────────────────────────────────

async function start() {
  try {
    logger.info(
      {
        embeddingProvider: envConfig.EMBEDDING_PROVIDER,
        embeddingModel: envConfig.EMBEDDING_MODEL,
        openaiApiKey: maskSecret(envConfig.OPENAI_API_KEY),
      },
      'Embedding env (OPENAI_API_KEY masked)',
    );

    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          env: envConfig.NODE_ENV,
          swagger: `http://localhost:${PORT}/swagger`,
        },
        'AI Document Platform server started',
      );
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');
  try {
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (import.meta.main) {
  start();
}
