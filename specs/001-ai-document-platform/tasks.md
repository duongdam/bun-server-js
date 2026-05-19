---
description: "Task list for AI Document Platform implementation"
---

# Tasks: AI Document Platform

**Input**: Design documents from `specs/001-ai-document-platform/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Tests**: Not explicitly requested — test tasks are omitted unless added later via `/speckit-checklist`.

**Organization**: Tasks grouped by user story for independent implementation and delivery.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1–US4)
- Paths follow plan.md structure: `src/modules/<domain>/...`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Bootstrap the Bun.js project, install all dependencies, and configure tooling before any domain code is written.

- [x] T001 Initialize Bun.js TypeScript project (`bun init`) with `tsconfig.json` (strict mode) and `package.json` scripts (`dev`, `build`, `worker`, `test`, `db:migrate`, `db:seed`)
- [x] T002 [P] Install all dependencies: `elysia @elysiajs/swagger @elysiajs/jwt @elysiajs/cors`, `prisma @prisma/client`, `bullmq ioredis`, `openai @huggingface/inference @xenova/transformers`, `pdf-parse mammoth node-html-parser`, `pino pino-pretty`, `zod`
- [x] T003 [P] Create `.env.example` with all required environment variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `PORT`, `NODE_ENV`
- [x] T004 [P] Configure `biome.json` (or `.eslintrc`) for TypeScript linting and formatting standards
- [x] T005 [P] Create `docker-compose.yml` with `postgres` (pgvector image: `pgvector/pgvector:pg15`) and `redis` services with health checks and volume mounts
- [x] T006 [P] Create `Dockerfile` with multi-stage build: `bun install --frozen-lockfile` → copy source → `bun run build` for production image

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: Complete Phase 2 fully before starting any user story phase.

- [x] T007 Create Prisma schema at `prisma/schema.prisma` with `Document`, `DocumentChunk`, `AIProcessingJob`, `SearchHistory` models and enums (`DocumentStatus`, `JobStatus`) per `data-model.md`
- [x] T008 Create initial migration SQL at `prisma/migrations/001_init/migration.sql`: enable `pgvector` extension, create `embeddings` table with `vector(1536)` column, create HNSW index (`USING hnsw (vector vector_cosine_ops)`), add `contentTsv` tsvector column on `document_chunks` with GIN index
- [x] T009 [P] Create `src/shared/infrastructure/prisma/client.ts` — singleton Prisma client with connection pooling config
- [x] T010 [P] Create `src/shared/infrastructure/redis/client.ts` — singleton ioredis client with connection error handling
- [x] T011 [P] Create `src/shared/infrastructure/logger/pino.logger.ts` — structured JSON Pino logger with request ID context
- [x] T012 [P] Create `src/shared/domain/base.entity.ts` — abstract base entity with `id: UUID`, `createdAt`, `updatedAt` fields
- [x] T013 [P] Create `src/shared/domain/base.repository.interface.ts` — generic repository interface (`findById`, `findAll`, `save`, `delete`)
- [x] T014 [P] Create `src/shared/domain/domain-event.ts` — base domain event class with `occurredOn` timestamp and event type
- [x] T015 [P] Create `src/shared/middleware/error-handler.middleware.ts` — global Elysia error handler mapping domain errors to HTTP status codes
- [x] T016 [P] Create `src/shared/middleware/auth.middleware.ts` — JWT validation middleware using `@elysiajs/jwt`, extracting `userId` and `role` claims
- [x] T017 [P] Create `src/shared/middleware/rate-limit.middleware.ts` — request rate limiter (Redis-backed sliding window, 100 req/min per user)
- [x] T018 Create `src/app.ts` — Elysia app bootstrap: register Swagger (`/swagger`), CORS, JWT plugin, error handler, rate limiter; mount all module routers under `/api/v1`
- [x] T019 Create `src/worker.ts` — BullMQ worker entrypoint: connect Redis, register `document-processing` queue worker, handle graceful shutdown
- [x] T020 [P] Create `prisma/seed.ts` — seed script creating a test user and one sample document for local development

**Checkpoint**: Run `bun run db:migrate && bun run dev` — server starts at `:3000`, `/health` returns 200, `/swagger` renders OpenAPI docs.

---

## Phase 3: User Story 1 — Upload & Index Document (Priority: P1) 🎯 MVP

**Goal**: A user uploads any supported file format. The platform parses it, chunks the text, generates embeddings, and stores vectors — making the document fully searchable.

**Independent Test**: Upload `sample.pdf` via `POST /api/v1/documents/upload`, poll `GET /api/v1/jobs/:id` until `status: "completed"`, then verify the document appears in `GET /api/v1/documents` with `status: "indexed"` and that rows exist in `document_chunks` and embeddings.

- [x] T021 [P] [US1] Create `src/modules/document/domain/value-objects/file-type.vo.ts` — `FileType` value object validating extension + MIME type against allowed list (pdf, docx, txt, md, csv, json, html)
- [x] T022 [P] [US1] Create `src/modules/document/domain/value-objects/chunking-config.vo.ts` — `ChunkingConfig` value object with `strategy` (recursive|semantic|token), `chunkSize` (64–2048), `chunkOverlap` (< chunkSize)
- [x] T023 [P] [US1] Create `src/modules/document/domain/entities/document.entity.ts` — `Document` domain entity extending `BaseEntity`; fields per `data-model.md`; state machine methods: `markProcessing()`, `markIndexed()`, `markFailed(error)`; `domainEvents` array
- [x] T024 [P] [US1] Create `src/modules/document/domain/events/document-uploaded.event.ts` — `DocumentUploadedEvent` domain event carrying `documentId`, `filename`, `mimeType`, `userId`
- [x] T025 [P] [US1] Create `src/modules/document/domain/repositories/document.repository.interface.ts` — `IDocumentRepository` interface: `findById`, `findByUserId` (paginated), `findByContentHash`, `save`, `delete`, `updateStatus`

### Infrastructure — Parsers

- [x] T026 [P] [US1] Create `src/modules/document/infrastructure/parsers/pdf.parser.ts` — PDF text + page-aware extraction using `pdf-parse`; returns `{ text, pageCount, metadata }`
- [x] T027 [P] [US1] Create `src/modules/document/infrastructure/parsers/docx.parser.ts` — DOCX extraction using `mammoth`; preserve heading structure in metadata
- [x] T028 [P] [US1] Create `src/modules/document/infrastructure/parsers/html.parser.ts` — HTML extraction using `node-html-parser`; strip scripts/styles, preserve semantic structure
- [x] T029 [P] [US1] Create `src/modules/document/infrastructure/parsers/text.parser.ts` — unified parser for TXT, Markdown, CSV, JSON; CSV → joined rows; JSON → pretty-printed string

### Domain Layer — Chunking Service

- [x] T030 [US1] Create `src/modules/document/domain/services/chunking.service.ts` — `ChunkingService` with three strategies:
  - `RecursiveTextSplitter`: paragraph → sentence → word split with configurable `chunkSize` and `chunkOverlap`
  - `TokenAwareChunker`: hard token-count split (use `gpt-tokenizer` or character approximation)
  - `SemanticChunker`: split at sentence boundaries where inter-sentence similarity drops; requires pre-computed similarity (stub for Phase 3, full impl Phase 4)
  Returns `Array<{ content, chunkIndex, startChar, endChar, tokenCount, pageNumber?, metadata }>`

### Infrastructure — Embedding Providers

- [x] T031 [P] [US1] Create `src/modules/embedding/infrastructure/providers/embedding-provider.interface.ts` — `IEmbeddingProvider` interface: `embed(texts: string[]): Promise<number[][]>`, `model: string`, `dimension: number`, `provider: string`
- [x] T032 [P] [US1] Create `src/modules/embedding/infrastructure/providers/openai.provider.ts` — `OpenAIEmbeddingProvider` implementing `IEmbeddingProvider`; batch up to 2048 texts per API call; handle rate limits with exponential backoff
- [x] T033 [P] [US1] Create `src/modules/embedding/infrastructure/providers/huggingface.provider.ts` — `HuggingFaceEmbeddingProvider` using `@huggingface/inference` Inference API; configurable model (default: `sentence-transformers/all-MiniLM-L6-v2`)
- [x] T034 [P] [US1] Create `src/modules/embedding/infrastructure/providers/local.provider.ts` — `LocalEmbeddingProvider` using `@xenova/transformers` pipeline; lazy-load model on first use
- [x] T035 [US1] Create `src/modules/embedding/domain/services/embedding.service.ts` — `EmbeddingService` that resolves `IEmbeddingProvider` by `EMBEDDING_PROVIDER` env var (factory pattern); exposes `embedBatch(chunks)` with retry logic

### Infrastructure — Repositories

- [x] T036 [US1] Create `src/modules/document/infrastructure/prisma-document.repository.ts` — `PrismaDocumentRepository` implementing `IDocumentRepository`; use Prisma transactions for multi-table writes
- [x] T037 [US1] Create `src/modules/embedding/infrastructure/prisma-embedding.repository.ts` — `PrismaEmbeddingRepository`; use raw Prisma `$executeRaw` for vector INSERT (pgvector syntax: `::vector`)

### Background Job — Document Processing Pipeline

- [x] T038 [US1] Create `src/modules/job/domain/entities/processing-job.entity.ts` — `AIProcessingJob` entity with status state machine and progress tracking fields
- [x] T039 [US1] Create `src/modules/job/infrastructure/prisma-job.repository.ts` — `PrismaJobRepository` with `create`, `updateProgress`, `markCompleted`, `markFailed`, `findById`
- [x] T040 [US1] Create `src/modules/job/infrastructure/bullmq.queue.ts` — `DocumentQueue` wrapper: exports `addDocumentJob(payload)`, `getJob(id)`; queue name `document-processing`
- [x] T041 [US1] Create `src/modules/job/infrastructure/document-processing.worker.ts` — BullMQ worker processing `document-processing` jobs; orchestrates full pipeline:
  1. Update job stage → `parsing`; call appropriate file parser
  2. Update job stage → `chunking`; call `ChunkingService`
  3. Update job stage → `embedding`; batch-embed all chunks via `EmbeddingService`
  4. Update job stage → `storing`; save chunks + embeddings to DB via repositories
  5. Mark document `indexed`; mark job `completed`
  6. On error: increment `retryCount`; if < `maxRetries` re-queue with backoff; else mark `failed`

### Application Layer

- [x] T042 [US1] Create `src/modules/document/application/use-cases/upload-document.use-case.ts` — `UploadDocumentUseCase`: validate file (type, size), compute SHA-256 content hash, check for duplicate, persist `Document` with status `pending`, enqueue job via `DocumentQueue`, emit `DocumentUploadedEvent`
- [x] T043 [US1] Create `src/modules/document/application/dtos/upload-document.dto.ts` — Zod schema validating multipart upload fields; `chunkingStrategy`, `chunkSize`, `chunkOverlap`, `embeddingProvider`, `embeddingModel`, `tags`
- [x] T044 [US1] Create `src/modules/document/application/dtos/document-response.dto.ts` — `DocumentResponseDto` and `DocumentListResponseDto` mapping domain entity → API response shape per `contracts/api.md`
- [x] T045 [US1] Create `src/modules/job/application/use-cases/track-job.use-case.ts` — `TrackJobUseCase`: fetch job by ID, assert ownership (`userId` match), return job progress DTO

### Presentation Layer

- [x] T046 [US1] Create `src/modules/document/presentation/document.controller.ts` — Elysia controller: `POST /upload` (multipart), `GET /` (list), `GET /:id`, `DELETE /:id`; inject auth middleware; call use cases; return responses per API contract
- [x] T047 [US1] Create `src/modules/document/presentation/document.routes.ts` — register document controller routes under `/documents` prefix
- [x] T048 [US1] Create `src/modules/job/presentation/job.controller.ts` — Elysia controller: `GET /jobs/:id`; return job status/progress DTO
- [x] T049 [US1] Wire document and job routes into `src/app.ts` under `/api/v1`

**Checkpoint**: US1 is fully functional. Upload a PDF, poll job status, verify document indexed, chunks and embeddings in DB.

---

## Phase 4: User Story 2 — Semantic Search (Priority: P1)

**Goal**: Users submit a natural-language query and receive ranked document chunks by semantic similarity, with optional hybrid (keyword + vector) and metadata filtering modes.

**Independent Test**: Index at least one document (US1 complete), then `POST /api/v1/search` with `{"query": "financial risks", "topK": 5, "searchType": "hybrid"}` — verify response contains ranked results with `similarityScore` values between 0 and 1, and only chunks above the `similarityThreshold` are returned.

### Domain Layer — Search Service

- [x] T050 [P] [US2] Create `src/modules/search/domain/value-objects/search-filter.vo.ts` — `SearchFilter` value object: `field`, `operator` (eq|in|gte|lte|contains), `value`; Zod validation
- [x] T051 [US2] Create `src/modules/search/domain/services/search.service.ts` — `SearchService` coordinating search strategies:
  - `semanticSearch(queryVector, topK, threshold, filters)` → cosine similarity via pgvector `<=>` operator
  - `keywordSearch(queryText, filters)` → tsvector full-text with `ts_rank`
  - `hybridSearch(query, queryVector, topK, threshold, filters)` → Reciprocal Rank Fusion (RRF) of both score lists

### Infrastructure — Vector Search Repository

- [x] T052 [US2] Create `src/modules/search/infrastructure/pgvector-search.repository.ts` — `PgVectorSearchRepository` with raw Prisma SQL queries:
  - `semanticSearch`: `SELECT ... ORDER BY vector <=> $queryVector::vector LIMIT $k` with optional `WHERE documentId IN (...)` or tag filters
  - `hybridSearch`: CTEs for vector results + tsvector results → RRF merge → ranked output
  - `keywordSearch`: `WHERE contentTsv @@ plainto_tsquery($query)` with `ts_rank` ordering
  - All queries return `{ chunkId, documentId, filename, content, pageNumber, chunkIndex, similarityScore, rankScore }`

### Application Layer

- [x] T053 [US2] Create `src/modules/search/application/dtos/search-request.dto.ts` — Zod schema: `query` (string, min 1), `searchType` (semantic|hybrid|keyword, default semantic), `topK` (1–100, default 10), `similarityThreshold` (0–1, default 0.7), `filters` object
- [x] T054 [US2] Create `src/modules/search/application/dtos/search-result.dto.ts` — `SearchResultDto` and `SearchResponseDto` per `contracts/api.md` response shape
- [x] T055 [US2] Create `src/modules/search/application/use-cases/semantic-search.use-case.ts` — embed query text via `EmbeddingService`, call `SearchService.semanticSearch`, log to `SearchHistory`, return ranked results
- [x] T056 [US2] Create `src/modules/search/application/use-cases/hybrid-search.use-case.ts` — embed query text, call `SearchService.hybridSearch`, log to `SearchHistory`, return RRF-ranked results
- [x] T057 [US2] Create `src/modules/search/application/use-cases/keyword-search.use-case.ts` — call `SearchService.keywordSearch` (no embedding required), log to `SearchHistory`, return results

### Presentation Layer

- [x] T058 [US2] Create `src/modules/search/presentation/search.controller.ts` — Elysia controller: `POST /search` dispatching to correct use case based on `searchType`; apply auth middleware
- [x] T059 [US2] Create `src/modules/search/presentation/search.routes.ts` — register search routes under `/search` prefix
- [x] T060 [US2] Wire search routes into `src/app.ts`

**Checkpoint**: US1 + US2 both independently functional. Vector search returns ranked results; hybrid mode combines keyword and vector scores.

---

## Phase 5: User Story 3 — RAG Retrieval Endpoint (Priority: P2)

**Goal**: AI applications call a dedicated `/retrieval` endpoint and receive context chunks formatted for direct LLM injection, respecting a token budget.

**Independent Test**: `POST /api/v1/retrieval` with `{"query": "risk factors", "topK": 5, "maxTokens": 2048}` — verify response contains a `context` array with `text` and `source` fields, `totalTokens` ≤ `maxTokens`, and `sources` array with unique document references.

### Application Layer

- [x] T061 [P] [US3] Create `src/modules/search/application/dtos/retrieval-request.dto.ts` — Zod schema: `query`, `topK` (default 5), `maxTokens` (default 2048), `similarityThreshold` (default 0.65), `filters`
- [x] T062 [P] [US3] Create `src/modules/search/application/dtos/retrieval-response.dto.ts` — `RetrievalResponseDto`: `context[]` with `text`, `source` (documentId, filename, pageNumber, chunkIndex), `score`; `totalTokens`, `sources[]`
- [x] T063 [US3] Create `src/modules/search/application/use-cases/rag-retrieval.use-case.ts` — embed query, call `SearchService.semanticSearch` with threshold, greedily pack chunks into `maxTokens` budget (token-count each chunk), deduplicate by documentId for `sources`, return `RetrievalResponseDto`

### Presentation Layer

- [x] T064 [US3] Add `POST /retrieval` route to `src/modules/search/presentation/search.controller.ts` — call `RagRetrievalUseCase`; auth required
- [x] T065 [US3] Register retrieval route in `src/modules/search/presentation/search.routes.ts`

**Checkpoint**: US1 + US2 + US3 all functional. RAG retrieval respects token budget and returns LLM-ready context.

---

## Phase 6: User Story 4 — Document Management (Priority: P3)

**Goal**: Operators can list documents with pagination, view individual document metadata, re-index documents with new settings, and delete documents with full cascade cleanup.

**Independent Test**: Upload and index a document (US1), call `GET /api/v1/documents` and verify it appears, call `POST /api/v1/documents/:id/reindex` and verify a new job is queued and status resets to `pending`, call `DELETE /api/v1/documents/:id` and verify the document, its chunks, and embeddings are gone from the DB.

### Application Layer

- [x] T066 [P] [US4] Create `src/modules/document/application/queries/list-documents.query.ts` — `ListDocumentsQuery` with pagination (`page`, `limit`), `status` filter, `tags` filter; returns `{ data: Document[], total, page, totalPages }`
- [x] T067 [P] [US4] Create `src/modules/document/application/use-cases/delete-document.use-case.ts` — `DeleteDocumentUseCase`: assert ownership, delete document (cascade deletes chunks + embeddings via DB constraints), return `void`
- [x] T068 [US4] Create `src/modules/document/application/use-cases/reindex-document.use-case.ts` — `ReindexDocumentUseCase`: assert ownership, delete existing `DocumentChunk` and `Embedding` rows for document, update document `chunkingStrategy`/`embeddingModel` fields, reset status to `pending`, enqueue new job

### Presentation Layer — Add Missing Endpoints

- [x] T069 [US4] Add `POST /documents/:id/reindex` route to `src/modules/document/presentation/document.controller.ts`; Zod-validate body (new chunking/embedding settings); call `ReindexDocumentUseCase`
- [x] T070 [US4] Add `GET /documents/:id/chunks` paginated endpoint to document controller; return chunk list per API contract

**Checkpoint**: All 4 user stories independently functional. Full CRUD + search + RAG pipeline operational.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span all modules and harden the system for production.

- [x] T071 [P] Add `GET /health` endpoint in `src/app.ts` — check DB connectivity (`prisma.$queryRaw('SELECT 1')`), Redis ping, embedding provider availability; return JSON status per API contract
- [x] T072 [P] Add ADR documents in `docs/adr/`: `001-elysia-framework.md`, `002-pgvector-hnsw.md`, `003-bullmq-queue.md`, `004-chunking-strategies.md`
- [x] T073 [P] Add OpenAPI export script: `bun run build:docs` → write `docs/openapi.json` from Elysia Swagger plugin
- [x] T074 Add file size validation (reject > 100MB) and content-type validation in `upload-document.use-case.ts` (guard against MIME spoofing)
- [x] T075 Add duplicate document detection in `upload-document.use-case.ts` — return `409 Conflict` with `existingDocumentId` if SHA-256 hash already exists for the same user
- [x] T076 [P] Add `SearchHistory` writes to all search use cases (T055, T056, T057, T063) — log `query`, `searchType`, `topK`, `resultCount`, `latencyMs`, `filtersApplied`
- [x] T077 [P] Configure BullMQ concurrency (4 workers) and exponential backoff retry strategy (3 retries: 1s → 5s → 30s) in `src/modules/job/infrastructure/document-processing.worker.ts`
- [x] T078 [P] Add Pino request logging middleware to `src/app.ts` — log `method`, `path`, `statusCode`, `latencyMs`, `userId` per request
- [x] T079 Validate all environment variables at startup in `src/app.ts` using Zod — throw on missing required vars before server starts
- [x] T080 [P] Update `README.md` — project overview, architecture diagram link, quick-start steps, API endpoint summary, environment variable table, Docker instructions

---

## Phase 8: User Story 5 — Authentication (Login with Account/Password) (Priority: P1)

**Goal**: Users register and sign in with email + password. The API issues a signed JWT used by all protected routes (replacing the development mock user in `derive-auth-user.ts`).

**Independent Test**: `POST /api/v1/auth/register` with email/password → `201`; `POST /api/v1/auth/login` → `200` with `accessToken`; call `GET /api/v1/documents` with `Authorization: Bearer <token>` → `200`; call without token → `401`; wrong password → `401`.

**Context**: Extends FR-014 (JWT on all endpoints). Adds credential-based identity; `User` entity referenced in `data-model.md` but not yet implemented in Prisma.

### Schema & Shared

- [x] T081 [US5] Add `User` model and `UserRole` enum to `prisma/schema.prisma` — fields: `id`, `email` (unique), `passwordHash`, `role` (`admin`|`user`|`readonly`), `displayName?`, `isActive`, `lastLoginAt?`, `createdAt`, `updatedAt`; run migration
- [x] T082 [P] [US5] Update `prisma/seed.ts` — create default admin user with hashed password from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars
- [x] T083 [P] [US5] Extend `src/shared/config/env.ts` — add optional `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `BCRYPT_COST` (default 10); document in `.env.example`

