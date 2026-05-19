import { z } from 'zod';

export const UploadDocumentSchema = z.object({
  file: z.instanceof(File, { message: 'File is required' }),
  chunkingStrategy: z.enum(['recursive', 'semantic', 'token']).default('recursive'),
  chunkSize: z.coerce.number().min(64).max(2048).default(512),
  chunkOverlap: z.coerce.number().min(0).max(1024).default(50),
  embeddingProvider: z.string().default(process.env.EMBEDDING_PROVIDER || 'openai'),
  embeddingModel: z.string().default(process.env.EMBEDDING_MODEL || 'text-embedding-3-small'),
  tags: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return val;
  }, z.array(z.string()).default([])),
  metadata: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    return val ?? {};
  }, z.record(z.unknown()).default({})),
});

export type UploadDocumentDto = z.infer<typeof UploadDocumentSchema>;
