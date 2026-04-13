import { z } from 'zod';

export const preventiveTypeSchema = z.enum(['deworming', 'flea', 'combined']);
export type PreventiveTypeInput = z.infer<typeof preventiveTypeSchema>;

// Default interval for pre-filling next_due_date (spec suggests ~3 months).
export const PREVENTIVE_DEFAULT_INTERVAL_DAYS = 90;

export const preventiveTreatmentSchema = z.object({
  treatment_type: preventiveTypeSchema,
  product_name: z.string().min(1, 'Product name is required').max(120),
  administered_date: z.string().min(1, 'Required'),
  next_due_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});
export type PreventiveTreatmentInput = z.infer<typeof preventiveTreatmentSchema>;
