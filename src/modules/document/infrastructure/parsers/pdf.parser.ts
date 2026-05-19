import * as pdfParseModule from 'pdf-parse';

interface PdfParseResult {
  text: string;
  numpages: number;
  info: unknown;
  version: string;
}

type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

const pdf: PdfParseFn =
  typeof pdfParseModule === 'function'
    ? (pdfParseModule as PdfParseFn)
    : (pdfParseModule as unknown as { default: PdfParseFn }).default;
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { IFileParser, ParsedDocument } from '../../domain/services/file-parser.service';

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
