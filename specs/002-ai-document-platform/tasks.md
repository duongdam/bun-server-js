# Tasks: Gemini default embeddings & search

**Input**: Design documents from `/specs/002-ai-document-platform/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), quickstart.md

**Tests**: **Required** per spec.md — unit tests under `tests/unit/` with mocks.

**Organization**: Tasks are grouped by user story so Gemini indexing (US1) and search embedding alignment (US2) can be validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label ([US1], [US2]) for story phases only
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependency and environment documentation before implementation.

- [x] T001 Add `@google/generative-ai` to dependencies in package.json
- [x] T002 [P] Document `GEMINI_API_KEY`, default `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and `EMBEDDING_DIMENSION` for Gemini in .env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Env validation and database vector dimension alignment — **must** complete before new Gemini vectors are written or searched.

**⚠️ CRITICAL**: No user story implementation should assume a mismatched `embeddings.vector` dimension.

- [x] T003 Extend `serverEnvSchema` (and defaults) for Gemini in src/shared/config/env.ts — include `GEMINI_API_KEY`, set default `EMBEDDING_PROVIDER` to `gemini`, set default `EMBEDDING_MODEL` to the chosen Gemini embedding model, and keep `EMBEDDING_DIMENSION` documented for operators
- [x] T004 Add a new SQL migration under prisma/migrations/ that alters `embeddings.vector` to `vector(768)` (or the exact dimension of the chosen default Gemini model), drops/recreates `embeddings_vector_hnsw_idx` per existing migration patterns in prisma/migrations/
- [x] T005 Align worker bootstrap embedding env passthrough in src/worker.ts with new defaults so `embeddingProvider` / `embeddingModel` in job payloads match src/shared/config/env.ts

**Checkpoint**: Env parses; DB column dimension matches Gemini output; worker reads same defaults.

---

## Phase 3: User Story 1 - Gemini embeddings for indexing (Priority: P1) 🎯 MVP

**Goal**: `GeminiEmbeddingProvider` implements `IEmbeddingProvider`; `createEmbeddingProvider()` defaults to Gemini; upload DTO defaults match.

**Independent Test**: Index a small document with Gemini credentials and verify embedding row dimensions and document metadata fields (`embeddingProvider`, `embeddingModel`, `embeddingDimension`).

### Tests for User Story 1 *(write first; mock SDK / network)*

- [x] T006 [P] [US1] Add unit tests with mocked `@google/generative-ai` (or injected client) covering success and error mapping in tests/unit/embedding/gemini.provider.test.ts
- [x] T007 [P] [US1] Add unit tests for `createEmbeddingProvider()` branches (`gemini`, default, explicit type) in tests/unit/embedding/create-embedding-provider.test.ts

### Implementation for User Story 1

- [x] T008 [US1] Implement `GeminiEmbeddingProvider` class in src/modules/embedding/infrastructure/providers/gemini.provider.ts (constructor reads `GEMINI_API_KEY` and model from env; `embed()` returns `number[][]`; expose correct `dimension` for the default model)
- [x] T009 [US1] Add `gemini` branch and change default fallback from `openai` to `gemini` in src/modules/embedding/infrastructure/create-embedding-provider.ts
- [x] T010 [US1] Update Zod defaults in src/modules/document/application/dtos/upload-document.dto.ts so `embeddingProvider` / `embeddingModel` fallbacks match env defaults (no stale `openai` / `text-embedding-3-small` literals when env defaults are Gemini)

**Checkpoint**: US1 complete — worker indexing can call Gemini embeddings with matching DB dimension.

---

## Phase 4: User Story 2 - Semantic & hybrid search with Gemini query vectors (Priority: P1)

**Goal**: Unit tests prove semantic, hybrid, and RAG paths embed the query via `EmbeddingService` and call `SearchService` with the resulting vector (no duplicate embedding logic).

**Independent Test**: With JWT, call semantic and hybrid search after Gemini indexing; no vector dimension errors; scores returned.

