import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { DocumentResponseDto, toDocumentResponseDto } from '../dtos/document-response.dto';
import { DocumentStatus } from '@prisma/client';

export interface ListDocumentsQueryParams {
  userId: string;
  page?: number;
  limit?: number;
  status?: DocumentStatus | undefined;
  tags?: string[] | undefined;
}

export interface PaginatedDocumentResponse {
  data: DocumentResponseDto[];
  total: number;
  page: number;
  totalPages: number;
}

export class ListDocumentsQuery {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(params: ListDocumentsQueryParams): Promise<PaginatedDocumentResponse> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    
    const result = await this.documentRepository.findByUserId(
      params.userId,
      page,
      limit,
      params.status,
      params.tags
    );

    return {
      data: result.data.map(toDocumentResponseDto),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
