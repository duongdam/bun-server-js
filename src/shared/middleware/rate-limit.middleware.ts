import { redis } from '../infrastructure/redis/client';
import { logger } from '../infrastructure/logger/pino.logger';

interface RateLimitOptions {
  windowMs: number; // time window in milliseconds
  maxRequests: number; // max requests per window per key
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
  maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? '100', 10),
};

/**
 * Redis-backed sliding window rate limiter.
 * Uses a sorted set per key to count requests within the window.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_OPTIONS,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const redisKey = `rl:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, '-inf', windowStart); // remove old entries
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`); // add current request
  pipeline.zcard(redisKey); // count requests in window
  pipeline.pexpire(redisKey, options.windowMs); // auto-expire

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;
  const allowed = count <= options.maxRequests;
  const resetAt = new Date(now + options.windowMs);

  if (!allowed) {
    logger.warn({ key, count, limit: options.maxRequests }, 'Rate limit exceeded');
  }

  return {
    allowed,
    remaining: Math.max(0, options.maxRequests - count),
    resetAt,
  };
}

/**
 * Elysia-compatible rate limit middleware handler.
 * Returns 429 with Retry-After header when limit is exceeded.
 */
export async function rateLimitMiddleware(
  userId: string,
  set: { status?: number; headers?: Record<string, string> },
): Promise<{ error: string; message: string } | undefined> {
  const result = await checkRateLimit(`user:${userId}`);

  // Always set rate limit headers
  set.headers = {
    ...set.headers,
    'X-RateLimit-Limit': String(DEFAULT_OPTIONS.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
  };

  if (!result.allowed) {
    set.status = 429;
    set.headers['Retry-After'] = String(Math.ceil(DEFAULT_OPTIONS.windowMs / 1000));
    return {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please retry after the reset period.',
    };
  }

  return undefined;
}
