# Data Model: AI Document Platform

**Feature**: 001-ai-document-platform
**Date**: 2026-05-19

## Entity Relationship Overview

```
User (1) ─────────────────────── (N) Document
Document (1) ──────────────────── (N) DocumentChunk
DocumentChunk (1) ─────────────── (1) Embedding
Document (1) ──────────────────── (N) AIProcessingJob
User (1) ──────────────────────── (N) SearchHistory
```

---

## Entity: Document

**Purpose**: Represents an uploaded file and its processing lifecycle.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, generated | Unique document identifier |
| userId | UUID | FK → User.id, NOT NULL | Owner of the document |
| filename | VARCHAR(512) | NOT NULL | Original uploaded filename |
| mimeType | VARCHAR(128) | NOT NULL | MIME type (e.g., `application/pdf`) |
| fileSize | BIGINT | NOT NULL, > 0 | File size in bytes |
| status | ENUM | NOT NULL, default `pending` | `pending` \| `processing` \| `indexed` \| `failed` |
| pageCount | INTEGER | nullable | Number of pages (PDF/DOCX only) |
| wordCount | INTEGER | nullable | Approximate word count after extraction |
| language | VARCHAR(32) | nullable | Detected document language |
| tags | TEXT[] | default `{}` | User-defined tags for metadata filtering |
| metadata | JSONB | default `{}` | Arbitrary document-level metadata |
| contentHash | VARCHAR(64) | UNIQUE per userId | SHA-256 of file content (dedup guard) |
| chunkingStrategy | VARCHAR(64) | default `recursive` | Strategy used: `recursive`, `semantic`, `token` |
| chunkSize | INTEGER | default 512 | Target chunk size in tokens |
| chunkOverlap | INTEGER | default 50 | Overlap tokens between adjacent chunks |
| embeddingModel | VARCHAR(128) | NOT NULL | e.g., `text-embedding-3-small` |
| embeddingDimension | INTEGER | NOT NULL | Vector dimension (e.g., 1536) |
| createdAt | TIMESTAMP | NOT NULL, default now() | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, auto-updated | Last modification timestamp |
| indexedAt | TIMESTAMP | nullable | When status transitioned to `indexed` |

**State transitions**: `pending` → `processing` → `indexed` | `failed`
**Re-index**: Resets status to `pending`, deletes existing chunks/embeddings, re-creates job.

---

## Entity: DocumentChunk

**Purpose**: A segment of a document's extracted text, linked to its embedding.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, generated | Unique chunk identifier |
| documentId | UUID | FK → Document.id, ON DELETE CASCADE | Parent document |
| chunkIndex | INTEGER | NOT NULL, >= 0 | Position of chunk within document |
| content | TEXT | NOT NULL | Extracted text content of the chunk |
| contentTsv | TSVECTOR | generated | Full-text search vector (auto-generated from content) |
| pageNumber | INTEGER | nullable | Page number where chunk starts (PDF/DOCX) |
| startChar | INTEGER | nullable | Character offset start in original text |
| endChar | INTEGER | nullable | Character offset end in original text |
| tokenCount | INTEGER | NOT NULL | Number of tokens in this chunk |
| metadata | JSONB | default `{}` | Chunk-level metadata (section title, heading, etc.) |
| createdAt | TIMESTAMP | NOT NULL, default now() | Creation timestamp |

**Indexes**:
- `(documentId, chunkIndex)` — for ordered chunk retrieval
- `USING GIN (contentTsv)` — for full-text keyword search

---

## Entity: Embedding

**Purpose**: Stores the vector representation of a DocumentChunk.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, generated | Unique embedding identifier |
| chunkId | UUID | FK → DocumentChunk.id, ON DELETE CASCADE, UNIQUE | One embedding per chunk |
| documentId | UUID | FK → Document.id, ON DELETE CASCADE | Denormalized for efficient filtering |
| vector | vector(N) | NOT NULL | The embedding vector (dimension from Document.embeddingDimension) |
| model | VARCHAR(128) | NOT NULL | Embedding model used |
| provider | VARCHAR(64) | NOT NULL | Provider: `openai`, `huggingface`, `local` |
| createdAt | TIMESTAMP | NOT NULL, default now() | Creation timestamp |

