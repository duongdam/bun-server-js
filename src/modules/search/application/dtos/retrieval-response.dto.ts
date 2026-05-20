import { z } from 'zod';

export const RetrievalSourceSchema = z.object({
  documentId: z.string().uuid(),
  filename: z.string(),
  pageNumber: z.number().optional(),
  chunkIndex: z.number(),
});

export const RetrievalContextSchema = z.object({
  text: z.string(),
  source: RetrievalSourceSchema,
  score: z.number(),
});

export const RetrievalResponseSchema = z.object({
  context: z.array(RetrievalContextSchema),
  /** CommonMark / GFM Markdown view of query + packed context. */
  markdown: z.string(),
  totalTokens: z.number(),
  sources: z.array(z.string().uuid()),
  query: z.string(),
  latencyMs: z.number(),
});

export type RetrievalContextDto = z.infer<typeof RetrievalContextSchema>;
export type RetrievalResponseDto = z.infer<typeof RetrievalResponseSchema>;
