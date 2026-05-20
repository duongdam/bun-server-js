/** Use `query` for search / RAG query strings; `document` for chunk indexing (Gemini task types). */
export type EmbedPurpose = 'document' | 'query';

export interface EmbedCallOptions {
  purpose?: EmbedPurpose;
  /**
   * Gemini-only: passed through as `taskType` on `batchEmbedContents` (e.g. `QUESTION_ANSWERING`).
   * Newer API values may not exist on the SDK `TaskType` enum yet; the provider still sends this string.
   */
  geminiTaskType?: string;
}

export interface IEmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly dimension: number;

  /**
   * Generates embeddings for a batch of text chunks.
   * @param texts Array of text strings to embed
   * @param options Optional hints (e.g. Gemini `TaskType` differs for query vs document)
   * @returns Array of embedding vectors (number arrays) corresponding to the input texts
   */
  embed(texts: string[], options?: EmbedCallOptions): Promise<number[][]>;
}
