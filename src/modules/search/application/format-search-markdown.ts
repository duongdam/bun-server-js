import type { SearchResultItem } from '../domain/repositories/search.repository.interface';

/** Safe for single-line `` `...` `` (escape backticks and backslashes). */
function inlineCode(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

/** Fenced code block; lengthens fence if body contains the same run of backticks. */
export function fencedCodeBlock(raw: string, info = 'text'): string {
  const body = raw.replace(/\r\n/g, '\n');
  let fence = '```';
  while (body.includes(fence)) {
    fence += '`';
    if (fence.length > 40) break;
  }
  return `${fence}${info}\n${body}\n${fence}\n`;
}

export type MarkdownSearchHit = {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  similarityScore?: number;
  rankScore?: number;
};

/** Map repository hits to `MarkdownSearchHit` without assigning `undefined` to optional keys (`exactOptionalPropertyTypes`). */
export function searchResultToMarkdownHit(r: SearchResultItem): MarkdownSearchHit {
  const hit: MarkdownSearchHit = {
    chunkId: r.chunkId,
    documentId: r.documentId,
    filename: r.filename,
    content: r.content,
    chunkIndex: r.chunkIndex,
  };
  if (r.pageNumber !== undefined) {
    hit.pageNumber = r.pageNumber;
  }
  if (r.similarityScore !== undefined) {
    hit.similarityScore = r.similarityScore;
  }
  if (r.rankScore !== undefined) {
    hit.rankScore = r.rankScore;
  }
  return hit;
}

export function searchResultsToMarkdownHits(results: SearchResultItem[]): MarkdownSearchHit[] {
  return results.map(searchResultToMarkdownHit);
}

/**
 * CommonMark-style Markdown for search JSON / SSE `meta`: query, type, then each hit with metadata + fenced excerpt.
 */
export function formatSearchResultsMarkdown(
  query: string,
  searchType: string,
  results: MarkdownSearchHit[],
): string {
  const lines: string[] = [];
  lines.push('## Search results');
  lines.push('');
  lines.push(`- **Search type:** \`${inlineCode(searchType)}\``);
  lines.push('- **Query:**');
  lines.push('');
  lines.push(fencedCodeBlock(query, 'text'));
  lines.push('');
  lines.push('### Hits');
  lines.push('');

  if (results.length === 0) {
    lines.push('*No results.*');
    return `${lines.join('\n').trimEnd()}\n`;
  }

  for (const [i, r] of results.entries()) {
    const title =
      r.filename
        .replace(/\r?\n/g, ' ')
        .replace(/^(\s*#)+/, '')
        .trim() || 'untitled';
    lines.push(`#### ${i + 1}. ${title}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('| --- | --- |');
    lines.push(`| \`chunkId\` | \`${inlineCode(r.chunkId)}\` |`);
    lines.push(`| \`documentId\` | \`${inlineCode(r.documentId)}\` |`);
    lines.push(`| \`chunkIndex\` | \`${r.chunkIndex}\` |`);
    if (r.pageNumber !== undefined) {
      lines.push(`| \`page\` | \`${r.pageNumber}\` |`);
    }
    if (r.similarityScore !== undefined) {
      lines.push(`| \`similarity\` | \`${r.similarityScore}\` |`);
    }
    if (r.rankScore !== undefined) {
      lines.push(`| \`rank\` | \`${r.rankScore}\` |`);
    }
    lines.push('');
    lines.push('**Excerpt**');
    lines.push('');
    lines.push(fencedCodeBlock(r.content, 'text'));
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export type RagContextLine = {
  text: string;
  score: number;
  source: {
    documentId: string;
    filename: string;
    pageNumber?: number;
    chunkIndex: number;
  };
};

/** Markdown summary for RAG retrieval JSON. */
export function formatRagRetrievalMarkdown(
  query: string,
  context: RagContextLine[],
  totalTokens: number,
  sources: string[],
): string {
  const lines: string[] = [];
  lines.push('## RAG retrieval');
  lines.push('');
  lines.push(`- **Approx. tokens packed:** \`${totalTokens}\``);
  lines.push(`- **Distinct sources:** \`${sources.length}\``);
  lines.push('- **Query:**');
  lines.push('');
  lines.push(fencedCodeBlock(query, 'text'));
  lines.push('');
  lines.push('### Context chunks');
  lines.push('');

  if (context.length === 0) {
    lines.push('*No context packed.*');
    return `${lines.join('\n').trimEnd()}\n`;
  }

  for (const [i, c] of context.entries()) {
    const fn =
      c.source.filename
        .replace(/\r?\n/g, ' ')
        .replace(/^(\s*#)+/, '')
        .trim() || 'untitled';
    lines.push(`#### ${i + 1}. ${fn}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('| --- | --- |');
    lines.push(`| \`documentId\` | \`${inlineCode(c.source.documentId)}\` |`);
    lines.push(`| \`chunkIndex\` | \`${c.source.chunkIndex}\` |`);
    if (c.source.pageNumber !== undefined) {
      lines.push(`| \`page\` | \`${c.source.pageNumber}\` |`);
    }
    lines.push(`| \`score\` | \`${c.score}\` |`);
    lines.push('');
    lines.push('**Text**');
    lines.push('');
    lines.push(fencedCodeBlock(c.text, 'text'));
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
