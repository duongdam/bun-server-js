import { DocumentStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../shared/infrastructure/prisma/client';
import { NotFoundError } from '../../../shared/middleware/error-handler.middleware';
import { toDocumentResponseDto } from '../application/dtos/document-response.dto';
import { UploadDocumentSchema } from '../application/dtos/upload-document.dto';
import { ListDocumentsQuery } from '../application/queries/list-documents.query';
import { DeleteDocumentUseCase } from '../application/use-cases/delete-document.use-case';
import {
  type ReindexDocumentParams,
  ReindexDocumentUseCase,
} from '../application/use-cases/reindex-document.use-case';
import { UploadDocumentUseCase } from '../application/use-cases/upload-document.use-case';
import { PrismaDocumentRepository } from '../infrastructure/prisma-document.repository';

export class DocumentController {
  private uploadUseCase = new UploadDocumentUseCase();
  private docRepo = new PrismaDocumentRepository();
  private listQuery = new ListDocumentsQuery(this.docRepo);
  private deleteUseCase = new DeleteDocumentUseCase(this.docRepo);
  private reindexUseCase = new ReindexDocumentUseCase(this.docRepo);

  async upload(userId: string, body: unknown) {
    const dto = UploadDocumentSchema.parse(body);
    return this.uploadUseCase.execute(userId, dto);
  }

  async list(
    userId: string,
    query: { page?: string; limit?: string; status?: string; tags?: string },
  ) {
    const page = Number.parseInt(query.page || '1', 10);
    const limit = Number.parseInt(query.limit || '10', 10);
    const status =
      query.status && Object.values(DocumentStatus).includes(query.status as DocumentStatus)
        ? (query.status as DocumentStatus)
        : undefined;
    const tags = query.tags ? query.tags.split(',') : undefined;

    const result = await this.listQuery.execute({
      userId,
      page,
      limit,
      status,
      tags,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: limit,
        totalPages: result.totalPages,
      },
    };
  }

  async getById(userId: string, id: string) {
    const doc = await this.docRepo.findById(id);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', id);
    }
    return toDocumentResponseDto(doc);
  }

  async delete(userId: string, id: string) {
    await this.deleteUseCase.execute(userId, id);
    return { success: true, message: 'Document deleted successfully' };
  }

  async reindex(userId: string, id: string, body: unknown) {
    const ReindexSchema = z.object({
      chunkingStrategy: z.string().optional(),
      chunkSize: z.number().int().min(100).max(4000).optional(),
      chunkOverlap: z.number().int().min(0).max(500).optional(),
      embeddingModel: z.string().optional(),
      embeddingProvider: z.string().optional(),
    });

    let params: ReindexDocumentParams;
    try {
      params = ReindexSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw Object.assign(new Error('Validation failed'), {
          code: 'VALIDATION',
          details: error.errors,
        });
      }
      throw error;
    }

    const { jobId } = await this.reindexUseCase.execute(userId, id, params);
    return {
      documentId: id,
      jobId,
      status: 'pending',
      message: 'Re-indexing queued',
    };
  }

  async getChunks(userId: string, id: string, query: { page?: string; limit?: string }) {
    // Assert ownership
    const doc = await this.docRepo.findById(id);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError('Document', id);
    }

    const page = Number.parseInt(query.page || '1', 10);
    const limit = Number.parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const [chunks, total] = await Promise.all([
      prisma.documentChunk.findMany({
        where: { documentId: id },
        orderBy: { chunkIndex: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          pageNumber: true,
          tokenCount: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.documentChunk.count({ where: { documentId: id } }),
    ]);

    return {
      data: chunks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
