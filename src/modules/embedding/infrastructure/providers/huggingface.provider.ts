import { HfInference } from '@huggingface/inference';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { IEmbeddingProvider } from './embedding-provider.interface';

export class HuggingFaceEmbeddingProvider implements IEmbeddingProvider {
  public readonly provider = 'huggingface';
  public readonly model: string;
  public readonly dimension: number;
  private hf: HfInference;

  constructor() {
    this.model = process.env.HUGGINGFACE_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
    // dimension for all-MiniLM-L6-v2 is 384
    this.dimension = this.model.includes('MiniLM') ? 384 : 768;

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is required when using huggingface provider');
    }

    this.hf = new HfInference(apiKey);
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const results = await this.hf.featureExtraction({
        model: this.model,
        inputs: texts,
      });

      // HF returns a 2D array if multiple inputs, or 1D if single input
      if (texts.length === 1 && !Array.isArray(results[0])) {
        return [results as unknown as number[]];
      }
      return results as unknown as number[][];
    } catch (error) {
      logger.error({ error }, 'Failed to generate embeddings with HuggingFace');
      throw new Error('HuggingFace embedding generation failed');
    }
  }
}
