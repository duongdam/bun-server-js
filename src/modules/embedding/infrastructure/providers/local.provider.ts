import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { IEmbeddingProvider } from './embedding-provider.interface';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class LocalEmbeddingProvider implements IEmbeddingProvider {
  public readonly provider = 'local';
  public readonly model: string;
  public readonly dimension: number;
  private _pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor() {
    this.model = process.env['LOCAL_MODEL'] || 'Xenova/all-MiniLM-L6-v2';
    this.dimension = 384; // Fixed for all-MiniLM-L6-v2
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this._pipelinePromise) {
      this._pipelinePromise = pipeline(
        'feature-extraction',
        this.model,
      ) as Promise<FeatureExtractionPipeline>;
    }
    return this._pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const extractor = await this.getPipeline();
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      return output.tolist() as number[][];
    } catch (error) {
      logger.error({ error }, 'Failed to generate embeddings with local model');
      throw new Error('Local embedding generation failed');
    }
  }
}
