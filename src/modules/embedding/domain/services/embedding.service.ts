import { IEmbeddingProvider } from '../../infrastructure/providers/embedding-provider.interface';
import { OpenAIEmbeddingProvider } from '../../infrastructure/providers/openai.provider';
import { HuggingFaceEmbeddingProvider } from '../../infrastructure/providers/huggingface.provider';
import { LocalEmbeddingProvider } from '../../infrastructure/providers/local.provider';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class EmbeddingService {
  private provider: IEmbeddingProvider;

  constructor() {
    const providerType = process.env['EMBEDDING_PROVIDER']?.toLowerCase() || 'openai';

    switch (providerType) {
      case 'huggingface':
        this.provider = new HuggingFaceEmbeddingProvider();
        break;
      case 'local':
        this.provider = new LocalEmbeddingProvider();
        break;
      case 'openai':
      default:
        this.provider = new OpenAIEmbeddingProvider();
        break;
    }
    logger.info(
      { provider: this.provider.provider, model: this.provider.model },
      'Initialized Embedding Service',
    );
  }

  /**
   * Generates embeddings with automatic retry and batching logic.
   */
  async embedBatch(chunks: string[]): Promise<number[][]> {
    if (chunks.length === 0) return [];

    // Simple batching (e.g. 100 chunks at a time to prevent payload too large)
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          const embeddings = await this.provider.embed(batch);
          allEmbeddings.push(...embeddings);
          success = true;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise((r) => setTimeout(r, 1000 * (4 - retries))); // Exponential-ish backoff
        }
      }
    }

    return allEmbeddings;
  }
}
