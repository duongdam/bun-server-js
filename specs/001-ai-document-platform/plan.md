# Implementation Plan: AI Document Platform

**Branch**: `001-ai-document-platform` | **Date**: 2026-05-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-ai-document-platform/spec.md`

## Summary

Build a production-grade AI document platform on Bun.js + TypeScript using Domain-Driven Design. The platform accepts file uploads (PDF, DOCX, TXT, Markdown, CSV, JSON, HTML), extracts and chunks text intelligently, generates vector embeddings via pluggable providers (OpenAI, HuggingFace, local), stores them in PostgreSQL with pgvector, and exposes semantic + hybrid search and RAG retrieval APIs. All document processing runs asynchronously via BullMQ background workers.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Bun.js v1.3.14

**Primary Dependencies**: Elysia (web framework), Zod (validation), Prisma (ORM), BullMQ + Redis (job queue), OpenAI SDK, Transformers.js (local embeddings), pdf-parse, mammoth, Pino (logging), @elysiajs/swagger, @elysiajs/jwt

**Storage**: PostgreSQL 15+ with pgvector extension; Redis for queue

**Testing**: Bun built-in test runner (`bun test`), with unit / integration / e2e test layers

**Target Platform**: Linux server (Docker), horizontally scalable

**Project Type**: REST API web-service (monorepo-ready)

**Performance Goals**:
- Document upload + full indexing < 60s for files < 10MB
- Semantic search p95 < 500ms for corpus of 100k chunks
- Support 50 concurrent upload/processing requests

**Constraints**:
- Streaming file uploads
- Stateless APIs (JWT, no server-side sessions)
- HNSW index on pgvector for ANN search
- All secrets via environment variables
- No file binary persistence after extraction

**Scale/Scope**: Initial single-tenant; architecture MUST be multi-tenant-ready (userId scoping throughout)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Domain-Driven Design | ✅ PASS | Vertical-slice DDD modules per bounded context |
| II. Specification-Driven Development | ✅ PASS | spec.md → research.md → data-model.md → contracts → plan.md all exist before code |
| III. AI-First Processing & Embedding Strategy | ✅ PASS | Pluggable provider interface; recursive + semantic + token-aware chunking |
| IV. High-Performance Vector Storage | ✅ PASS | pgvector HNSW index, cosine similarity, hybrid search with RRF |
| V. Production-Grade Engineering Standards | ✅ PASS | Strict TS, Pino logging, BullMQ, Bun test runner, SOLID, JWT auth |

**No violations. No complexity justification required.**

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-document-platform/
├── plan.md              ← this file
├── research.md          ← Phase 0: tech decisions
├── data-model.md        ← Phase 1: entities & Prisma schema
├── quickstart.md        ← Phase 1: developer onboarding
├── contracts/
│   └── api.md           ← Phase 1: REST API contract
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── document/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── document.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── file-type.vo.ts
│   │   │   │   └── chunking-config.vo.ts
│   │   │   ├── repositories/
│   │   │   │   └── document.repository.interface.ts
│   │   │   ├── events/
│   │   │   │   └── document-uploaded.event.ts
│   │   │   └── services/
│   │   │       ├── file-parser.service.ts
│   │   │       └── chunking.service.ts
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── upload-document.use-case.ts
│   │   │   │   ├── delete-document.use-case.ts
│   │   │   │   └── reindex-document.use-case.ts
│   │   │   ├── dtos/
│   │   │   │   ├── upload-document.dto.ts
│   │   │   │   └── document-response.dto.ts
│   │   │   └── queries/
│   │   │       └── list-documents.query.ts
│   │   ├── infrastructure/
│   │   │   ├── prisma-document.repository.ts
│   │   │   └── parsers/
│   │   │       ├── pdf.parser.ts
│   │   │       ├── docx.parser.ts
│   │   │       ├── html.parser.ts
│   │   │       └── text.parser.ts
│   │   └── presentation/
│   │       ├── document.controller.ts
│   │       └── document.routes.ts
│   ├── embedding/
│   │   ├── domain/
│   │   │   ├── repositories/
│   │   │   │   └── embedding.repository.interface.ts
│   │   │   └── services/
│   │   │       └── embedding.service.ts
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       └── generate-embeddings.use-case.ts
│   │   └── infrastructure/
│   │       ├── providers/
│   │       │   ├── embedding-provider.interface.ts
│   │       │   ├── openai.provider.ts
│   │       │   ├── huggingface.provider.ts
│   │       │   └── local.provider.ts
│   │       └── prisma-embedding.repository.ts
│   ├── search/
│   │   ├── domain/
│   │   │   └── services/
│   │   │       └── search.service.ts
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── semantic-search.use-case.ts
│   │   │   │   ├── hybrid-search.use-case.ts
│   │   │   │   └── rag-retrieval.use-case.ts
│   │   │   └── dtos/
│   │   │       ├── search-request.dto.ts
│   │   │       └── search-result.dto.ts
│   │   ├── infrastructure/
│   │   │   └── pgvector-search.repository.ts
│   │   └── presentation/
│   │       ├── search.controller.ts
│   │       └── search.routes.ts
│   └── job/
│       ├── domain/
│       │   └── entities/
│       │       └── processing-job.entity.ts
│       ├── application/
│       │   └── use-cases/
│       │       └── track-job.use-case.ts
│       ├── infrastructure/
│       │   ├── bullmq.queue.ts
│       │   ├── document-processing.worker.ts
│       │   └── prisma-job.repository.ts
│       └── presentation/
│           └── job.controller.ts
├── shared/
│   ├── domain/
│   │   ├── base.entity.ts
│   │   ├── base.repository.interface.ts
│   │   └── domain-event.ts
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   ├── client.ts
│   │   │   └── migrations/
│   │   ├── redis/
│   │   │   └── client.ts
│   │   └── logger/
│   │       └── pino.logger.ts
│   └── middleware/
│       ├── auth.middleware.ts
│       ├── rate-limit.middleware.ts
│       └── error-handler.middleware.ts
├── app.ts                   ← Elysia app bootstrap
└── worker.ts                ← BullMQ worker entrypoint

prisma/
├── schema.prisma
├── migrations/
│   └── 001_init_pgvector/
│       └── migration.sql
└── seed.ts

tests/
├── unit/
│   ├── document/
│   ├── embedding/
│   └── search/
├── integration/
│   ├── repositories/
│   └── api/
└── e2e/
    └── document-pipeline.test.ts

docs/
├── adr/
│   ├── 001-elysia-framework.md
│   ├── 002-pgvector-hnsw.md
│   ├── 003-bullmq-queue.md
│   └── 004-chunking-strategies.md
└── openapi.json             ← auto-generated

docker-compose.yml
Dockerfile
.env.example
```

**Structure Decision**: Vertical-slice DDD — each module under `src/modules/` contains its own domain, application, infrastructure, and presentation layers. This keeps all code for a bounded context co-located. A `shared/` kernel provides base classes and cross-cutting infrastructure.

## Complexity Tracking

> No constitution violations found. No justification required.
