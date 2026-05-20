import { z } from 'zod';

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
    ALLOWED_ORIGINS: z.string().optional(),
    EMBEDDING_PROVIDER: z.string().default('gemini'),
    EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
    /** Must match DB column `embeddings.vector` — 768 (Gemini `gemini-embedding-2` with outputDimensionality), 384 (local/MiniLM), 1536 (OpenAI small), 3072 (large) */
    EMBEDDING_DIMENSION: z.coerce.number().int().positive().optional(),
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    HUGGINGFACE_API_KEY: z.string().optional(),
    LOCAL_MODEL: z.string().optional(),
    NPM_PACKAGE_VERSION: z.string().default('1.0.0'),
    LOG_LEVEL: z.string().default('info'),
    SEED_ADMIN_EMAIL: z.string().email().default('admin@gmail.com'),
    SEED_ADMIN_PASSWORD: z.string().min(8).default('ryan@123'),
    AUTH_DEV_BYPASS: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'test') return;
    if (data.EMBEDDING_PROVIDER.toLowerCase() === 'gemini') {
      const key = data.GEMINI_API_KEY?.trim();
      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini',
          path: ['GEMINI_API_KEY'],
        });
      }
    }
  });

export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env) {
  return serverEnvSchema.safeParse(source);
}

/** Log-safe preview — never log full secrets. */
export function maskSecret(value: string | undefined, visible = 4): string {
  if (!value) return '(not set)';
  if (value.length <= visible * 2) return '***';
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