### Domain Layer — Auth Module

- [x] T084 [P] [US5] Create `src/modules/auth/domain/entities/user.entity.ts` — `User` entity with `email`, `role`, `isActive`; factory `create()`; no password hash on entity surface
- [x] T085 [P] [US5] Create `src/modules/auth/domain/repositories/user.repository.interface.ts` — `findByEmail`, `findById`, `save`, `updateLastLogin`
- [x] T086 [US5] Create `src/modules/auth/domain/services/password.service.ts` — `hashPassword(plain)` and `verifyPassword(plain, hash)` using `Bun.password` (argon2id) or bcrypt; constant-time compare

### Infrastructure

- [x] T087 [US5] Create `src/modules/auth/infrastructure/prisma-user.repository.ts` — `PrismaUserRepository` implementing `IUserRepository`; map Prisma `User` ↔ domain entity

### Application Layer

- [x] T088 [P] [US5] Create `src/modules/auth/application/dtos/login.dto.ts` — Zod: `email`, `password` (min 8)
- [x] T089 [P] [US5] Create `src/modules/auth/application/dtos/register.dto.ts` — Zod: `email`, `password`, `displayName?`, `role?` (default `user`)
- [x] T090 [P] [US5] Create `src/modules/auth/application/dtos/auth-response.dto.ts` — `{ accessToken, expiresIn, user: { id, email, role } }`
- [x] T091 [US5] Create `src/modules/auth/application/use-cases/register.use-case.ts` — reject duplicate email (`409`), hash password, persist user, return JWT via shared signer
- [x] T092 [US5] Create `src/modules/auth/application/use-cases/login.use-case.ts` — validate credentials, check `isActive`, update `lastLoginAt`, return JWT (`sub`, `role`, `email` claims)
- [x] T093 [P] [US5] Create `src/modules/auth/application/use-cases/get-current-user.use-case.ts` — resolve user from JWT `sub`

