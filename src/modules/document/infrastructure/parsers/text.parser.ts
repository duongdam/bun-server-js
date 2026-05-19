import { IFileParser, ParsedDocument } from '../../domain/services/file-parser.service';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class TextParser implements IFileParser {
  async parse(buffer: Buffer, mimeType?: string): Promise<ParsedDocument> {
    try {
      const text = buffer.toString('utf-8');
      const metadata: Record<string, unknown> = {};

      if (mimeType === 'application/json') {
        try {
          // Validate and pretty-print JSON so chunking works better
          const parsed = JSON.parse(text);
          return {
            text: JSON.stringify(parsed, null, 2),
            metadata: { format: 'json' },
          };
        } catch (e) {
          logger.warn('Invalid JSON format, treating as raw text');
        }
      }

      // For CSV, Markdown, TXT, we just return the raw text
      return {
        text,
        metadata,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse text file');
      throw new Error('Failed to extract text from file');
    }
  }
}
