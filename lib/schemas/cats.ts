import { z } from 'zod';

export const catGenderSchema = z.enum(['male', 'female']);
export const catStatusSchema = z.enum(['active', 'retired', 'deceased', 'sold']);

export const catSchema = z.object({
  name: z.string().min(1).max(100),
  date_of_birth: z.string().min(1),
  gender: catGenderSchema,
  breed: z.string().max(100).nullable().optional(),
  microchip_number: z.string().max(50).nullable().optional(),
  registration_number: z.string().max(50).nullable().optional(),
  color_pattern: z.string().max(100).nullable().optional(),
  status: catStatusSchema.default('active'),
  is_spayed: z.boolean().default(false),
  assignee_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional()
});
export type CatInput = z.infer<typeof catSchema>;

export const catUpdateSchema = catSchema.partial();
export type CatUpdateInput = z.infer<typeof catUpdateSchema>;
