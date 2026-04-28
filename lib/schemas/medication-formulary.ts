import { z } from 'zod';

import { medRouteSchema } from './medications';

export const medicationFormSchema = z.enum([
  'tablet',
  'capsule',
  'liquid',
  'injection',
  'drops',
  'powder',
  'topical',
  'other'
]);
export type MedicationFormInput = z.infer<typeof medicationFormSchema>;

// ─── Sicknesses ────────────────────────────────────────────────────────────
export const sicknessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional()
});
export type SicknessInput = z.infer<typeof sicknessSchema>;

export const sicknessUpdateSchema = sicknessSchema.partial();
export type SicknessUpdateInput = z.infer<typeof sicknessUpdateSchema>;

// ─── Medication templates (formulary) ──────────────────────────────────────
const optionalNumber = z
  .union([z.coerce.number(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : (v as number | null)));

export const medicationTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  brand: z.string().max(120).nullable().optional(),
  form: medicationFormSchema.default('tablet'),
  concentration_amount: optionalNumber.refine(
    (v) => v === null || v >= 0,
    'Must be ≥ 0'
  ),
  dose_unit: z.string().min(1).max(20).default('mg'),
  per_unit: z.string().min(1).max(30).default('tablet'),
  default_route: medRouteSchema.default('oral'),
  // Kept as plain number so the form values from the DB row (which is just
  // `number`) round-trip cleanly. The DB CHECK constraint enforces 1/2/4.
  splittable_into: z
    .coerce.number()
    .int()
    .refine((v) => [1, 2, 4].includes(v), { message: 'Use 1, 2, or 4' })
    .default(1),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional()
});
export type MedicationTemplateInput = z.infer<typeof medicationTemplateSchema>;

export const medicationTemplateUpdateSchema = medicationTemplateSchema.partial();
export type MedicationTemplateUpdateInput = z.infer<typeof medicationTemplateUpdateSchema>;

// ─── Sickness ↔ medication link ────────────────────────────────────────────
// Either dose_per_kg or flat_dose must be set. The DB has the same check;
// we pre-validate here to surface a friendlier message.
export const sicknessMedicationSchema = z
  .object({
    medication_template_id: z.string().uuid(),
    dose_per_kg: optionalNumber.refine((v) => v === null || v > 0, 'Must be > 0'),
    flat_dose:   optionalNumber.refine((v) => v === null || v > 0, 'Must be > 0'),
    min_dose:    optionalNumber.refine((v) => v === null || v >= 0, 'Must be ≥ 0'),
    max_dose:    optionalNumber.refine((v) => v === null || v >= 0, 'Must be ≥ 0'),
    frequency: z.string().max(60).nullable().optional(),
    duration_days: z
      .union([z.coerce.number().int().min(1).max(365), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : (v as number | null))),
    priority: z.coerce.number().int().min(1).max(10).default(1),
    notes: z.string().max(2000).nullable().optional()
  })
  .refine((v) => v.dose_per_kg != null || v.flat_dose != null, {
    message: 'Set either a per-kg dose or a flat dose',
    path: ['dose_per_kg']
  })
  .refine(
    (v) => v.min_dose == null || v.max_dose == null || v.min_dose <= v.max_dose,
    { message: 'Min must be ≤ max', path: ['max_dose'] }
  );
export type SicknessMedicationInput = z.infer<typeof sicknessMedicationSchema>;

// Update schema: same validation logic but every field is optional, so the
// cross-field refinements only kick in when the relevant fields are present.
export const sicknessMedicationUpdateSchema = z
  .object({
    dose_per_kg: optionalNumber,
    flat_dose:   optionalNumber,
    min_dose:    optionalNumber,
    max_dose:    optionalNumber,
    frequency: z.string().max(60).nullable().optional(),
    duration_days: z
      .union([z.coerce.number().int().min(1).max(365), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : (v as number | null))),
    priority: z.coerce.number().int().min(1).max(10).optional(),
    notes: z.string().max(2000).nullable().optional()
  })
  .refine(
    (v) => v.min_dose == null || v.max_dose == null || v.min_dose <= v.max_dose,
    { message: 'Min must be ≤ max', path: ['max_dose'] }
  );
export type SicknessMedicationUpdateInput = z.infer<typeof sicknessMedicationUpdateSchema>;
