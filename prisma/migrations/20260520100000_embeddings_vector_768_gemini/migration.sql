-- Gemini default embedding (`gemini-embedding-2` truncated to 768) uses 768 dimensions.
-- Apply after switching EMBEDDING_PROVIDER to gemini; re-index existing documents if dimension changed.

DROP INDEX IF EXISTS "embeddings_vector_hnsw_idx";

ALTER TABLE "embeddings"
  ALTER COLUMN "vector" TYPE vector(768) USING "vector"::vector(768);

CREATE INDEX "embeddings_vector_hnsw_idx"
  ON "embeddings"
  USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
