import { z } from 'zod';

export const SearchResultSchema = z.object({
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  filename: z.string(),
  content: z.string(),
  pageNumber: z.number().optional(),
  chunkIndex: z.number(),
  similarityScore: z.number().optional(),
  rankScore: z.number().optional(),
});

export type SearchResultDto = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  /** Same payload as structured `results`, in CommonMark / GFM Markdown (tables + fenced excerpts). */
  markdown: z.string(),
  query: z.string(),
  searchType: z.string(),
  latencyMs: z.number(),
});

export type SearchResponseDto = z.infer<typeof SearchResponseSchema>;
