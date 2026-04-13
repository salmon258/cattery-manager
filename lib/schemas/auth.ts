import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'validation.email' }),
  password: z.string().min(1, { message: 'validation.required' })
});
export type LoginInput = z.infer<typeof loginSchema>;
