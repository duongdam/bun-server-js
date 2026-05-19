# API Contract: AI Document Platform

**Version**: 1.0.0
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required on all endpoints except `/health`

---

## Authentication

All endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## Document Endpoints

### POST /documents/upload

Upload a document for processing.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| file | File | ✅ | The document file (PDF, DOCX, TXT, MD, CSV, JSON, HTML) |
| tags | string[] | ❌ | Optional tags for metadata filtering |
| chunkingStrategy | string | ❌ | `recursive` (default) \| `semantic` \| `token` |
| chunkSize | integer | ❌ | Target chunk size in tokens (default: 512) |
| chunkOverlap | integer | ❌ | Overlap in tokens (default: 50) |
| embeddingProvider | string | ❌ | `openai` (default) \| `huggingface` \| `local` |
| embeddingModel | string | ❌ | Model name (default: `text-embedding-3-small`) |

**Response 202 Accepted**:
```json
{
  "documentId": "uuid",
  "jobId": "uuid",
  "status": "pending",
  "message": "Document queued for processing"
}
```

**Response 400 Bad Request**:
```json
{
  "error": "UNSUPPORTED_FILE_TYPE",
  "message": "File type .xyz is not supported. Supported types: pdf, docx, txt, md, csv, json, html"
}
```

**Response 409 Conflict**:
```json
{
  "error": "DUPLICATE_DOCUMENT",
  "message": "A document with the same content already exists",
  "existingDocumentId": "uuid"
}
```

---

### GET /documents

List all documents for the authenticated user.

**Query Parameters**:

| Param | Type | Description |
|---|---|---|
| page | integer | Page number (default: 1) |
| limit | integer | Results per page (default: 20, max: 100) |
| status | string | Filter by status: `pending`, `processing`, `indexed`, `failed` |
| tags | string[] | Filter by tags (AND logic) |

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "uuid",
      "filename": "report.pdf",
      "mimeType": "application/pdf",
      "fileSize": 204800,
      "status": "indexed",
      "pageCount": 12,
      "wordCount": 4820,
      "tags": ["finance", "2024"],
      "chunkCount": 24,
      "embeddingModel": "text-embedding-3-small",
      "createdAt": "2026-05-19T10:00:00Z",
      "indexedAt": "2026-05-19T10:00:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

---

### GET /documents/:id

Retrieve a single document with its chunks summary.

**Response 200 OK**:
```json
{
  "id": "uuid",
  "filename": "report.pdf",
  "status": "indexed",
  "metadata": {},
  "chunkingConfig": {
    "strategy": "recursive",
    "chunkSize": 512,
    "chunkOverlap": 50
  },
  "embeddingConfig": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimension": 1536
  },
  "chunkCount": 24,
  "createdAt": "2026-05-19T10:00:00Z",
  "indexedAt": "2026-05-19T10:00:45Z"
}
```

---

### DELETE /documents/:id

Delete a document and all associated data (chunks, embeddings, job history).

**Response 204 No Content**: (empty body)

**Response 404 Not Found**:
```json
{ "error": "DOCUMENT_NOT_FOUND", "message": "Document uuid not found" }
```

---

### POST /documents/:id/reindex

Re-index a document with new chunking or embedding settings.

**Request Body**:
```json
{
  "chunkingStrategy": "semantic",
  "chunkSize": 256,
  "chunkOverlap": 32,
  "embeddingProvider": "openai",
  "embeddingModel": "text-embedding-3-large"
}
```

**Response 202 Accepted**:
```json
{
  "documentId": "uuid",
  "jobId": "uuid",
  "status": "pending",
  "message": "Re-indexing queued"
}
```

---

### GET /documents/:id/chunks

Retrieve paginated chunks for a document.

**Query Parameters**: `page`, `limit`

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "uuid",
      "chunkIndex": 0,
      "content": "This is the first chunk of text...",
      "pageNumber": 1,
      "tokenCount": 128,
      "metadata": {}
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 24 }
}
```

---

## Job Endpoints

### GET /jobs/:id

Get processing job status.

**Response 200 OK**:
```json
{
  "id": "uuid",
  "documentId": "uuid",
  "status": "processing",
  "stage": "embedding",
  "progress": 62,
  "totalChunks": 24,
  "processedChunks": 15,
  "retryCount": 0,
  "createdAt": "2026-05-19T10:00:00Z",
  "startedAt": "2026-05-19T10:00:02Z"
}
```

---

## Search Endpoints

### POST /search

Perform semantic or hybrid search across indexed documents.

**Request Body**:
```json
{
  "query": "What are the key financial risks?",
  "searchType": "hybrid",
  "topK": 10,
  "similarityThreshold": 0.7,
  "filters": {
    "tags": ["finance"],
    "documentIds": ["uuid1", "uuid2"]
  }
}
```

**Response 200 OK**:
```json
{
  "results": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "filename": "report.pdf",
      "content": "The primary financial risks include...",
      "pageNumber": 4,
      "chunkIndex": 7,
      "similarityScore": 0.923,
      "rankScore": 0.88
    }
  ],
  "metadata": {
    "query": "What are the key financial risks?",
    "searchType": "hybrid",
    "totalResults": 8,
    "latencyMs": 124
  }
}
```

---

### POST /retrieval

RAG-ready retrieval endpoint — returns context chunks formatted for LLM injection.

**Request Body**:
```json
{
  "query": "Summarize the risk factors",
  "topK": 5,
  "maxTokens": 2048,
  "similarityThreshold": 0.65,
  "filters": {}
}
```

**Response 200 OK**:
```json
{
  "context": [
    {
      "text": "The primary financial risks include market volatility...",
      "source": {
        "documentId": "uuid",
        "filename": "report.pdf",
        "pageNumber": 4,
        "chunkIndex": 7
      },
      "score": 0.923
    }
  ],
  "totalTokens": 1842,
  "sources": [
    { "documentId": "uuid", "filename": "report.pdf" }
  ]
}
```

---

## Health Endpoint

### GET /health

**Response 200 OK**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "redis": "ok",
    "embeddingProvider": "ok"
  },
  "timestamp": "2026-05-19T10:00:00Z"
}
```

---

## Error Response Schema

All errors follow this structure:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

**Common HTTP Status Codes**:
| Code | Meaning |
|---|---|
| 400 | Bad Request — validation error |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — resource does not exist |
| 409 | Conflict — duplicate resource |
| 413 | Payload Too Large — file exceeds size limit |
| 422 | Unprocessable Entity — semantic validation failed |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — unexpected failure |
| 503 | Service Unavailable — dependency down |
