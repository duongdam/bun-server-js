import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255).optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
