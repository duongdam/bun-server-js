import type { IEmbeddingProvider } from './providers/embedding-provider.interface';
import { GeminiEmbeddingProvider } from './providers/gemini.provider';
import { HuggingFaceEmbeddingProvider } from './providers/huggingface.provider';
import { OpenAIEmbeddingProvider } from './providers/openai.provider';

export function createEmbeddingProvider(providerType?: string): IEmbeddingProvider {
  const type = (providerType ?? process.env.EMBEDDING_PROVIDER ?? 'gemini').toLowerCase();

  switch (type) {
    case 'huggingface':
      return new HuggingFaceEmbeddingProvider();
    case 'openai':
      return new OpenAIEmbeddingProvider();
    case 'gemini':
      return new GeminiEmbeddingProvider();
    default:
      throw new Error(`Unsupported EMBEDDING_PROVIDER: ${type}`);
  }
}
