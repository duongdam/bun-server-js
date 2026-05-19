export interface IEmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly dimension: number;

  /**
   * Generates embeddings for a batch of text chunks.
   * @param texts Array of text strings to embed
   * @returns Array of embedding vectors (number arrays) corresponding to the input texts
   */
  embed(texts: string[]): Promise<number[][]>;
}