### Presentation & Integration

- [x] T094 [US5] Create `src/modules/auth/presentation/auth.controller.ts` — handlers: `register`, `login`, `me` (GET current user)
- [x] T095 [US5] Create `src/modules/auth/presentation/auth.routes.ts` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (protected); **no auth** on register/login
- [x] T096 [US5] Wire `authRoutes` into `src/app.ts` under `/api/v1`; ensure JWT plugin signs tokens with same secret/claims as login use case
- [x] T097 [US5] Update `src/shared/middleware/derive-auth-user.ts` — remove hardcoded dev mock user; allow opt-in dev bypass only when `NODE_ENV=development` **and** `AUTH_DEV_BYPASS=true`
- [x] T098 [US5] Update `specs/001-ai-document-platform/contracts/api.md` — document auth endpoints, request/response shapes, error codes (`401`, `409`)

**Checkpoint**: Real login flow works end-to-end; protected document/search/job routes accept JWT from login.

---

## Phase 9: User Story 6 — Activity Logs (Document, Job, Embedding) (Priority: P2)

**Goal**: Persist an append-only audit trail for document, job, and embedding lifecycle events. Operators can query logs filtered by domain, entity, user, and time range.

**Independent Test**: Upload a document (US1) → query `GET /api/v1/activity-logs?domain=document&entityId=<docId>` and see `document.uploaded`; poll job to completion → see `job.started`, `job.stage_changed`, `job.completed`; verify `embedding.batch_completed` after worker finishes; unauthorized user cannot read another user's logs.

