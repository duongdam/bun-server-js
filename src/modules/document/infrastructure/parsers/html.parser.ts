import { parse } from 'node-html-parser';
import { logger } from '../../../../shared/infrastructure/logger/pino.logger';
import type { IFileParser, ParsedDocument } from '../../domain/services/file-parser.service';

export class HtmlParser implements IFileParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const htmlContent = buffer.toString('utf-8');
      const root = parse(htmlContent);

      // Strip scripts and styles
      for (const node of root.querySelectorAll('script, style')) {
        node.remove();
      }

      // Extract raw text
      const text = root.textContent.replace(/\s+/g, ' ').trim();

      return {
        text,
        metadata: {
          title: root.querySelector('title')?.text,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse HTML');
      throw new Error('Failed to extract text from HTML');
    }
  }
}
