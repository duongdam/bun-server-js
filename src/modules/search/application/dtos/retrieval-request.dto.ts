import { z } from 'zod';

export const RetrievalRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  topK: z.number().int().min(1).max(50).default(5),
  maxTokens: z.number().int().min(100).max(8192).default(2048),
  similarityThreshold: z.number().min(0).max(1).default(0.65),
  filters: z.record(z.any()).optional(),
});

export type RetrievalRequestDto = z.infer<typeof RetrievalRequestSchema>;
