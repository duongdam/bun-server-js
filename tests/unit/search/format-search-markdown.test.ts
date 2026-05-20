import { describe, expect, test } from 'bun:test';
import {
  formatRagRetrievalMarkdown,
  formatSearchResultsMarkdown,
} from '../../../src/modules/search/application/format-search-markdown';

describe('formatSearchResultsMarkdown', () => {
  test('produces CommonMark headings and fenced excerpts', () => {
    const md = formatSearchResultsMarkdown('hello **world**', 'semantic', [
      {
        chunkId: '00000000-0000-4000-8000-000000000001',
        documentId: '00000000-0000-4000-8000-000000000002',
        filename: 'a.txt',
        content: 'line1\n```\nline2',
        chunkIndex: 0,
        similarityScore: 0.9,
      },
    ]);
    expect(md).toContain('## Search results');
    expect(md).toContain('### Hits');
    expect(md).toContain('#### 1.');
    expect(md).toContain('| `similarity` | `0.9` |');
    expect(md).toMatch(/```+text/);
  });
});

describe('formatRagRetrievalMarkdown', () => {
  test('includes query fence and context sections', () => {
    const md = formatRagRetrievalMarkdown(
      'q?',
      [
        {
          text: 'ctx',
          score: 0.5,
          source: {
            documentId: '00000000-0000-4000-8000-000000000003',
            filename: 'b.md',
            chunkIndex: 1,
          },
        },
      ],
      10,
      ['00000000-0000-4000-8000-000000000003'],
    );
    expect(md).toContain('## RAG retrieval');
    expect(md).toContain('### Context chunks');
    expect(md).toContain('**Text**');
  });
});
