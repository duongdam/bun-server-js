import * as pdfParse from 'pdf-parse';
const pdf = (pdfParse as any).default || pdfParse;
import { IFileParser, ParsedDocument } from '../../domain/services/file-parser.service';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';

export class PdfParser implements IFileParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const data = await pdf(buffer);
      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: {
          info: data.info,
          version: data.version,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse PDF');
      throw new Error('Failed to extract text from PDF');
    }
  }
}