**Indexes**:
- `USING hnsw (vector vector_cosine_ops) WITH (m = 16, ef_construction = 64)` — ANN search
- `(documentId)` — for document-scoped similarity queries

---

## Entity: AIProcessingJob

**Purpose**: Tracks the lifecycle of an asynchronous document processing task.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, generated | Unique job identifier |
| documentId | UUID | FK → Document.id, ON DELETE CASCADE | Document being processed |
| userId | UUID | FK → User.id | Job owner |
| status | ENUM | NOT NULL, default `pending` | `pending` \| `processing` \| `completed` \| `failed` \| `retrying` |
| stage | VARCHAR(64) | nullable | Current pipeline stage: `parsing`, `chunking`, `embedding`, `storing` |
| progress | INTEGER | default 0 | Percentage complete (0–100) |
| totalChunks | INTEGER | nullable | Total chunks to embed |
| processedChunks | INTEGER | default 0 | Chunks embedded so far |
| errorMessage | TEXT | nullable | Last error message if status is `failed` |
| retryCount | INTEGER | default 0 | Number of retry attempts |
| maxRetries | INTEGER | default 3 | Maximum allowed retries |
| startedAt | TIMESTAMP | nullable | When processing began |
| completedAt | TIMESTAMP | nullable | When job finished (success or final failure) |
| createdAt | TIMESTAMP | NOT NULL, default now() | Job creation time |

---

## Entity: SearchHistory (Optional)

**Purpose**: Audit log of semantic search queries for observability and analytics.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, generated | Unique search record |
| userId | UUID | FK → User.id | User who performed the search |
| query | TEXT | NOT NULL | Raw search query text |
| queryEmbedding | vector(N) | nullable | Embedding of the query vector |
| searchType | ENUM | NOT NULL | `semantic` \| `hybrid` \| `keyword` |
| topK | INTEGER | NOT NULL | k value requested |
| resultCount | INTEGER | NOT NULL | Actual results returned |
| latencyMs | INTEGER | NOT NULL | Query latency in milliseconds |
| filtersApplied | JSONB | default `{}` | Metadata filters used |
| createdAt | TIMESTAMP | NOT NULL, default now() | Query timestamp |

---

## Value Objects

| Name | Fields | Rules |
|---|---|---|
| `FileType` | `extension: string`, `mimeType: string` | Must be one of: pdf, docx, txt, md, csv, json, html |
| `ChunkingConfig` | `strategy`, `chunkSize`, `chunkOverlap` | chunkSize 64–2048, overlap < chunkSize |
| `EmbeddingConfig` | `provider`, `model`, `dimension` | dimension must match model specification |
| `SimilarityScore` | `value: number` | Must be in range [0, 1] |
| `SearchFilter` | `field`, `operator`, `value` | operator: `eq`, `in`, `gte`, `lte`, `contains` |

---

## Prisma Schema (excerpt)

```prisma
model Document {
  id                  String            @id @default(uuid())
  userId              String
  filename            String
  mimeType            String
  fileSize            BigInt
  status              DocumentStatus    @default(PENDING)
  pageCount           Int?
  wordCount           Int?
  language            String?
  tags                String[]          @default([])
  metadata            Json              @default("{}")
  contentHash         String
  chunkingStrategy    String            @default("recursive")
  chunkSize           Int               @default(512)
  chunkOverlap        Int               @default(50)
  embeddingModel      String
  embeddingDimension  Int
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  indexedAt           DateTime?
  chunks              DocumentChunk[]
  jobs                AIProcessingJob[]

  @@unique([userId, contentHash])
  @@index([userId, status])
}

model DocumentChunk {
  id          String    @id @default(uuid())
  documentId  String
  chunkIndex  Int
  content     String
  pageNumber  Int?
  startChar   Int?
  endChar     Int?
  tokenCount  Int
  metadata    Json      @default("{}")
  createdAt   DateTime  @default(now())
  document    Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  embedding   Embedding?

  @@index([documentId, chunkIndex])
}

// Embedding uses raw SQL for pgvector support (Prisma does not natively support vector type)
// Managed via raw migration SQL

enum DocumentStatus {
  PENDING
  PROCESSING
  INDEXED
  FAILED
}
```

> **Note**: The `Embedding.vector` field uses `vector(N)` which requires a raw Prisma migration. The `contentTsv` tsvector column on `DocumentChunk` is also managed via raw SQL migration.
