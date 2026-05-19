-- ─────────────────────────────────────────────────────────────
-- Migration: 001_init
-- AI Document Platform — Initial Schema with pgvector
-- ─────────────────────────────────────────────────────────────

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for trigram similarity in hybrid search

-- 2. Enums
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');
CREATE TYPE "SearchType" AS ENUM ('SEMANTIC', 'HYBRID', 'KEYWORD');

-- 3. documents table
CREATE TABLE "documents" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"             TEXT NOT NULL,
  "filename"           VARCHAR(512) NOT NULL,
  "mimeType"           VARCHAR(128) NOT NULL,
  "fileSize"           BIGINT NOT NULL,
  "status"             "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "pageCount"          INTEGER,
  "wordCount"          INTEGER,
  "language"           VARCHAR(32),
  "tags"               TEXT[] NOT NULL DEFAULT '{}',
  "metadata"           JSONB NOT NULL DEFAULT '{}',
  "contentHash"        VARCHAR(64) NOT NULL,
  "chunkingStrategy"   VARCHAR(64) NOT NULL DEFAULT 'recursive',
  "chunkSize"          INTEGER NOT NULL DEFAULT 512,
  "chunkOverlap"       INTEGER NOT NULL DEFAULT 50,
  "embeddingModel"     VARCHAR(128) NOT NULL,
  "embeddingDimension" INTEGER NOT NULL,
  "embeddingProvider"  VARCHAR(64) NOT NULL DEFAULT 'openai',
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "indexedAt"          TIMESTAMPTZ,
  CONSTRAINT "documents_userId_contentHash_key" UNIQUE ("userId", "contentHash")
);

CREATE INDEX "documents_userId_status_idx" ON "documents" ("userId", "status");
CREATE INDEX "documents_userId_createdAt_idx" ON "documents" ("userId", "createdAt" DESC);

-- auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "documents_updated_at"
  BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. document_chunks table
CREATE TABLE "document_chunks" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId"  UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "chunkIndex"  INTEGER NOT NULL,
  "content"     TEXT NOT NULL,
  "contentTsv"  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "pageNumber"  INTEGER,
  "startChar"   INTEGER,
  "endChar"     INTEGER,
  "tokenCount"  INTEGER NOT NULL,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "document_chunks_documentId_chunkIndex_idx" ON "document_chunks" ("documentId", "chunkIndex");
CREATE INDEX "document_chunks_contentTsv_idx" ON "document_chunks" USING GIN ("contentTsv");
CREATE INDEX "document_chunks_content_trgm_idx" ON "document_chunks" USING GIN ("content" gin_trgm_ops);

-- 5. embeddings table (pgvector — NOT managed by Prisma schema directly)
CREATE TABLE "embeddings" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "chunkId"    UUID NOT NULL REFERENCES "document_chunks"("id") ON DELETE CASCADE,
  "documentId" UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "vector"     vector(1536) NOT NULL,
  "model"      VARCHAR(128) NOT NULL,
  "provider"   VARCHAR(64) NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "embeddings_chunkId_key" UNIQUE ("chunkId")
);

-- HNSW index for approximate nearest-neighbor cosine similarity search
-- m=16: number of connections per layer (higher = better recall, more memory)
-- ef_construction=64: beam width during index build (higher = better recall, slower build)
CREATE INDEX "embeddings_vector_hnsw_idx"
  ON "embeddings"
  USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "embeddings_documentId_idx" ON "embeddings" ("documentId");

-- 6. ai_processing_jobs table
CREATE TABLE "ai_processing_jobs" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId"      UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "userId"          TEXT NOT NULL,
  "status"          "JobStatus" NOT NULL DEFAULT 'PENDING',
  "stage"           VARCHAR(64),
  "progress"        INTEGER NOT NULL DEFAULT 0,
  "totalChunks"     INTEGER,
  "processedChunks" INTEGER NOT NULL DEFAULT 0,
  "errorMessage"    TEXT,
  "retryCount"      INTEGER NOT NULL DEFAULT 0,
  "maxRetries"      INTEGER NOT NULL DEFAULT 3,
  "startedAt"       TIMESTAMPTZ,
  "completedAt"     TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "ai_processing_jobs_documentId_idx" ON "ai_processing_jobs" ("documentId");
CREATE INDEX "ai_processing_jobs_userId_status_idx" ON "ai_processing_jobs" ("userId", "status");

-- 7. search_history table
CREATE TABLE "search_history" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         TEXT NOT NULL,
  "query"          TEXT NOT NULL,
  "searchType"     "SearchType" NOT NULL,
  "topK"           INTEGER NOT NULL,
  "resultCount"    INTEGER NOT NULL,
  "latencyMs"      INTEGER NOT NULL,
  "filtersApplied" JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "search_history_userId_createdAt_idx" ON "search_history" ("userId", "createdAt" DESC);
