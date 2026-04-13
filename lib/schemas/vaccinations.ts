import { z } from 'zod';

export const vaccineTypeSchema = z.enum(['f3', 'f4', 'tricat', 'felv', 'rabies', 'other']);
export type VaccineTypeInput = z.infer<typeof vaccineTypeSchema>;

// Default interval (days) used by the client to pre-fill next_due_date from
// administered_date. Admin can override the pre-filled value in the form.
export const VACCINE_DEFAULT_INTERVAL_DAYS: Record<VaccineTypeInput, number | null> = {
  f3: 365,
  f4: 365,
  tricat: 365,
  felv: 365,
  rabies: 365,
  other: null
};

const vaccinationBaseSchema = z.object({
  vaccine_type: vaccineTypeSchema,
  vaccine_name: z.string().max(120).nullable().optional(),
  administered_date: z.string().min(1, 'Required'),
  batch_number: z.string().max(60).nullable().optional(),
  administered_by_vet: z.string().max(120).nullable().optional(),
  next_due_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const vaccinationSchema = vaccinationBaseSchema.refine(
  (v) => v.vaccine_type !== 'other' || (v.vaccine_name && v.vaccine_name.trim().length > 0),
  { message: 'Vaccine name is required when type is "Other"', path: ['vaccine_name'] }
);
export type VaccinationInput = z.infer<typeof vaccinationSchema>;

export const vaccinationUpdateSchema = vaccinationBaseSchema.partial();
export type VaccinationUpdateInput = z.infer<typeof vaccinationUpdateSchema>;
