/**
 * Aligns embeddings.vector column with EMBEDDING_DIMENSION / active provider.
 * Run after changing EMBEDDING_PROVIDER in .env:
 *   bun run scripts/sync-embedding-dimension.ts
 */
import { createEmbeddingProvider } from '../src/modules/embedding/infrastructure/create-embedding-provider';
import { prisma } from '../src/shared/infrastructure/prisma/client';

const dim =
  Number.parseInt(process.env.EMBEDDING_DIMENSION ?? '', 10) ||
  createEmbeddingProvider().dimension;

await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS embeddings_vector_hnsw_idx');
await prisma.$executeRawUnsafe(
  `ALTER TABLE embeddings ALTER COLUMN vector TYPE vector(${dim}) USING vector::vector(${dim})`,
);
await prisma.$executeRawUnsafe(`
  CREATE INDEX embeddings_vector_hnsw_idx
  ON embeddings USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
`);

console.log(`embeddings.vector set to vector(${dim})`);

await prisma.$disconnect();
