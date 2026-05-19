import mammoth from 'mammoth';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { IFileParser, ParsedDocument } from '../../domain/services/file-parser.service';

export class DocxParser implements IFileParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      // We could also use extractDocument to get headings and structure,
      // but for raw text extraction extractRawText is faster.
      return {
        text: result.value,
        metadata: {
          messages: result.messages,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse DOCX');
      throw new Error('Failed to extract text from DOCX');
    }
  }
}
