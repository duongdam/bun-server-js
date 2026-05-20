/**
 * Loaded before unit tests so modules that construct Prisma at import time
 * (e.g. `src/shared/infrastructure/prisma/client.ts`) see valid datasource URLs.
 * Values are placeholders; tests that hit the DB should use integration/e2e suites.
 */
const placeholderDb =
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public';
if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = placeholderDb;
}
if (!process.env.REDIS_URL?.trim()) {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
}
