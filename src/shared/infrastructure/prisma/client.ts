import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/pino.logger';

// Singleton Prisma client with connection pooling
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
    datasources: {
      db: {
        url: process.env['DATABASE_URL'] || undefined,
      },
    } as any,
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log slow queries in development
if (process.env['NODE_ENV'] === 'development') {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 100) {
      logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
    }
  });
}

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error({ message: e.message }, 'Prisma error');
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
