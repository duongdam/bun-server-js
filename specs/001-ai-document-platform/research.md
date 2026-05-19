# Research: AI Document Platform

**Feature**: 001-ai-document-platform
**Date**: 2026-05-19

## 1. Runtime & Framework

**Decision**: Bun.js v1.3.14 + Elysia framework
**Rationale**: Elysia is designed for Bun and offers end-to-end type-safety with OpenAPI generation out of the box. It has excellent performance and first-class Bun support. Hono is also compatible but Elysia has tighter Bun integration.
**Alternatives considered**: Hono (cross-runtime, slightly less integrated with Bun), Fastify (Node-first, requires adapter).

## 2. DDD Project Structure

**Decision**: Vertical-slice DDD with `src/modules/<domain>/` grouping domain, application, and infrastructure layers per bounded context. Shared kernel in `src/shared/`.
**Rationale**: Groups all code for a domain feature together (domain entity, repository interface, use case, Prisma repository, controller) for maximum cohesion. Avoids deep horizontal folder nesting that makes cross-context navigation difficult.
**Alternatives considered**: Strict horizontal layering (`src/domain/`, `src/application/`, `src/infrastructure/`) — rejected because it spreads related files across distant folders.

## 3. File Parsing Libraries

**Decision**:
- **PDF**: `pdf-parse` (pure JS, works with Bun)
- **DOCX**: `mammoth` (high-quality text extraction with structure hints)
- **HTML**: `node-html-parser` or `cheerio`
- **CSV/JSON**: Native Bun APIs
- **TXT/Markdown**: Native string handling
**Rationale**: All libraries are Node.js-compatible and work in Bun runtime. No native binary dependencies that would break in Docker.
**Alternatives considered**: `pdfjs-dist` (heavier, browser-oriented), `docx2html` (less maintained).

## 4. Chunking Strategy

**Decision**: Implement a `ChunkingService` with three strategies, selectable per request:
1. **RecursiveTextSplitter**: Split by paragraph → sentence → word with configurable `chunkSize` (default 512 tokens) and `chunkOverlap` (default 50 tokens).
2. **SemanticChunker**: Use sentence embeddings to detect topic boundaries (split when cosine similarity drops below threshold).
3. **TokenAwareChunker**: Hard token-count aware split using `tiktoken` or Bun's native tokenizer utilities.
**Rationale**: Recursive splitting is the safest default. Semantic chunking produces higher-quality retrieval at the cost of a pre-embedding step. Token-aware chunking is critical for LLM context window management.
**Alternatives considered**: Fixed-size character splitting — rejected as it breaks mid-sentence and degrades retrieval quality.

## 5. Embedding Providers

**Decision**: Pluggable provider architecture via `IEmbeddingProvider` interface:
- **OpenAIEmbeddingProvider**: `text-embedding-3-small` (1536-dim), `text-embedding-3-large` (3072-dim)
- **HuggingFaceEmbeddingProvider**: Inference API — `sentence-transformers/all-MiniLM-L6-v2` (384-dim)
- **LocalEmbeddingProvider**: Transformers.js with `Xenova/all-MiniLM-L6-v2`
**Rationale**: Provider selection via environment variable with runtime DI. Batch embedding (up to 2048 chunks per API call for OpenAI) for performance.
**Alternatives considered**: LangChain.js embedding wrappers — added as an option but direct SDK usage gives better control and lower dependency surface.

## 6. pgvector Schema & HNSW Indexing

**Decision**:
- Use `vector(1536)` as default column type (adjustable via migration for different models)
- HNSW index: `CREATE INDEX ON embeddings USING hnsw (vector ops_type cosine_ops) WITH (m = 16, ef_construction = 64)`
- Cosine distance operator: `<=>` for similarity queries
- Hybrid search: `tsvector` full-text column on `document_chunks.content` combined with vector score via weighted RRF (Reciprocal Rank Fusion)
**Rationale**: HNSW provides the best recall/speed trade-off for approximate nearest-neighbor search at scale. IVFFlat is faster to build but has lower recall.
**Alternatives considered**: IVFFlat — rejected for lower recall on smaller corpora. Pinecone/Weaviate — rejected to avoid external vector DB dependency.

## 7. Background Job Queue

**Decision**: BullMQ with Redis
**Rationale**: BullMQ is the de-facto standard for Node/Bun job queues. Supports retries, backoff, concurrency control, job progress, and a web UI (Bull Board). Well-maintained and works with Bun.
**Alternatives considered**: `pg-boss` (Postgres-backed) — simpler deployment but weaker scheduling/retry ergonomics. Native Bun Workers — no retry/persistence.

## 8. API Design

**Decision**: REST API with Elysia + OpenAPI plugin for auto-generated Swagger UI
**Rationale**: RESTful API is the most interoperable interface. Elysia's `@elysiajs/swagger` generates OpenAPI 3.0 docs automatically from type definitions.
**Alternatives considered**: GraphQL (too heavy for file upload and streaming use cases), tRPC (good for full-stack TS but poor REST interop for external consumers).

## 9. Authentication

**Decision**: JWT (HS256 / RS256) via `@elysiajs/jwt` plugin, with middleware applied at router level. RBAC roles: `admin`, `user`, `readonly`.
**Rationale**: Stateless, horizontally scalable, standard. Elysia has a first-party JWT plugin.
**Alternatives considered**: Session-based auth — stateful, requires sticky sessions or Redis session store.

## 10. Observability

**Decision**: Pino for structured JSON logging. OpenTelemetry-compatible tracing stubs. Health check endpoint at `/health`.
**Rationale**: Pino is the fastest Node.js logger and produces structured JSON compatible with all log aggregation platforms.
**Alternatives considered**: Winston — slower and more complex configuration.
