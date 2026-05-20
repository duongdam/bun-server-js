import OpenAI from 'openai';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { EmbedCallOptions, IEmbeddingProvider } from './embedding-provider.interface';

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  public readonly provider = 'openai';
  public readonly model: string;
  public readonly dimension: number;
  private openai: OpenAI;

  constructor() {
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimension = this.model === 'text-embedding-3-large' ? 3072 : 1536; // Example dimensions

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when using the openai embedding provider');
    }

    this.openai = new OpenAI({ apiKey });
  }

  async embed(texts: string[], _options?: EmbedCallOptions): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        input: texts,
        model: this.model,
      });

      return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (error) {
      logger.error({ error }, 'Failed to generate embeddings with OpenAI');
      throw new Error('OpenAI embedding generation failed');
    }
  }
}
