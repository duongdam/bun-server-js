import type { EmbedContentRequest, GenerativeModel } from '@google/generative-ai';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { IEmbeddingProvider } from './embedding-provider.interface';

/** Gemini API embedding model (see https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2). */
const DEFAULT_MODEL = 'gemini-embedding-2';
/**
 * Default truncated output size for `gemini-embedding-2` to match `vector(768)` in Postgres (`outputDimensionality`).
 * Set `EMBEDDING_DIMENSION` if you use a different size or migrate the column.
 */
const DEFAULT_DIMENSION = 768;

/** Same `batchEmbedContents` contract as the SDK (tests may inject a minimal mock). */
export type GeminiEmbeddingModelClient = Pick<GenerativeModel, 'batchEmbedContents'>;

export type GeminiEmbeddingProviderOptions = {
  /** Injected model client (e.g. unit tests). When omitted, uses `GoogleGenerativeAI` from env. */
  modelClient?: GeminiEmbeddingModelClient;
};

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  public readonly provider = 'gemini';
  public readonly model: string;
  public readonly dimension: number;
  private readonly injectedClient: GeminiEmbeddingModelClient | undefined;
  private readonly apiKey: string | undefined;
  private lazyClient: Promise<GenerativeModel> | null = null;

  constructor(options?: GeminiEmbeddingProviderOptions) {
    this.model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
    const fromEnv = Number.parseInt(process.env.EMBEDDING_DIMENSION ?? '', 10);
    this.dimension = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_DIMENSION;

    if (options?.modelClient) {
      this.injectedClient = options.modelClient;
      this.apiKey = undefined;
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required when using the gemini embedding provider');
    }
    this.apiKey = apiKey;
    this.injectedClient = undefined;
  }

  private async resolveModelClient(): Promise<GeminiEmbeddingModelClient> {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (!this.lazyClient) {
      this.lazyClient = import('@google/generative-ai').then(({ GoogleGenerativeAI }) => {
        const key = this.apiKey;
        if (!key) {
          throw new Error('GEMINI_API_KEY is required when using the gemini embedding provider');
        }
        return new GoogleGenerativeAI(key).getGenerativeModel({ model: this.model });
      });
    }
    return await this.lazyClient;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const { TaskType } = await import('@google/generative-ai');
      const modelClient = await this.resolveModelClient();

      const requests: (EmbedContentRequest & { outputDimensionality?: number })[] = texts.map(
        (text) => ({
          content: { role: 'user', parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          outputDimensionality: this.dimension,
        }),
      );

      const { embeddings } = await modelClient.batchEmbedContents({ requests });

      if (!embeddings || embeddings.length !== texts.length) {
        throw new Error(
          `Gemini batchEmbedContents returned ${embeddings?.length ?? 0} vectors for ${texts.length} inputs`,
        );
      }

      return embeddings.map((e, i) => {
        const values = e.values;
        if (!values?.length) {
          throw new Error(`Gemini returned empty embedding at index ${i}`);
        }
        if (values.length !== this.dimension) {
          logger.warn(
            { index: i, expected: this.dimension, actual: values.length, model: this.model },
            'Embedding vector length differs from configured EMBEDDING_DIMENSION; align DB and env',
          );
        }
        return values;
      });
    } catch (error) {
      logger.error({ error }, 'Failed to generate embeddings with Gemini');
      throw new Error('Gemini embedding generation failed');
    }
  }
}
