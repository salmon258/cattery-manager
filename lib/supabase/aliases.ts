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
export type TicketSeverity  = Database['public']['Enums']['ticket_severity']
export type TicketStatus    = Database['public']['Enums']['ticket_status']
export type TicketEventType = Database['public']['Enums']['ticket_event_type']
