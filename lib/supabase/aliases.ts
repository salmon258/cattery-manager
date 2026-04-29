/**
 * Human-friendly type aliases derived from the auto-generated Database type.
 * Keep all hand-written type exports here so supabase gen types can overwrite
 * lib/supabase/types.ts freely without losing these definitions.
 */
import type { Database } from './types';

// ─── Tables ──────────────────────────────────────────────────────────────────
export type Profile             = Database['public']['Tables']['profiles']['Row']
export type Cat                 = Database['public']['Tables']['cats']['Row']
export type CatPhoto            = Database['public']['Tables']['cat_photos']['Row']
export type Room                = Database['public']['Tables']['rooms']['Row']
export type RoomMovement        = Database['public']['Tables']['room_movements']['Row']
export type WeightLog           = Database['public']['Tables']['weight_logs']['Row']
export type FoodItem            = Database['public']['Tables']['food_items']['Row']
export type EatingLog           = Database['public']['Tables']['eating_logs']['Row']
export type EatingLogItem       = Database['public']['Tables']['eating_log_items']['Row']
export type Vaccination         = Database['public']['Tables']['vaccinations']['Row']
export type PreventiveTreatment = Database['public']['Tables']['preventive_treatments']['Row']
export type Medication          = Database['public']['Tables']['medications']['Row']
export type MedicationTask      = Database['public']['Tables']['medication_tasks']['Row']
export type AdHocMedicine       = Database['public']['Tables']['ad_hoc_medicines']['Row']
export type PushSubscription    = Database['public']['Tables']['push_subscriptions']['Row']
export type BackgroundSyncQueue = Database['public']['Tables']['background_sync_queue']['Row']
export type HealthTicket        = Database['public']['Tables']['health_tickets']['Row']
export type HealthTicketEvent   = Database['public']['Tables']['health_ticket_events']['Row']
export type Sickness            = Database['public']['Tables']['sicknesses']['Row']
export type MedicationTemplate  = Database['public']['Tables']['medication_templates']['Row']
export type SicknessMedication  = Database['public']['Tables']['sickness_medications']['Row']

// ─── Enums ───────────────────────────────────────────────────────────────────
export type UserRole      = Database['public']['Enums']['user_role']
export type ThemePref     = Database['public']['Enums']['theme_pref']
export type LangCode      = Database['public']['Enums']['lang_code']
export type CatGender     = Database['public']['Enums']['cat_gender']
export type CatStatus     = Database['public']['Enums']['cat_status']
export type RoomType      = Database['public']['Enums']['room_type']
export type FoodType      = Database['public']['Enums']['food_type']
export type FoodUnit      = Database['public']['Enums']['food_unit']
export type FeedingMethod = Database['public']['Enums']['feeding_method']
export type EatenRatio    = Database['public']['Enums']['eaten_ratio']
export type VaccineType   = Database['public']['Enums']['vaccine_type']
export type PreventiveType  = Database['public']['Enums']['preventive_treatment_type']
export type MedRoute      = Database['public']['Enums']['med_route']
export type MedicationForm = Database['public']['Enums']['medication_form']
export type TicketSeverity  = Database['public']['Enums']['ticket_severity']
export type TicketStatus    = Database['public']['Enums']['ticket_status']
export type TicketEventType = Database['public']['Enums']['ticket_event_type']

// ─── Phase 9 — Breeding (uncomment after migration + supabase gen types) ─────
// export type MatingRecord  = Database['public']['Tables']['mating_records']['Row']
// export type Litter        = Database['public']['Tables']['litters']['Row']
// export type CatLineage    = Database['public']['Tables']['cat_lineage']['Row']
// export type HeatLog       = Database['public']['Tables']['heat_logs']['Row']
// export type MatingMethod  = Database['public']['Enums']['mating_method']
// export type MatingStatus  = Database['public']['Enums']['mating_status']
// export type HeatIntensity = Database['public']['Enums']['heat_intensity']

// ─── Phase 10 — Vet & Medical (uncomment after migration + regen) ────────────
// export type Clinic              = Database['public']['Tables']['clinics']['Row']
// export type Doctor              = Database['public']['Tables']['doctors']['Row']
// export type VetVisit            = Database['public']['Tables']['vet_visits']['Row']
// export type VetVisitMedicine    = Database['public']['Tables']['vet_visit_medicines']['Row']
// export type LabResult           = Database['public']['Tables']['lab_results']['Row']
// export type DoctorSpecialisation = Database['public']['Enums']['doctor_specialisation']
// export type VetVisitType        = Database['public']['Enums']['vet_visit_type']
// export type VetVisitStatus      = Database['public']['Enums']['vet_visit_status']
// export type LabResultFileType   = Database['public']['Enums']['lab_result_file_type']

// ─── Phase 12 — System Settings (uncomment after migration + regen) ──────────
// export type SystemSettings      = Database['public']['Tables']['system_settings']['Row']
