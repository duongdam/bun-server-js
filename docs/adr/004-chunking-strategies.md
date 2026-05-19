# 4. Document Chunking Strategies

Date: 2026-05-19

## Status

Accepted

## Context

To provide effective Retrieval-Augmented Generation (RAG) and Semantic Search, large documents must be split into smaller "chunks" before being passed to embedding models. If chunks are too small, they lose context; if they are too large, they dilute the semantic meaning and might exceed LLM context windows.

## Decision

We will support multiple chunking strategies in the platform, configurable per document, defaulting to a **Recursive Character Text Splitter**. 

The strategies supported are:
1. **Recursive Strategy (Default)**: Attempts to split by paragraphs, then sentences, then words, respecting logical text boundaries.
2. **Semantic Strategy**: (Future/Advanced) Uses NLP to find semantic boundaries.
3. **Token-based Strategy**: Splits strictly by LLM token counts to maximize context window usage.

## Rationale

1. **Flexibility**: Different document types (legal contracts vs. conversational transcripts) require different chunking approaches for optimal retrieval.
2. **Recursive as Default**: Recursive splitting offers the best balance of semantic preservation and predictable chunk size for general-purpose documents.
3. **Overlap Config**: We allow configuring `chunkOverlap` to ensure that context at the boundaries of chunks is not lost, reducing "edge-case" retrieval failures.

## Consequences

- **Positive**: Users can tune the ingestion process to maximize retrieval accuracy for their specific domain.
- **Negative**: Implementing multiple chunking logic increases the complexity of the processing worker. Re-indexing functionality is necessary if users need to change strategies after uploading.
- **Mitigation**: We have implemented a `ReindexDocumentUseCase` that allows users to re-run the chunking pipeline with new parameters without re-uploading the original file.
