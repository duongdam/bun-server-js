-- Dimension must match EMBEDDING_PROVIDER (384 for huggingface/local MiniLM, 1536 for OpenAI small).
-- Default 384; override with: EMBEDDING_DIMENSION=1536 bunx prisma migrate deploy

DROP INDEX IF EXISTS "embeddings_vector_hnsw_idx";

ALTER TABLE "embeddings"
  ALTER COLUMN "vector" TYPE vector(384) USING "vector"::vector(384);

CREATE INDEX "embeddings_vector_hnsw_idx"
  ON "embeddings"
  USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
