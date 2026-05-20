import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/create-embedding-provider';
import { GeminiEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/providers/gemini.provider';
import { HuggingFaceEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/providers/huggingface.provider';
import { LocalEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/providers/local.provider';
import { OpenAIEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/providers/openai.provider';

describe('createEmbeddingProvider', () => {
  const savedProvider = process.env.EMBEDDING_PROVIDER;
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedHf = process.env.HUGGINGFACE_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gk-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.HUGGINGFACE_API_KEY = 'hf-test';
  });

  afterEach(() => {
    if (savedProvider === undefined) process.env.EMBEDDING_PROVIDER = undefined;
    else process.env.EMBEDDING_PROVIDER = savedProvider;
    if (savedGemini === undefined) process.env.GEMINI_API_KEY = undefined;
    else process.env.GEMINI_API_KEY = savedGemini;
    if (savedOpenai === undefined) process.env.OPENAI_API_KEY = undefined;
    else process.env.OPENAI_API_KEY = savedOpenai;
    if (savedHf === undefined) process.env.HUGGINGFACE_API_KEY = undefined;
    else process.env.HUGGINGFACE_API_KEY = savedHf;
  });

  test('returns GeminiEmbeddingProvider for gemini', () => {
    process.env.EMBEDDING_PROVIDER = 'gemini';
    const p = createEmbeddingProvider('gemini');
    expect(p).toBeInstanceOf(GeminiEmbeddingProvider);
  });

  test('defaults to gemini when EMBEDDING_PROVIDER is unset', () => {
    process.env.EMBEDDING_PROVIDER = undefined;
    const p = createEmbeddingProvider();
    expect(p).toBeInstanceOf(GeminiEmbeddingProvider);
  });

  test('returns OpenAIEmbeddingProvider for openai', () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    const p = createEmbeddingProvider('openai');
    expect(p).toBeInstanceOf(OpenAIEmbeddingProvider);
  });

  test('returns HuggingFaceEmbeddingProvider for huggingface', () => {
    const p = createEmbeddingProvider('huggingface');
    expect(p).toBeInstanceOf(HuggingFaceEmbeddingProvider);
  });

  test('returns LocalEmbeddingProvider for local', () => {
    const p = createEmbeddingProvider('local');
    expect(p).toBeInstanceOf(LocalEmbeddingProvider);
  });

  test('throws for unsupported provider', () => {
    expect(() => createEmbeddingProvider('unknown-provider')).toThrow(
      /Unsupported EMBEDDING_PROVIDER/,
    );
  });
});
