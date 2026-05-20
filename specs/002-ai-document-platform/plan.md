# Implementation Plan: Gemini default embeddings & search

**Branch**: `002-ai-document-platform` | **Date**: 2026-05-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-ai-document-platform/spec.md`

## Summary

Add a **Gemini** embedding provider, make it the **default** embedding backend for the Bun + TypeScript AI document platform, and ensure **semantic** and **hybrid** search continue to embed queries through the shared `EmbeddingService` so ingest and search stay aligned. Include **unit tests** (`bun test tests/unit`) with mocks. Align PostgreSQL `embeddings.vector` dimension with the Gemini model (e.g. 768 for `gemini-embedding-2` with `outputDimensionality`) via `scripts/sync-embedding-dimension.ts` and/or a Prisma SQL migration.

## Technical Context

**Language/Version**: TypeScript (strict) on Bun.js

**Primary Dependencies**: Existing stack (Elysia, Prisma, pgvector, BullMQ) plus `@google/generative-ai` for Gemini embeddings

**Storage**: PostgreSQL + pgvector — column dimension must match Gemini output

**Testing**: `bun test` / `bun test tests/unit` (Bun test runner)

**Target Platform**: Same as 001 — Linux/Docker

**Project Type**: REST API — extend `src/modules/embedding` and `src/modules/search`; config in `src/shared/config/env.ts`

**Constraints**:

- Reuse `IEmbeddingProvider` and `createEmbeddingProvider()` — add `case 'gemini'`.
- Default `EMBEDDING_PROVIDER` in env schema becomes `gemini`; document `GEMINI_API_KEY` in `.env.example`.
- Update upload DTO defaults that still fall back to `'openai'` / `text-embedding-3-small` so they follow env or match new defaults (`src/modules/document/application/dtos/upload-document.dto.ts`).
- No change to search service cosine math — only provider + dimension alignment.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| DDD vertical slices | ✅ PASS | Provider lives under `embedding/infrastructure/providers/` |
| Spec-driven | ✅ PASS | spec.md + plan.md + tasks.md |
| Pluggable embeddings | ✅ PASS | New provider implements existing interface |
| Production standards | ✅ PASS | Typed env, tests, clear errors for missing API key |

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-document-platform/
├── plan.md       ← this file
├── spec.md
├── quickstart.md ← Gemini env + dimension sync
└── tasks.md      ← /speckit-tasks output
```

### Source (touch points)

```text
src/modules/embedding/infrastructure/providers/gemini.provider.ts   (new)
src/modules/embedding/infrastructure/create-embedding-provider.ts   (gemini + default)
src/shared/config/env.ts                                            (GEMINI_*, defaults)
src/modules/document/application/dtos/upload-document.dto.ts        (default strings)
.env.example
package.json                                                        (@google/generative-ai)
prisma/migrations/...                                                (optional explicit migration)
scripts/sync-embedding-dimension.ts                                 (already supports dim sync)
tests/unit/embedding/...
tests/unit/search/...
```

**Structure Decision**: Follow existing 001 layout; no new bounded context.

## Complexity Tracking

> No new constitution violations.