### Schema & Domain

- [x] T099 [US6] Add `ActivityLog` model and enums to `prisma/schema.prisma` — `ActivityDomain` (`DOCUMENT`|`JOB`|`EMBEDDING`), `ActivityAction` (e.g. `CREATED`|`UPDATED`|`DELETED`|`STATUS_CHANGED`|`STAGE_CHANGED`|`BATCH_COMPLETED`|`FAILED`); fields: `id`, `userId`, `domain`, `entityId`, `action`, `message?`, `metadata` JSON, `createdAt`; indexes on `(userId, createdAt)`, `(domain, entityId)`; run migration
- [x] T100 [P] [US6] Create `src/modules/activity-log/domain/entities/activity-log.entity.ts` — immutable log entry entity
- [x] T101 [P] [US6] Create `src/modules/activity-log/domain/repositories/activity-log.repository.interface.ts` — `append`, `findByFilters` (paginated)
- [x] T102 [US6] Create `src/modules/activity-log/domain/services/activity-log.service.ts` — `record(params)` helper; never throws (swallow/log errors so main flow is not blocked)

### Infrastructure & Application

- [x] T103 [US6] Create `src/modules/activity-log/infrastructure/prisma-activity-log.repository.ts` — `PrismaActivityLogRepository`
- [x] T104 [P] [US6] Create `src/modules/activity-log/application/dtos/activity-log-response.dto.ts` — API response mapping
- [x] T105 [US6] Create `src/modules/activity-log/application/queries/list-activity-logs.query.ts` — filters: `domain`, `entityId`, `action`, `from`, `to`, `page`, `limit`; scope to authenticated `userId`

