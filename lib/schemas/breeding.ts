import { z } from 'zod';

export const matingRecordSchema = z.object({
  female_cat_id: z.string().uuid(),
  male_cat_id:   z.string().uuid(),
  mating_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mating_method: z.enum(['natural', 'ai']).default('natural'),
  notes:         z.string().max(5000).optional().nullable()
});

export const updateMatingStatusSchema = z.object({
  status: z.enum(['planned', 'confirmed', 'pregnant', 'delivered', 'failed']),
  notes:  z.string().max(5000).optional().nullable()
});

/**
 * Partial edit of a mating record. All fields optional so the PATCH endpoint
 * can accept either a status-only tick or a full form edit.
 */
export const editMatingRecordSchema = z.object({
  female_cat_id: z.string().uuid().optional(),
  male_cat_id:   z.string().uuid().optional(),
  mating_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mating_method: z.enum(['natural', 'ai']).optional(),
  status:        z.enum(['planned', 'confirmed', 'pregnant', 'delivered', 'failed']).optional(),
  notes:         z.string().max(5000).optional().nullable()
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field must be provided' }
);

/**
 * Assign / clear parents for an existing cat. Either side may be null (unset).
 * The API is additionally responsible for making sure mother_id references a
 * female and father_id a male — we don't duplicate that check here because
 * Zod can't query the database.
 */
export const assignParentsSchema = z.object({
  mother_id: z.string().uuid().nullable(),
  father_id: z.string().uuid().nullable()
});

export const kittenInputSchema = z.object({
  name:   z.string().min(1).max(100),
  gender: z.enum(['male', 'female'])
});

export const litterSchema = z.object({
  birth_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  litter_size_born:     z.number().int().min(1),
  litter_size_survived: z.number().int().min(0).optional().nullable(),
  notes:                z.string().max(5000).optional().nullable(),
  kittens:              z.array(kittenInputSchema).min(0)
});

export const heatLogSchema = z.object({
  observed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  intensity:     z.enum(['mild', 'moderate', 'strong']),
  notes:         z.string().max(2000).optional().nullable()
});
