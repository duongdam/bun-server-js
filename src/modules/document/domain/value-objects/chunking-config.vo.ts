import { ValidationError } from '../../../../shared/middleware/error-handler.middleware';

export type ChunkingStrategy = 'recursive' | 'semantic' | 'token';

export class ChunkingConfig {
  constructor(
    public readonly strategy: ChunkingStrategy,
    public readonly chunkSize: number,
    public readonly chunkOverlap: number,
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.chunkSize < 64 || this.chunkSize > 2048) {
      throw new ValidationError('chunkSize must be between 64 and 2048');
    }
    if (this.chunkOverlap < 0) {
      throw new ValidationError('chunkOverlap must be greater than or equal to 0');
    }
    if (this.chunkOverlap >= this.chunkSize) {
      throw new ValidationError('chunkOverlap must be less than chunkSize');
    }
    const validStrategies: ChunkingStrategy[] = ['recursive', 'semantic', 'token'];
    if (!validStrategies.includes(this.strategy)) {
      throw new ValidationError(`Invalid chunking strategy: ${this.strategy}`);
    }
  }
}