### Emitters — Wire Into Existing Modules

- [x] T106 [P] [US6] Instrument `src/modules/document/application/use-cases/upload-document.use-case.ts` — log `document.uploaded`
- [x] T107 [P] [US6] Instrument `src/modules/document/application/use-cases/delete-document.use-case.ts` — log `document.deleted`
- [x] T108 [P] [US6] Instrument `src/modules/document/application/use-cases/reindex-document.use-case.ts` — log `document.reindex_requested`
- [x] T109 [US6] Instrument `src/modules/job/infrastructure/document-processing.worker.ts` — log `job.started`, `job.stage_changed` (parsing/chunking/embedding/storing), `job.completed`, `job.failed`
- [x] T110 [US6] Instrument `src/modules/embedding/domain/services/embedding.service.ts` (or worker embedding step) — log `embedding.batch_completed` with `{ chunkCount, model, provider, durationMs }`
- [x] T111 [P] [US6] Instrument `src/modules/document/infrastructure/prisma-document.repository.ts` `updateStatus` — log `document.status_changed` with `{ from, to }` in metadata

### Presentation

- [x] T112 [US6] Create `src/modules/activity-log/presentation/activity-log.controller.ts` — `GET /activity-logs` (list, paginated)
- [x] T113 [US6] Create `src/modules/activity-log/presentation/activity-log.routes.ts` — register under `/activity-logs`; require auth
- [x] T114 [US6] Wire `activityLogRoutes` into `src/app.ts`
- [x] T115 [US6] Update `specs/001-ai-document-platform/contracts/api.md` — document activity log list endpoint, query params, response schema