### Tests for User Story 2

- [x] T011 [P] [US2] Add unit tests mocking `EmbeddingService.embedBatch` and `SearchService.semanticSearch` in tests/unit/search/search-use-cases.test.ts (semantic path)
- [x] T012 [P] [US2] Add unit tests mocking `EmbeddingService.embedBatch` and `SearchService.hybridSearch` in tests/unit/search/search-use-cases.test.ts (hybrid path)
- [x] T013 [P] [US2] Add unit tests mocking `EmbeddingService.embedBatch` and `SearchService.semanticSearch` for the retrieval path in tests/unit/search/search-use-cases.test.ts (RAG path)

### Implementation for User Story 2

- [x] T014 [US2] Verify `embeddingService.embedBatch` is invoked before vector search in src/modules/search/application/use-cases/semantic-search.use-case.ts, src/modules/search/application/use-cases/hybrid-search.use-case.ts, and src/modules/search/application/use-cases/rag-retrieval.use-case.ts — edit only if a file omits that call

**Checkpoint**: US2 validated by unit tests — query vectors always come from `EmbeddingService` at default Gemini configuration.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Docs and manual verification.

- [ ] T015 [P] Update embedding provider documentation and default stack notes in README.md
- [ ] T016 [P] Update variable descriptions or examples in postman/AI-Document-Platform.postman_collection.json if they still imply OpenAI-only embeddings
- [ ] T017 [P] Reconcile specs/002-ai-document-platform/quickstart.md with final env variable names and `bun run db:sync-embedding-dimension` npm script name from package.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — blocks real DB writes at new dimension until T004 is applied in target environments
- **User Story 1 (Phase 3)**: Depends on Phase 2 for env + dimension; tests T006–T007 before T008–T010 (TDD)
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion *or* at minimum on T008–T009 (shared `EmbeddingService`); tests T011–T013 can be authored in parallel once use case constructors are stable
- **Polish (Phase 5)**: After Phases 3–4

### User Story Dependencies

- **US1**: Independent after Foundational — delivers Gemini vectors
- **US2**: Logically depends on US1 for end-to-end manual tests, but **unit tests** for US2 only depend on TypeScript interfaces, not live Gemini

### Within Each User Story

- Unit tests before implementation (US1)
- US2: tests T011–T013 may be written first; T014 is a small fix-only step if tests expose a gap

### Parallel Opportunities

- T002, T015, T016, T017 can proceed in parallel with other work once paths are known
- T006 and T007 in parallel
- T011, T012, T013 in parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "tests/unit/embedding/gemini.provider.test.ts"
Task: "tests/unit/embedding/create-embedding-provider.test.ts"
```

## Parallel Example: User Story 2

```bash
# Tests in parallel:
Task: "tests/unit/search/semantic-search.use-case.test.ts"
Task: "tests/unit/search/hybrid-search.use-case.test.ts"
Task: "tests/unit/search/rag-retrieval.use-case.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1–2 (dependency, env, DB dimension)
2. Complete Phase 3 (Gemini provider + defaults + DTO alignment)
3. **STOP**: Run `bun run test:unit` and index one document in a dev environment

### Incremental Delivery

1. Setup + Foundational → safe to switch dimension in non-prod databases
2. US1 → Gemini indexing works
3. US2 → search query embedding behavior locked by tests
4. Polish → operator docs

### Parallel Team Strategy

- Developer A: Phase 3 provider + factory
- Developer B: Phase 2 migration + env schema
- Developer C: Phase 4 use-case tests (mocks)

---

## Notes

- Re-run `bun run db:sync-embedding-dimension` only when appropriate for local dev; production should use checked-in migrations (T004).
- Do not commit real API keys.
- All checklist lines use the mandatory format: `- [ ] Txxx ... path`
- `bun run test:unit` runs `tests/unit/embedding` and `tests/unit/search` as **separate** `bun test` processes so Prisma initializes reliably after the Gemini SDK loads in embedding tests (Bun + Prisma edge case).
