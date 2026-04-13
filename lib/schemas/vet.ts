import { z } from 'zod';

// ─── Clinic ──────────────────────────────────────────────────────────────────
export const clinicSchema = z.object({
  name:    z.string().min(1).max(200),
  address: z.string().max(1000).nullable().optional(),
  phone:   z.string().max(50).nullable().optional(),
  email:   z.string().email().max(200).nullable().optional().or(z.literal('')),
  website: z.string().max(500).nullable().optional().or(z.literal('')),
  notes:   z.string().max(2000).nullable().optional(),
  is_active: z.boolean().default(true)
});
export type ClinicInput = z.infer<typeof clinicSchema>;

// ─── Doctor ──────────────────────────────────────────────────────────────────
export const doctorSpecialisationEnum = z.enum([
  'general', 'dermatology', 'cardiology', 'oncology', 'dentistry', 'surgery', 'other'
]);

export const doctorSchema = z.object({
  full_name:      z.string().min(1).max(200),
  clinic_id:      z.string().uuid().nullable().optional(),
  specialisation: doctorSpecialisationEnum.default('general'),
  phone:          z.string().max(50).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
  is_active:      z.boolean().default(true)
});
export type DoctorInput = z.infer<typeof doctorSchema>;

// ─── Vet Visit ───────────────────────────────────────────────────────────────
export const vetVisitTypeEnum = z.enum([
  'routine_checkup', 'emergency', 'follow_up', 'vaccination', 'surgery', 'dental', 'other'
]);
export const vetVisitStatusEnum = z.enum([
  'scheduled', 'in_progress', 'completed', 'cancelled'
]);

const timeSlotRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const vetVisitMedicineSchema = z.object({
  medicine_name: z.string().min(1).max(200),
  dose:          z.string().max(200).nullable().optional(),
  frequency:     z.string().max(200).nullable().optional(),
  duration:      z.string().max(200).nullable().optional(),
  notes:         z.string().max(1000).nullable().optional(),
  // Optional structured scheduling — when true, the API auto-creates a
  // medications row + daily tasks alongside this vet_visit_medicines record.
  schedule_enabled:       z.boolean().default(false),
  schedule_start_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  schedule_end_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  schedule_interval_days: z.number().int().min(1).max(365).nullable().optional(),
  schedule_time_slots:    z.array(z.string().regex(timeSlotRegex)).optional(),
  schedule_route:         z.enum(['oral', 'topical', 'injection', 'other']).nullable().optional()
}).refine(
  (v) => {
    if (!v.schedule_enabled) return true;
    return !!v.schedule_start_date && !!v.schedule_end_date
      && !!v.schedule_time_slots && v.schedule_time_slots.length > 0
      && v.schedule_end_date >= v.schedule_start_date;
  },
  { message: 'Schedule requires start, end (≥ start) and at least one time slot.' }
);
export type VetVisitMedicineInput = z.infer<typeof vetVisitMedicineSchema>;

export const vetVisitSchema = z.object({
  clinic_id:           z.string().uuid().nullable().optional(),
  doctor_id:           z.string().uuid().nullable().optional(),
  health_ticket_id:    z.string().uuid().nullable().optional(),
  visit_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visit_type:          vetVisitTypeEnum.default('routine_checkup'),
  status:              vetVisitStatusEnum.default('completed'),
  chief_complaint:     z.string().max(1000).nullable().optional(),
  diagnosis:           z.string().max(5000).nullable().optional(),
  treatment_performed: z.string().max(5000).nullable().optional(),
  follow_up_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  visit_cost:          z.number().nonnegative().nullable().optional(),
  transport_cost:      z.number().nonnegative().nullable().optional(),
  notes:               z.string().max(5000).nullable().optional(),
  medicines:           z.array(vetVisitMedicineSchema).default([])
});
export type VetVisitInput = z.infer<typeof vetVisitSchema>;

// ─── Lab Result / Receipt ────────────────────────────────────────────────────
export const labResultSchema = z.object({
  file_url:        z.string().url(),
  storage_path:    z.string().min(1),
  file_type:       z.enum(['pdf', 'image']),
  file_name:       z.string().min(1).max(500),
  file_size_bytes: z.number().int().nonnegative().nullable().optional(),
  notes:           z.string().max(1000).nullable().optional(),
  kind:            z.enum(['lab_result', 'receipt']).default('lab_result')
});
export type LabResultInput = z.infer<typeof labResultSchema>;
