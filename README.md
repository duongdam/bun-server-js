# AI Document Platform

A production-grade AI document processing platform with Domain-Driven Design (DDD), pgvector semantic search, and a Retrieval-Augmented Generation (RAG) pipeline built on Elysia.js and Bun.

## Overview

This platform allows users to upload various document types (PDF, DOCX, HTML, TXT), which are automatically parsed, chunked, and embedded into a PostgreSQL database using `pgvector`. It exposes robust search APIs (Keyword, Semantic, and Hybrid) and a specialized RAG retrieval endpoint designed to return context-packed text optimized for LLM contexts.

## Architecture

The system is built using a strict modular monolith architecture following Domain-Driven Design principles.

- **API Framework**: Elysia.js on Bun for extreme performance and type safety.
- **Database**: PostgreSQL with `pgvector` extension for storing relational data and vector embeddings.
- **ORM**: Prisma for relational querying, with raw SQL integrations for `pgvector`.
- **Background Jobs**: BullMQ on Redis for resilient asynchronous document processing.
- **ML/AI**: HuggingFace Transformers (Xenova) or OpenAI for embeddings.

See [Architecture Decision Records (ADRs)](./docs/adr) for detailed technical decisions.

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) installed locally.
- Docker and Docker Compose (for running PostgreSQL and Redis).

### 1. Clone & Install

```bash
bun install
```

### 2. Environment Setup

Copy the example environment file and fill in your secrets (e.g., your OpenAI API key or HuggingFace token if using remote embeddings):

```bash
cp .env.example .env
```

### 3. Start Infrastructure

Start PostgreSQL (with pgvector) and Redis using Docker Compose:

```bash
docker-compose up -d
```

### 4. Database Migration

Run Prisma migrations to set up the schema:

```bash
bun run db:generate
bun run db:migrate
```

### 5. Start the Application

The application requires two processes: the API server and the background job worker.

**Terminal 1 (API Server):**
```bash
bun run dev
```

**Terminal 2 (Background Worker):**
```bash
bun run worker
```

## API Endpoint Summary

A full OpenAPI schema is available at `GET /swagger` when running the application.

- **`GET /health`**: System health check.
- **`POST /api/v1/documents`**: Upload a new document (multipart/form-data).
- **`GET /api/v1/documents`**: List uploaded documents.
- **`DELETE /api/v1/documents/:id`**: Delete a document.
- **`POST /api/v1/documents/:id/reindex`**: Re-process a document with a new chunking strategy.
- **`GET /api/v1/jobs/:id`**: Track the progress of a document processing job.
- **`POST /api/v1/search/semantic`**: Perform a semantic vector search.
- **`POST /api/v1/search/hybrid`**: Perform a hybrid (keyword + semantic) search using RRF ranking.
- **`POST /api/v1/search/retrieval`**: RAG-optimized retrieval, packing chunks into a fixed token budget.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` |
| `PORT` | API Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | *Required* |
| `REDIS_URL` | Redis connection string for BullMQ | *Required* |
| `JWT_SECRET` | Secret for issuing/verifying JWTs | *Required* |
| `EMBEDDING_PROVIDER` | `gemini`, `openai`, `huggingface`, or `local` | `gemini` |
| `EMBEDDING_MODEL` | Model ID for embeddings | `gemini-embedding-001` (with `EMBEDDING_DIMENSION` / DB aligned to 768 by default) |
| `GEMINI_API_KEY` | Required when `EMBEDDING_PROVIDER` is `gemini` | *Required in non-test env* |
| `OPENAI_API_KEY` | Required if `EMBEDDING_PROVIDER` is `openai` | `""` |
| `MAX_FILE_SIZE` | Maximum file upload size in bytes | `104857600` (100MB) |
| `WORKER_CONCURRENCY` | Number of concurrent jobs the worker processes | `4` |

## Docker Instructions

To run the entire application (API, Worker, DB, Redis) using Docker:

```bash
docker-compose build
docker-compose up -d
```
