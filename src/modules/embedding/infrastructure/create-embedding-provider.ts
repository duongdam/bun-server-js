import type { IEmbeddingProvider } from './providers/embedding-provider.interface';
import { HuggingFaceEmbeddingProvider } from './providers/huggingface.provider';
import { LocalEmbeddingProvider } from './providers/local.provider';
import { OpenAIEmbeddingProvider } from './providers/openai.provider';

export function createEmbeddingProvider(providerType?: string): IEmbeddingProvider {
  const type = (providerType ?? process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();

  switch (type) {
    case 'huggingface':
      return new HuggingFaceEmbeddingProvider();
    case 'local':
      return new LocalEmbeddingProvider();
    default:
      return new OpenAIEmbeddingProvider();
  }
}
