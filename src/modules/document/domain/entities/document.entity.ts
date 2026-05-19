import { DocumentStatus } from '@prisma/client';
import { BaseEntity } from '../../../../shared/domain/base.entity';
import { DomainEventEmitter } from '../../../../shared/domain/domain-event';
import { DocumentUploadedEvent } from '../events/document-uploaded.event';
import type { ChunkingConfig } from '../value-objects/chunking-config.vo';

export interface DocumentProps {
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  contentHash: string;
  chunkingConfig: ChunkingConfig;
  embeddingModel: string;
  embeddingDimension: number;
  embeddingProvider: string;
  tags: string[];
  metadata: Record<string, unknown>;
  pageCount?: number;
  wordCount?: number;
  language?: string;
  indexedAt?: Date;
}

export class Document extends BaseEntity {
  public readonly userId: string;
  public readonly filename: string;
  public readonly mimeType: string;
  public readonly fileSize: number;
  public status: DocumentStatus;
  public readonly contentHash: string;
  public chunkingConfig: ChunkingConfig;
  public embeddingModel: string;
  public readonly embeddingDimension: number;
  public embeddingProvider: string;
  public readonly tags: string[];
  public metadata: Record<string, unknown>;
  public pageCount?: number;
  public wordCount?: number;
  public language?: string;
  public indexedAt?: Date;

  public readonly events = new DomainEventEmitter();

  constructor(id: string | undefined, props: DocumentProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this.userId = props.userId;
    this.filename = props.filename;
    this.mimeType = props.mimeType;
    this.fileSize = props.fileSize;
    this.status = props.status;
    this.contentHash = props.contentHash;
    this.chunkingConfig = props.chunkingConfig;
    this.embeddingModel = props.embeddingModel;
    this.embeddingDimension = props.embeddingDimension;
    this.embeddingProvider = props.embeddingProvider;
    this.tags = props.tags;
    this.metadata = props.metadata;
    this.pageCount = props.pageCount ?? 0;
    this.wordCount = props.wordCount ?? 0;
    this.language = props.language ?? '';
    this.indexedAt = props.indexedAt ?? new Date();
  }

  static create(props: Omit<DocumentProps, 'status'>): Document {
    const doc = new Document(undefined, {
      ...props,
      status: DocumentStatus.PENDING,
    });

    doc.events.addDomainEvent(
      new DocumentUploadedEvent(doc.id, doc.filename, doc.mimeType, doc.userId),
    );
    return doc;
  }

  markProcessing(): void {
    this.status = DocumentStatus.PROCESSING;
    this.touch();
  }

  markIndexed(pageCount?: number, wordCount?: number, language?: string): void {
    this.status = DocumentStatus.INDEXED;
    this.indexedAt = new Date();
    if (pageCount !== undefined) this.pageCount = pageCount;
    if (wordCount !== undefined) this.wordCount = wordCount;
    if (language !== undefined) this.language = language;
    this.touch();
  }

  markFailed(error?: string): void {
    this.status = DocumentStatus.FAILED;
    if (error) {
      this.metadata = { ...this.metadata, error };
    }
    this.touch();
  }
}
