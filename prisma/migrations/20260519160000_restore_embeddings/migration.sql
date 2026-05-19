-- Restore pgvector embeddings table (dropped by 20260519043212; not in Prisma schema)
-- IDs are TEXT to match documents / document_chunks after Prisma migrate

CREATE TABLE IF NOT EXISTS "embeddings" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "chunkId"    TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "vector"     vector(384) NOT NULL,
  "model"      VARCHAR(128) NOT NULL,
  "provider"   VARCHAR(64) NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "embeddings_chunkId_key" UNIQUE ("chunkId"),
  CONSTRAINT "embeddings_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "embeddings_vector_hnsw_idx"
  ON "embeddings"
  USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "embeddings_documentId_idx" ON "embeddings" ("documentId");

-- Full-text search column (dropped by 20260519043212)
ALTER TABLE "document_chunks"
  ADD COLUMN IF NOT EXISTS "contentTsv" TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX IF NOT EXISTS "document_chunks_contentTsv_idx"
  ON "document_chunks" USING GIN ("contentTsv");

CREATE INDEX IF NOT EXISTS "document_chunks_content_trgm_idx"
  ON "document_chunks" USING GIN ("content" gin_trgm_ops);
