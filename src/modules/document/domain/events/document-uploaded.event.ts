import { DomainEvent } from '../../../../shared/domain/domain-event';

export class DocumentUploadedEvent extends DomainEvent {
  readonly eventType = 'DocumentUploaded';

  constructor(
    public readonly documentId: string,
    public readonly filename: string,
    public readonly mimeType: string,
    public readonly userId: string,
  ) {
    super();
  }
}
