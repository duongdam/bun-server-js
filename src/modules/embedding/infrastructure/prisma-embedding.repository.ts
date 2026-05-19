import { prisma } from '@/shared/infrastructure/prisma/client';
import type { Prisma } from '@prisma/client';

export interface SaveEmbeddingsOptions {
  documentId: string;
  model: string;
  provider: string;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
    pageNumber?: number;
    startChar?: number;
    endChar?: number;
    tokenCount: number;
    metadata: Record<string, unknown>;
  }>;
  embeddings: number[][];
}

export class PrismaEmbeddingRepository {
  /**
   * Saves chunks and embeddings in a single transaction.
   */
  async saveChunksAndEmbeddings(options: SaveEmbeddingsOptions): Promise<void> {
    const { documentId, model, provider, chunks, embeddings } = options;

    if (chunks.length !== embeddings.length) {
      throw new Error('Number of chunks must match number of embeddings');
    }

    if (chunks.length === 0) return;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Insert chunks
      await tx.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          id: chunk.id,
          documentId,

          chunkIndex: chunk.chunkIndex,
          content: chunk.content,

          pageNumber: chunk.pageNumber ?? null,
          startChar: chunk.startChar ?? null,
          endChar: chunk.endChar ?? null,

          tokenCount: chunk.tokenCount,

          metadata: chunk.metadata as Prisma.InputJsonValue,
        })),
      });

      // 2. Insert embeddings using raw SQL
      const BATCH_SIZE = 50;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);

        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

        const values: unknown[] = [];
        const placeholders: string[] = [];

        let paramIndex = 1;

        for (let j = 0; j < batchChunks.length; j++) {
          placeholders.push(
            `($${paramIndex++}::text, $${paramIndex++}::text, $${paramIndex++}::vector, $${paramIndex++}, $${paramIndex++})`,
          );

          values.push(
            batchChunks[j]?.id,
            documentId,
            `[${batchEmbeddings[j]?.join(',')}]`,
            model,
            provider,
          );
        }

        const sql = `
            INSERT INTO "embeddings"
            (
              "chunkId",
              "documentId",
              "vector",
              "model",
              "provider"
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT ("chunkId") DO NOTHING;
          `;

        await tx.$executeRawUnsafe(sql, ...values);
      }
    });
  }
}
