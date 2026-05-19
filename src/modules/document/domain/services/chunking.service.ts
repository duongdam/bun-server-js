import { encode } from 'gpt-tokenizer';
import type { ChunkingConfig } from '../value-objects/chunking-config.vo';

export interface Chunk {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
  pageNumber?: number;
  metadata: Record<string, unknown>;
}

export class ChunkingService {
  /**
   * Split text based on the provided configuration.
   */
  chunkText(text: string, config: ChunkingConfig, metadata: Record<string, unknown> = {}): Chunk[] {
    switch (config.strategy) {
      case 'token':
        return this.tokenAwareChunking(text, config, metadata);
      case 'semantic':
        return this.semanticChunking(text, config, metadata);
      default:
        return this.recursiveTextChunking(text, config, metadata);
    }
  }

  private tokenAwareChunking(
    text: string,
    config: ChunkingConfig,
    metadata: Record<string, unknown>,
  ): Chunk[] {
    const tokens = encode(text);
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    // Very simplified hard split based on characters approximating tokens
    // Real implementation would decode token sub-arrays back to strings
    const charsPerToken = text.length / tokens.length;
    const charChunkSize = Math.floor(config.chunkSize * charsPerToken);
    const charOverlap = Math.floor(config.chunkOverlap * charsPerToken);

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + charChunkSize, text.length);
      const content = text.slice(start, end);
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        startChar: start,
        endChar: end,
        tokenCount: encode(content).length,
        metadata,
      });
      start = end - charOverlap;
      if (start >= text.length || end === text.length) break;
    }
    return chunks;
  }

  private recursiveTextChunking(
    text: string,
    config: ChunkingConfig,
    metadata: Record<string, unknown>,
  ): Chunk[] {
    // Simplified recursive chunking: split by paragraphs, then sentences
    const paragraphs = text.split(/\n\n+/);
    const chunks: Chunk[] = [];
    let currentContent = '';
    let currentTokens = 0;
    let startIndex = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paraTokens = encode(paragraph).length;
      if (currentTokens + paraTokens > config.chunkSize && currentContent.length > 0) {
        // Push current chunk
        chunks.push({
          content: currentContent.trim(),
          chunkIndex: chunkIndex++,
          startChar: startIndex,
          endChar: startIndex + currentContent.length,
          tokenCount: currentTokens,
          metadata,
        });

        // Handle overlap (simplified: just keep the last paragraph if it fits within overlap limit)
        if (paraTokens <= config.chunkOverlap) {
          currentContent = paragraph;
          currentTokens = paraTokens;
          startIndex += currentContent.length; // Approximate
        } else {
          currentContent = paragraph;
          currentTokens = paraTokens;
          startIndex += currentContent.length; // Approximate
        }
      } else {
        currentContent += (currentContent ? '\n\n' : '') + paragraph;
        currentTokens += paraTokens;
      }
    }

    if (currentContent.trim().length > 0) {
      chunks.push({
        content: currentContent.trim(),
        chunkIndex: chunkIndex++,
        startChar: startIndex,
        endChar: startIndex + currentContent.length,
        tokenCount: currentTokens,
        metadata,
      });
    }

    return chunks;
  }

  private semanticChunking(
    text: string,
    config: ChunkingConfig,
    metadata: Record<string, unknown>,
  ): Chunk[] {
    // Stub for Phase 3. Fallback to recursive for now.
    return this.recursiveTextChunking(text, config, metadata);
  }
}
