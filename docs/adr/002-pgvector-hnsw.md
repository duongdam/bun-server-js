# 2. Vector Database Selection: pgvector with HNSW

Date: 2026-05-19

## Status

Accepted

## Context

The platform requires a scalable vector database to store document chunk embeddings and perform similarity searches for semantic search and RAG retrieval. We must choose between dedicated vector databases (e.g., Pinecone, Milvus, Qdrant) and extending an existing relational database.

## Decision

We have decided to use **PostgreSQL** with the **pgvector** extension, specifically utilizing the **HNSW (Hierarchical Navigable Small World)** index type.

## Rationale

1. **Infrastructure Simplicity**: By using PostgreSQL for both our relational data (Users, Documents, Jobs) and vector data, we eliminate the need to manage and synchronize a secondary data store. This drastically reduces operational complexity.
2. **ACID Compliance**: Keeping vectors alongside the document metadata ensures that updates and deletes are fully transactional. When a document is deleted, its chunks and embeddings are guaranteed to be deleted simultaneously via cascading deletes.
3. **pgvector Maturity**: pgvector has matured significantly and is now supported by managed database providers (like AWS RDS, Supabase, Neon).
4. **HNSW Index**: While IVFFlat requires periodic rebuilding as data grows, the HNSW index in pgvector provides robust, highly accurate approximate nearest neighbor search that scales well and allows for dynamic inserts without requiring immediate re-indexing.

## Consequences

- **Positive**: Simplified architecture, lower infrastructure costs, and transactional safety for document processing workflows.
- **Negative**: PostgreSQL is primarily a relational database, so massive scale vector search (billions of vectors) might eventually outpace pgvector's capabilities compared to specialized solutions.
- **Mitigation**: We will monitor vector table sizes and query latency, using partitioning and optimized HNSW parameters (m, ef_construction) as needed.