**Checkpoint**: Full document pipeline produces correlated activity log entries queryable by domain and entity ID.

---

## Phase 10: Polish — Auth & Activity Log Integration

**Purpose**: Cross-cutting hardening for US5 and US6.

- [ ] T116 [P] Add rate limiting on `POST /auth/login` and `POST /auth/register` in `src/modules/auth/presentation/auth.routes.ts` (stricter than global: e.g. 10 req/min per IP)
- [ ] T117 [P] Add retention policy note + optional `ACTIVITY_LOG_RETENTION_DAYS` env in `.env.example`; document cleanup strategy in `README.md`
- [ ] T118 Update `specs/001-ai-document-platform/data-model.md` — add `User` and `ActivityLog` entity tables
- [ ] T119 [P] Update `specs/001-ai-document-platform/quickstart.md` — register/login curl examples, sample activity log query
- [ ] T120 Run `bunx tsc --noEmit` and `bun run lint` after US5+US6 implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user story work**
- **US1 (Phase 3)**: Depends on Phase 2 — first story to complete
- **US2 (Phase 4)**: Depends on Phase 2 + `EmbeddingService` from US1 (T035)
- **US3 (Phase 5)**: Depends on US2 being complete (uses `SearchService`)
- **US4 (Phase 6)**: Depends on Phase 2 only — can run in parallel with US2/US3
- **Polish (Phase 7)**: Depends on all user stories complete
- **US5 (Phase 8)**: Depends on Phase 2 — **should complete before production**; replaces dev JWT mock
- **US6 (Phase 9)**: Depends on US1 (document/job/embedding flows exist to instrument)
- **Polish Auth/Logs (Phase 10)**: Depends on US5 + US6

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No cross-story dependencies.
- **US2 (P1)**: Depends on `EmbeddingService` (T035) and `PgVectorSearchRepository`. Can start in parallel with US1 after T035 and T052 unblock.
- **US3 (P2)**: Depends on US2 search infrastructure being complete.
- **US4 (P3)**: Depends on Phase 2 only. Can run fully in parallel with US2 and US3.
- **US5 (P1)**: Depends on Phase 2. Independent of US2–US4; unblocks real JWT for all routes.
- **US6 (P2)**: Depends on US1 pipeline (and benefits from US5 for user-scoped queries). Can start schema (T099–T103) in parallel with US5.

