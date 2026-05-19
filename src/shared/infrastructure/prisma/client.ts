import { type Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../logger/pino.logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

/**
 * Prisma log configuration
 */
const logConfig = [
  {
    emit: 'event' as const,
    level: 'query' as const,
  },
  {
    emit: 'event' as const,
    level: 'error' as const,
  },
  {
    emit: 'event' as const,
    level: 'warn' as const,
  },
] satisfies Prisma.LogDefinition[];

/**
 * Create Prisma client
 */
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new PrismaClient({
    log: logConfig,

    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};

/**
 * Singleton Prisma client
 */
export const prisma = globalThis.__prisma__ ?? createPrismaClient();

/** Client typed for Prisma event logging (`$on('query' | 'error')`). */
const prismaWithEvents = prisma as unknown as {
  $on(event: 'query', callback: (event: Prisma.QueryEvent) => void): void;
  $on(event: 'error', callback: (event: Prisma.LogEvent) => void): void;
};

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__ = prisma;
}

/**
 * Query logging
 */
if (process.env.NODE_ENV === 'development') {
  prismaWithEvents.$on('query', (event: Prisma.QueryEvent) => {
    if (event.duration > 100) {
      logger.warn(
        {
          query: event.query,
          params: event.params,
          duration: event.duration,
          target: event.target,
        },
        'Slow query detected',
      );
    }
  });
}

/**
 * Error logging
 */
prismaWithEvents.$on('error', (event: Prisma.LogEvent) => {
  logger.error(
    {
      message: event.message,
      target: event.target,
    },
    'Prisma error',
  );
});

/**
 * Connect database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();

    logger.info('Database connected');
  } catch (error) {
    logger.error({ error }, 'Failed to connect database');

    throw error;
  }
}

/**
 * Disconnect database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();

  logger.info('Database disconnected');
}
