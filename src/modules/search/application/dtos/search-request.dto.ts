import { z } from 'zod';

export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  searchType: z.enum(['semantic', 'hybrid', 'keyword']).default('semantic'),
  topK: z.number().int().min(1).max(100).default(10),
  similarityThreshold: z.number().min(0).max(1).default(0.3),
  filters: z.record(z.any()).optional(), // Assuming a simple map for now, can be expanded to array of SearchFilters
  /** When true, returns `text/event-stream` with search `meta` then Gemini answer `delta` events (requires GEMINI_API_KEY). */
  streaming: z.coerce.boolean().optional().default(false),
});

export type SearchRequestDto = z.infer<typeof SearchRequestSchema>;