### Within Each User Story

- Domain value objects and entities → before services and repositories
- Repository interfaces → before infrastructure implementations
- Infrastructure implementations → before use cases
- Use cases → before controllers
- Controllers → before route registration in `app.ts`

### Parallel Opportunities

All tasks marked `[P]` within the same phase can run concurrently:
- All Phase 1 setup tasks (T002–T006) in parallel after T001
- All Phase 2 shared infrastructure tasks (T009–T017) in parallel after T007–T008
- All parser tasks (T026–T029) in parallel
- All embedding provider tasks (T031–T034) in parallel
- US4 (Phase 6) can run in parallel with US2 and US3

---

## Parallel Example: User Story 1

```bash
# After T007-T008 complete (Prisma schema + migrations), launch in parallel:
Task: "Create pdf.parser.ts" (T026)
Task: "Create docx.parser.ts" (T027)
Task: "Create html.parser.ts" (T028)
Task: "Create text.parser.ts" (T029)
Task: "Create embedding-provider.interface.ts" (T031)
Task: "Create openai.provider.ts" (T032)
Task: "Create huggingface.provider.ts" (T033)
Task: "Create local.provider.ts" (T034)
Task: "Create file-type.vo.ts" (T021)
Task: "Create chunking-config.vo.ts" (T022)
Task: "Create document.entity.ts" (T023)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Upload & Index)
4. **STOP and VALIDATE**: Upload a test PDF, verify chunks + embeddings in DB
5. Demo: document ingestion pipeline is live

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 → **Test independently** → Document upload + indexing pipeline ✅
3. Add US2 → **Test independently** → Semantic + hybrid search ✅
4. Add US3 → **Test independently** → RAG retrieval endpoint ✅
5. Add US4 → **Test independently** → Full document management ✅
6. Polish → Production hardening ✅
7. Add US5 → **Test independently** → Register/login + JWT on protected routes
8. Add US6 → **Test independently** → Activity logs for document, job, embedding events
9. Phase 10 → Rate limits, docs, validation

### Parallel Team Strategy

With 3+ developers (after Phase 2 complete):
- **Dev A**: US1 (document upload, parsing, chunking, embedding pipeline)
- **Dev B**: US2 (vector search, hybrid search infrastructure)
- **Dev C**: US4 (document management CRUD — independent of US2/US3)
- US3 assigned to first dev who completes their story
- **After core platform**: Dev A → US5 (auth), Dev B → US6 schema + emitters in parallel

### Parallel Example: User Story 5 (Auth)

```bash
# After T081 migration, launch in parallel:
Task: "Create user.entity.ts" (T084)
Task: "Create user.repository.interface.ts" (T085)
Task: "Create login.dto.ts" (T088)
Task: "Create register.dto.ts" (T089)
Task: "Create auth-response.dto.ts" (T090)
# Then sequentially: T086 → T087 → T091/T092 → T094–T097
```

### Parallel Example: User Story 6 (Activity Logs)

```bash
# After T099 migration, launch in parallel:
Task: "Create activity-log.entity.ts" (T100)
Task: "Create activity-log.repository.interface.ts" (T101)
Task: "Create activity-log-response.dto.ts" (T104)
Task: "Instrument upload-document.use-case.ts" (T106)
Task: "Instrument delete-document.use-case.ts" (T107)
Task: "Instrument reindex-document.use-case.ts" (T108)
# Then: T102 → T103 → T105 → worker/embedding instrumentation → T112–T115
```

---

## Notes

- `[P]` tasks = different files, no inter-task dependencies within the same phase
- `[US1]–[US6]` maps each task to its user story for delivery traceability
- **US5+US6** (T081–T120): 40 new tasks; Phases 1–7 (T001–T080) remain complete
- Embedding dimension is configurable per document — schema uses `vector(1536)` as default; different model dimensions require a new migration
- pgvector raw SQL is required for `INSERT ... ::vector` and `ORDER BY ... <=>` — use `$executeRaw` / `$queryRaw` in Prisma
- Commit after each logical group or checkpoint to maintain clean git history
- Run `bun run db:migrate` after any Prisma schema change
