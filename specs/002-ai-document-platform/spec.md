# Feature Specification: Gemini default embeddings & search

**Feature Branch**: `002-ai-document-platform`

**Created**: 2026-05-20

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gemini embeddings for indexing (Priority: P1)

The platform generates chunk embeddings using **Google Gemini** as the **default** embedding backend (configurable model, e.g. `gemini-embedding-001`). Document upload and worker indexing use the same provider interface as other backends, but when `EMBEDDING_PROVIDER` is unset or set to `gemini`, the system uses the Gemini API with `GEMINI_API_KEY`.

**Why this priority**: Search and RAG require vectors; Gemini as default aligns ingestion with the chosen stack.

**Independent Test**: With valid `GEMINI_API_KEY` and DB vector dimension matching the model output, process a small text document and confirm stored embedding rows have the expected length and `documents.embeddingProvider` / `embeddingModel` reflect Gemini.

**Acceptance Scenarios**:

1. **Given** `EMBEDDING_PROVIDER=gemini` (or default resolved to gemini), **When** the worker indexes chunks, **Then** each chunk receives an embedding vector whose dimension matches the configured pgvector column and the active Gemini model.
2. **Given** `GEMINI_API_KEY` is missing, **When** the embedding provider is instantiated for Gemini, **Then** the application fails fast with a clear configuration error.
3. **Given** the Gemini API returns a transient error, **When** `EmbeddingService.embedBatch` runs, **Then** existing retry behavior still applies.

---

### User Story 2 - Semantic & hybrid search with Gemini query vectors (Priority: P1)

Semantic and hybrid search embed the user query with the **same** default `EmbeddingService` / provider as indexing, so query vectors are comparable to stored chunk vectors when the deployment uses Gemini by default.

**Why this priority**: Mismatched providers or dimensions between ingest and search breaks relevance or causes runtime errors.

**Independent Test**: After indexing with Gemini, call `/api/search` (semantic) and hybrid search with a JWT; results return without dimension errors and similarity scores are present.

**Acceptance Scenarios**:

1. **Given** an indexed corpus with Gemini embeddings, **When** a semantic search runs, **Then** the query is embedded via Gemini and pgvector cosine search executes successfully.
2. **Given** the same corpus, **When** hybrid search runs, **Then** the query embedding path matches semantic search (same provider/model) and hybrid ranking returns.

---

### Edge Cases

- Existing databases using `vector(384)` or `vector(1536)` must be migrated or synchronized to the Gemini model dimension before indexing new documents.
- Documents indexed with a different provider/dimension must not be mixed in the same vector space without re-indexing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a `gemini` embedding provider implementing `IEmbeddingProvider` in `src/modules/embedding/infrastructure/providers/`.
- **FR-002**: When `EMBEDDING_PROVIDER` defaults for the deployment are set to Gemini, `createEmbeddingProvider()` MUST resolve to the Gemini implementation without code changes at call sites.
- **FR-003**: Semantic and hybrid search MUST use `EmbeddingService.embedBatch` for the query string so the query uses the same provider as configured for the process.
- **FR-004**: Environment configuration MUST document `GEMINI_API_KEY`, default `EMBEDDING_PROVIDER`, and default `EMBEDDING_MODEL` for Gemini in `.env.example` and validated in `src/shared/config/env.ts`.
- **FR-005**: PostgreSQL `embeddings.vector` dimension MUST match the active Gemini embedding dimension (via migration and/or `scripts/sync-embedding-dimension.ts` workflow).

### Key Entities

- Reuses **Document**, **DocumentChunk**, **Embedding** (pgvector) from the core platform; **002** focuses on provider wiring and dimension consistency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Default provider path (no `EMBEDDING_PROVIDER` in env) uses Gemini when the feature is fully implemented and `.env` supplies `GEMINI_API_KEY`.
- **SC-002**: `bun test tests/unit` passes for new Gemini provider and search use-case unit tests (mocked HTTP / dependencies).

## Assumptions

- Gemini embedding model `gemini-embedding-001` supports truncation via `outputDimensionality` (default deployment uses **768** to match `vector(768)`); operators set `EMBEDDING_DIMENSION` or run the sync script after provider switches.
- The Google Generative AI client library (`@google/generative-ai`) is acceptable as a runtime dependency.

## Testing *(mandatory for this feature)*

- Unit tests MUST cover: Gemini provider (success + error paths with mocked SDK or `fetch`), `createEmbeddingProvider` resolution for `gemini` and default, and semantic (or hybrid) search use case query embedding delegation with mocked `EmbeddingService` / `SearchService`.
