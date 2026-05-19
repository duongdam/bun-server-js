# Quickstart: AI Document Platform

**Branch**: `001-ai-document-platform`
**Date**: 2026-05-19

## Prerequisites

- Bun v1.3.14+
- Docker & Docker Compose
- Node.js 20+ (for Prisma CLI fallback)

## 1. Clone & Install

```bash
git clone <repo-url>
cd bun-server-js
bun install
```

## 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your values:
# DATABASE_URL=postgresql://user:pass@localhost:5432/ai_docs
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key
# OPENAI_API_KEY=sk-...
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
```

## 3. Start Infrastructure

```bash
docker compose up -d postgres redis
```

## 4. Database Setup

```bash
# Run migrations (includes pgvector extension + HNSW index)
bun run db:migrate

# Optional: seed test data
bun run db:seed
```

## 5. Start Dev Server

```bash
bun run dev
# Server running at http://localhost:3000
# Swagger UI at http://localhost:3000/swagger
```

## 6. Start Background Worker

```bash
# In a separate terminal
bun run worker
```

## 7. Quick Test: Upload & Search

```bash
# Upload a document
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer <jwt>" \
  -F "file=@sample.pdf"

# Response: { "documentId": "...", "jobId": "..." }

# Check job status
curl http://localhost:3000/api/v1/jobs/<jobId> \
  -H "Authorization: Bearer <jwt>"

# Semantic search once indexed
curl -X POST http://localhost:3000/api/v1/search \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"query": "financial risks", "topK": 5}'
```

## 8. Run Tests

```bash
bun test              # All tests
bun test:unit         # Unit tests only
bun test:integration  # Integration tests (requires running DB)
bun test:e2e          # End-to-end tests
```

## Folder Structure Preview

```
src/
├── modules/
│   ├── document/        # Document domain (upload, parse, chunk, index)
│   ├── embedding/       # Embedding providers & pipeline
│   ├── search/          # Semantic & hybrid search
│   └── job/             # Background job management
├── shared/
│   ├── domain/          # Base entity, repository interface, value objects
│   ├── infrastructure/  # Prisma client, Redis, logger
│   └── middleware/      # Auth, rate limiting, error handling
├── app.ts               # Elysia app setup
└── worker.ts            # BullMQ worker entrypoint
specs/
└── 001-ai-document-platform/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md   ← this file
    └── contracts/api.md
```
