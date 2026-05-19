import { Document } from '../../domain/entities/document.entity';

export interface DocumentResponseDto {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  tags: string[];
  pageCount?: number | undefined;
  wordCount?: number | undefined;
  language?: string | undefined;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string | undefined;
}

export interface DocumentListResponseDto {
  data: DocumentResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function toDocumentResponseDto(doc: Document): DocumentResponseDto {
  return {
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    status: doc.status,
    tags: doc.tags,
    pageCount: doc.pageCount,
    wordCount: doc.wordCount,
    language: doc.language,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    indexedAt: doc.indexedAt?.toISOString(),
  };
}
