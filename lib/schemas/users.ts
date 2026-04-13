import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'cat_sitter']);

const fullName = z.string().min(1, 'Full name is required').max(120);
const email = z.string().email('Enter a valid email address');
const password = z.string().min(8, 'Password must be at least 8 characters');

export const createUserSchema = z.object({
  full_name: fullName,
  email,
  password,
  role: roleSchema
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  full_name: fullName.optional(),
  role: roleSchema.optional(),
  is_active: z.boolean().optional()
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
