import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { GeminiEmbeddingProvider } from '../../../src/modules/embedding/infrastructure/providers/gemini.provider';

describe('GeminiEmbeddingProvider', () => {
  const batchEmbedContents = mock(() =>
    Promise.resolve({
      embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
    }),
  );

  beforeEach(() => {
    batchEmbedContents.mockReset();
    batchEmbedContents.mockImplementation(() =>
      Promise.resolve({
        embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
      }),
    );
    process.env.EMBEDDING_MODEL = 'gemini-embedding-2';
    process.env.EMBEDDING_DIMENSION = '2';
  });

  test('throws without GEMINI_API_KEY when using default client', () => {
    process.env.GEMINI_API_KEY = undefined;
    expect(() => new GeminiEmbeddingProvider()).toThrow(/GEMINI_API_KEY/);
  });

  test('embed returns vectors from batchEmbedContents', async () => {
    const provider = new GeminiEmbeddingProvider({
      modelClient: { batchEmbedContents },
    });
    expect(provider.dimension).toBe(2);
    const out = await provider.embed(['a', 'b']);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(batchEmbedContents).toHaveBeenCalledTimes(1);
    const batchArg = (batchEmbedContents.mock.calls as unknown[][])[0]?.[0] as {
      requests: Array<{ outputDimensionality?: number }>;
    };
    expect(batchArg.requests[0]?.outputDimensionality).toBe(2);
    expect(batchArg.requests[1]?.outputDimensionality).toBe(2);
  });

  test('embed returns empty array for empty input', async () => {
    const provider = new GeminiEmbeddingProvider({
      modelClient: { batchEmbedContents },
    });
    await expect(provider.embed([])).resolves.toEqual([]);
    expect(batchEmbedContents).not.toHaveBeenCalled();
  });

  test('maps API errors to a generic error', async () => {
    batchEmbedContents.mockImplementationOnce(() => Promise.reject(new Error('quota')));
    const provider = new GeminiEmbeddingProvider({
      modelClient: { batchEmbedContents },
    });
    await expect(provider.embed(['x'])).rejects.toThrow(/Gemini embedding generation failed/);
  });
});
