import { ValidationError } from '../../../../shared/middleware/error-handler.middleware';

export class FileType {
  private static readonly ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv', 'json', 'html'];
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'text/html',
  ];

  constructor(
    public readonly extension: string,
    public readonly mimeType: string,
  ) {
    this.extension = extension.toLowerCase().replace(/^\./, '');
    this.mimeType = mimeType.toLowerCase();
    this.validate();
  }

  private validate(): void {
    if (!FileType.ALLOWED_EXTENSIONS.includes(this.extension)) {
      throw new ValidationError(`Unsupported file extension: ${this.extension}`);
    }
    if (!FileType.ALLOWED_MIME_TYPES.includes(this.mimeType)) {
      throw new ValidationError(`Unsupported MIME type: ${this.mimeType}`);
    }
  }

  static fromFilename(filename: string, mimeType: string): FileType {
    const parts = filename.split('.');
    const lastPart = parts.at(-1);
    const ext = parts.length > 1 && lastPart !== undefined ? lastPart : '';
    return new FileType(ext, mimeType);
  }
}
