export interface ParsedDocument {
  text: string;
  pageCount?: number;
  metadata: Record<string, unknown>;
}

export interface IFileParser {
  parse(buffer: Buffer, mimeType?: string): Promise<ParsedDocument>;
}
