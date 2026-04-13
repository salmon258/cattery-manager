import { z } from 'zod';

export const medRouteSchema = z.enum(['oral', 'topical', 'injection', 'other']);
export type MedRouteInput = z.infer<typeof medRouteSchema>;

// Matches "HH:MM" — we store a text[] of these on medications.time_slots.
const timeSlotRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const medicationSchema = z
  .object({
    medicine_name: z.string().min(1, 'Name is required').max(120),
    dose: z.string().min(1, 'Dose is required').max(60),
    route: medRouteSchema.default('oral'),
    start_date: z.string().min(1, 'Required'),
    end_date: z.string().min(1, 'Required'),
    interval_days: z.coerce.number().int().min(1).max(365).default(1),
    time_slots: z
      .array(z.string().regex(timeSlotRegex, 'Use HH:MM'))
      .min(1, 'Add at least one time slot'),
    notes: z.string().max(2000).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date']
  });
export type MedicationInput = z.infer<typeof medicationSchema>;

export const medicationUpdateSchema = medicationSchema
  .innerType()
  .partial()
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] }
  );
export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>;

export const adHocMedicineSchema = z.object({
  medicine_name: z.string().min(1, 'Required').max(120),
  dose: z.string().max(60).nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  route: medRouteSchema.default('oral'),
  given_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2000).nullable().optional()
});
export type AdHocMedicineInput = z.infer<typeof adHocMedicineSchema>;

export const taskSkipSchema = z.object({
  reason: z.string().max(500).nullable().optional()
});
export type TaskSkipInput = z.infer<typeof taskSkipSchema>;
