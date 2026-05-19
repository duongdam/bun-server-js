import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'ai-document-platform',
    version: process.env['npm_package_version'] ?? '1.0.0',
  },
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.apiKey', '*.secret'],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with a persistent context (e.g., requestId, userId).
 */
export function createRequestLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
