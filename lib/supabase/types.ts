export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_hoc_medicines: {
        Row: {
          cat_id: string
          created_at: string
          dose: string | null
          given_at: string
          id: string
          medicine_name: string
          notes: string | null
          route: Database["public"]["Enums"]["med_route"]
          submitted_by: string | null
          unit: string | null
        }
        Insert: {
          cat_id: string
          created_at?: string
          dose?: string | null
          given_at?: string
          id?: string
          medicine_name: string
          notes?: string | null
          route?: Database["public"]["Enums"]["med_route"]
          submitted_by?: string | null
          unit?: string | null
        }
        Update: {
          cat_id?: string
          created_at?: string
          dose?: string | null
          given_at?: string
          id?: string
          medicine_name?: string
          notes?: string | null
          route?: Database["public"]["Enums"]["med_route"]
          submitted_by?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_hoc_medicines_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_hoc_medicines_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "ad_hoc_medicines_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignee_change_log: {
        Row: {
          cat_id: string
          changed_at: string
          changed_by: string | null
          from_assignee_id: string | null
          id: string
          note: string | null
          to_assignee_id: string | null
        }
        Insert: {
          cat_id: string
          changed_at?: string
          changed_by?: string | null
          from_assignee_id?: string | null
          id?: string
          note?: string | null
          to_assignee_id?: string | null
        }
        Update: {
          cat_id?: string
          changed_at?: string
          changed_by?: string | null
          from_assignee_id?: string | null
          id?: string
          note?: string | null
          to_assignee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignee_change_log_cat_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignee_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "assignee_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignee_change_log_from_fkey"
            columns: ["from_assignee_id"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "assignee_change_log_from_fkey"
            columns: ["from_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignee_change_log_to_fkey"
            columns: ["to_assignee_id"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "assignee_change_log_to_fkey"
            columns: ["to_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      background_sync_queue: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cat_lineage: {
        Row: {
          father_id: string | null
          id: string
          kitten_id: string
          litter_id: string | null
          mother_id: string | null
        }
        Insert: {
          father_id?: string | null
          id?: string
          kitten_id: string
          litter_id?: string | null
          mother_id?: string | null
        }
        Update: {
          father_id?: string | null
          id?: string
          kitten_id?: string
          litter_id?: string | null
          mother_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_lineage_father_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_lineage_kitten_fkey"
            columns: ["kitten_id"]
            isOneToOne: true
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_lineage_litter_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_lineage_mother_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_photos: {
        Row: {
          cat_id: string
          created_at: string
          created_by: string | null
          id: string
          is_profile: boolean
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          cat_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_profile?: boolean
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          cat_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_profile?: boolean
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_photos_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "cat_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cats: {
        Row: {
          assignee_id: string | null
          breed: string | null
          color_pattern: string | null
          created_at: string
          created_by: string | null
          current_room_id: string | null
          date_of_birth: string
          gender: Database["public"]["Enums"]["cat_gender"]
          id: string
          life_stage_multiplier: number
          microchip_number: string | null
          name: string
          notes: string | null
          pedigree_photo_url: string | null
          profile_photo_url: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["cat_status"]
          status_changed_at: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          breed?: string | null
          color_pattern?: string | null
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth: string
          gender: Database["public"]["Enums"]["cat_gender"]
          id?: string
          life_stage_multiplier?: number
          microchip_number?: string | null
          name: string
          notes?: string | null
          pedigree_photo_url?: string | null
          profile_photo_url?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["cat_status"]
          status_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          breed?: string | null
          color_pattern?: string | null
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth?: string
          gender?: Database["public"]["Enums"]["cat_gender"]
          id?: string
          life_stage_multiplier?: number
          microchip_number?: string | null
          name?: string
          notes?: string | null
          pedigree_photo_url?: string | null
          profile_photo_url?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["cat_status"]
          status_changed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cats_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "cats_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "cats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cats_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          clinic_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          specialisation: Database["public"]["Enums"]["doctor_specialisation"]
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          specialisation?: Database["public"]["Enums"]["doctor_specialisation"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          specialisation?: Database["public"]["Enums"]["doctor_specialisation"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      eating_log_items: {
        Row: {
          calories_per_gram_snapshot: number
          created_at: string
          eating_log_id: string
          estimated_kcal_consumed: number | null
          food_item_id: string
          id: string
          quantity_eaten: Database["public"]["Enums"]["eaten_ratio"]
          quantity_given_g: number
        }
        Insert: {
          calories_per_gram_snapshot: number
          created_at?: string
          eating_log_id: string
          estimated_kcal_consumed?: number | null
          food_item_id: string
          id?: string
          quantity_eaten?: Database["public"]["Enums"]["eaten_ratio"]
          quantity_given_g: number
        }
        Update: {
          calories_per_gram_snapshot?: number
          created_at?: string
          eating_log_id?: string
          estimated_kcal_consumed?: number | null
          food_item_id?: string
          id?: string
          quantity_eaten?: Database["public"]["Enums"]["eaten_ratio"]
          quantity_given_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "eating_log_items_eating_log_id_fkey"
            columns: ["eating_log_id"]
            isOneToOne: false
            referencedRelation: "eating_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eating_log_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      eating_logs: {
        Row: {
          cat_id: string
          created_at: string
          feeding_method: Database["public"]["Enums"]["feeding_method"]
          id: string
          meal_time: string
          notes: string | null
          submitted_by: string | null
        }
        Insert: {
          cat_id: string
          created_at?: string
          feeding_method?: Database["public"]["Enums"]["feeding_method"]
          id?: string
          meal_time?: string
          notes?: string | null
          submitted_by?: string | null
        }
        Update: {
          cat_id?: string
          created_at?: string
          feeding_method?: Database["public"]["Enums"]["feeding_method"]
          id?: string
          meal_time?: string
          notes?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eating_logs_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eating_logs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "eating_logs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          brand: string | null
          calories_per_gram: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["food_type"]
          unit: Database["public"]["Enums"]["food_unit"]
          updated_at: string
        }
        Insert: {
          brand?: string | null
          calories_per_gram: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          type?: Database["public"]["Enums"]["food_type"]
          unit?: Database["public"]["Enums"]["food_unit"]
          updated_at?: string
        }
        Update: {
          brand?: string | null
          calories_per_gram?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["food_type"]
          unit?: Database["public"]["Enums"]["food_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "food_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_ticket_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id: string
          linked_vet_visit_id: string | null
          new_status: Database["public"]["Enums"]["ticket_status"] | null
          note: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id?: string
          linked_vet_visit_id?: string | null
          new_status?: Database["public"]["Enums"]["ticket_status"] | null
          note?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["ticket_event_type"]
          id?: string
          linked_vet_visit_id?: string | null
          new_status?: Database["public"]["Enums"]["ticket_status"] | null
          note?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_ticket_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "health_ticket_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_ticket_events_linked_vet_visit_fkey"
            columns: ["linked_vet_visit_id"]
            isOneToOne: false
            referencedRelation: "vet_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "health_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_ticket_photos: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          storage_path: string
          ticket_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          storage_path: string
          ticket_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          storage_path?: string
          ticket_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_ticket_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "health_ticket_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_ticket_photos_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "health_ticket_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_ticket_photos_ticket_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "health_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_tickets: {
        Row: {
          cat_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          resolution_summary: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["ticket_severity"]
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          cat_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"]
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cat_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"]
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_tickets_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "health_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "health_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      heat_logs: {
        Row: {
          cat_id: string
          created_at: string
          id: string
          intensity: Database["public"]["Enums"]["heat_intensity"]
          logged_by: string | null
          notes: string | null
          observed_date: string
        }
        Insert: {
          cat_id: string
          created_at?: string
          id?: string
          intensity: Database["public"]["Enums"]["heat_intensity"]
          logged_by?: string | null
          notes?: string | null
          observed_date: string
        }
        Update: {
          cat_id?: string
          created_at?: string
          id?: string
          intensity?: Database["public"]["Enums"]["heat_intensity"]
          logged_by?: string | null
          notes?: string | null
          observed_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "heat_logs_cat_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "heat_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          file_name: string
          file_size_bytes: number | null
          file_type: Database["public"]["Enums"]["lab_result_file_type"]
          file_url: string
          id: string
          notes: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          vet_visit_id: string
        }
        Insert: {
          file_name: string
          file_size_bytes?: number | null
          file_type: Database["public"]["Enums"]["lab_result_file_type"]
          file_url: string
          id?: string
          notes?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          vet_visit_id: string
        }
        Update: {
          file_name?: string
          file_size_bytes?: number | null
          file_type?: Database["public"]["Enums"]["lab_result_file_type"]
          file_url?: string
          id?: string
          notes?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          vet_visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "lab_results_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_visit_fkey"
            columns: ["vet_visit_id"]
            isOneToOne: false
            referencedRelation: "vet_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      litters: {
        Row: {
          birth_date: string
          created_at: string
          created_by: string | null
          id: string
          litter_size_born: number
          litter_size_survived: number | null
          mating_record_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          litter_size_born: number
          litter_size_survived?: number | null
          mating_record_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          litter_size_born?: number
          litter_size_survived?: number | null
          mating_record_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "litters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "litters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_mating_record_fkey"
            columns: ["mating_record_id"]
            isOneToOne: false
            referencedRelation: "mating_records"
            referencedColumns: ["id"]
          },
        ]
      }
      mating_records: {
        Row: {
          created_at: string
          created_by: string | null
          expected_labor_date: string | null
          female_cat_id: string
          id: string
          male_cat_id: string
          mating_date: string
          mating_method: Database["public"]["Enums"]["mating_method"]
          notes: string | null
          status: Database["public"]["Enums"]["mating_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_labor_date?: string | null
          female_cat_id: string
          id?: string
          male_cat_id: string
          mating_date: string
          mating_method?: Database["public"]["Enums"]["mating_method"]
          notes?: string | null
          status?: Database["public"]["Enums"]["mating_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_labor_date?: string | null
          female_cat_id?: string
          id?: string
          male_cat_id?: string
          mating_date?: string
          mating_method?: Database["public"]["Enums"]["mating_method"]
          notes?: string | null
          status?: Database["public"]["Enums"]["mating_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "mating_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mating_records_female_cat_fkey"
            columns: ["female_cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mating_records_male_cat_fkey"
            columns: ["male_cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_tasks: {
        Row: {
          cat_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_at: string
          id: string
          medication_id: string
          skip_reason: string | null
          skipped: boolean
        }
        Insert: {
          cat_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_at: string
          id?: string
          medication_id: string
          skip_reason?: string | null
          skipped?: boolean
        }
        Update: {
          cat_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_at?: string
          id?: string
          medication_id?: string
          skip_reason?: string | null
          skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "medication_tasks_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_tasks_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "medication_tasks_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_tasks_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          cat_id: string
          created_at: string
          created_by: string | null
          dose: string
          end_date: string
          id: string
          interval_days: number
          is_active: boolean
          medicine_name: string
          notes: string | null
          route: Database["public"]["Enums"]["med_route"]
          start_date: string
          time_slots: string[]
          updated_at: string
        }
        Insert: {
          cat_id: string
          created_at?: string
          created_by?: string | null
          dose: string
          end_date: string
          id?: string
          interval_days?: number
          is_active?: boolean
          medicine_name: string
          notes?: string | null
          route?: Database["public"]["Enums"]["med_route"]
          start_date: string
          time_slots: string[]
          updated_at?: string
        }
        Update: {
          cat_id?: string
          created_at?: string
          created_by?: string | null
          dose?: string
          end_date?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          medicine_name?: string
          notes?: string | null
          route?: Database["public"]["Enums"]["med_route"]
          start_date?: string
          time_slots?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "medications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_treatments: {
        Row: {
          administered_date: string
          cat_id: string
          created_at: string
          id: string
          next_due_date: string | null
          notes: string | null
          product_name: string
          recorded_by: string | null
          treatment_type: Database["public"]["Enums"]["preventive_treatment_type"]
          updated_at: string
        }
        Insert: {
          administered_date: string
          cat_id: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          product_name: string
          recorded_by?: string | null
          treatment_type: Database["public"]["Enums"]["preventive_treatment_type"]
          updated_at?: string
        }
        Update: {
          administered_date?: string
          cat_id?: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          product_name?: string
          recorded_by?: string | null
          treatment_type?: Database["public"]["Enums"]["preventive_treatment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_treatments_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_treatments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "preventive_treatments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          preferred_language: Database["public"]["Enums"]["lang_code"]
          role: Database["public"]["Enums"]["user_role"]
          theme_preference: Database["public"]["Enums"]["theme_pref"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          preferred_language?: Database["public"]["Enums"]["lang_code"]
          role?: Database["public"]["Enums"]["user_role"]
          theme_preference?: Database["public"]["Enums"]["theme_pref"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          preferred_language?: Database["public"]["Enums"]["lang_code"]
          role?: Database["public"]["Enums"]["user_role"]
          theme_preference?: Database["public"]["Enums"]["theme_pref"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      room_movements: {
        Row: {
          cat_id: string
          from_room_id: string | null
          id: string
          moved_at: string
          moved_by: string | null
          reason: string | null
          to_room_id: string | null
        }
        Insert: {
          cat_id: string
          from_room_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          reason?: string | null
          to_room_id?: string | null
        }
        Update: {
          cat_id?: string
          from_room_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          reason?: string | null
          to_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_movements_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_movements_from_room_id_fkey"
            columns: ["from_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_movements_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "room_movements_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_movements_to_room_id_fkey"
            columns: ["to_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["room_type"]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["room_type"]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["room_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          cattery_logo_url: string | null
          cattery_name: string
          default_currency: string
          gestation_days: number
          id: number
          preventive_lead_days: number
          push_notifications_enabled: boolean
          updated_at: string
          updated_by: string | null
          vaccination_lead_days: number
          vet_followup_lead_days: number
          weight_drop_alert_pct: number
        }
        Insert: {
          cattery_logo_url?: string | null
          cattery_name?: string
          default_currency?: string
          gestation_days?: number
          id?: number
          preventive_lead_days?: number
          push_notifications_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          vaccination_lead_days?: number
          vet_followup_lead_days?: number
          weight_drop_alert_pct?: number
        }
        Update: {
          cattery_logo_url?: string | null
          cattery_name?: string
          default_currency?: string
          gestation_days?: number
          id?: number
          preventive_lead_days?: number
          push_notifications_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          vaccination_lead_days?: number
          vet_followup_lead_days?: number
          weight_drop_alert_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_by_vet: string | null
          administered_date: string
          batch_number: string | null
          cat_id: string
          created_at: string
          id: string
          next_due_date: string | null
          notes: string | null
          recorded_by: string | null
          updated_at: string
          vaccine_name: string | null
          vaccine_type: Database["public"]["Enums"]["vaccine_type"]
        }
        Insert: {
          administered_by_vet?: string | null
          administered_date: string
          batch_number?: string | null
          cat_id: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recorded_by?: string | null
          updated_at?: string
          vaccine_name?: string | null
          vaccine_type: Database["public"]["Enums"]["vaccine_type"]
        }
        Update: {
          administered_by_vet?: string | null
          administered_date?: string
          batch_number?: string | null
          cat_id?: string
          created_at?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recorded_by?: string | null
          updated_at?: string
          vaccine_name?: string | null
          vaccine_type?: Database["public"]["Enums"]["vaccine_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "vaccinations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_visit_medicines: {
        Row: {
          created_at: string
          dose: string | null
          duration: string | null
          frequency: string | null
          id: string
          medicine_name: string
          notes: string | null
          vet_visit_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          medicine_name: string
          notes?: string | null
          vet_visit_id: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          medicine_name?: string
          notes?: string | null
          vet_visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_visit_medicines_visit_fkey"
            columns: ["vet_visit_id"]
            isOneToOne: false
            referencedRelation: "vet_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_visits: {
        Row: {
          cat_id: string
          chief_complaint: string | null
          clinic_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          doctor_id: string | null
          follow_up_date: string | null
          health_ticket_id: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["vet_visit_status"]
          transport_cost: number | null
          treatment_performed: string | null
          updated_at: string
          visit_cost: number | null
          visit_date: string
          visit_type: Database["public"]["Enums"]["vet_visit_type"]
        }
        Insert: {
          cat_id: string
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          health_ticket_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["vet_visit_status"]
          transport_cost?: number | null
          treatment_performed?: string | null
          updated_at?: string
          visit_cost?: number | null
          visit_date: string
          visit_type?: Database["public"]["Enums"]["vet_visit_type"]
        }
        Update: {
          cat_id?: string
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          health_ticket_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["vet_visit_status"]
          transport_cost?: number | null
          treatment_performed?: string | null
          updated_at?: string
          visit_cost?: number | null
          visit_date?: string
          visit_type?: Database["public"]["Enums"]["vet_visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vet_visits_cat_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_clinic_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "vet_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_doctor_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_health_ticket_fkey"
            columns: ["health_ticket_id"]
            isOneToOne: false
            referencedRelation: "health_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          cat_id: string
          created_at: string
          id: string
          notes: string | null
          photo_url: string | null
          recorded_at: string
          submitted_by: string | null
          weight_kg: number
        }
        Insert: {
          cat_id: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          recorded_at?: string
          submitted_by?: string | null
          weight_kg: number
        }
        Update: {
          cat_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          recorded_at?: string
          submitted_by?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_logs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "assignee_cat_counts"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "weight_logs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assignee_cat_counts: {
        Row: {
          assignee_id: string | null
          cat_count: number | null
        }
        Relationships: []
      }
      cat_latest_weight: {
        Row: {
          cat_id: string | null
          recorded_at: string | null
          weight_kg: number | null
          weight_log_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      move_cat: {
        Args: { p_cat_id: string; p_reason?: string; p_to_room_id: string }
        Returns: {
          assignee_id: string | null
          breed: string | null
          color_pattern: string | null
          created_at: string
          created_by: string | null
          current_room_id: string | null
          date_of_birth: string
          gender: Database["public"]["Enums"]["cat_gender"]
          id: string
          life_stage_multiplier: number
          microchip_number: string | null
          name: string
          notes: string | null
          pedigree_photo_url: string | null
          profile_photo_url: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["cat_status"]
          status_changed_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recommended_daily_kcal: { Args: { p_cat_id: string }; Returns: number }
    }
    Enums: {
      cat_gender: "male" | "female"
      cat_status: "active" | "retired" | "deceased" | "sold"
      doctor_specialisation:
        | "general"
        | "dermatology"
        | "cardiology"
        | "oncology"
        | "dentistry"
        | "surgery"
        | "other"
      eaten_ratio: "all" | "most" | "half" | "little" | "none"
      feeding_method: "self" | "assisted" | "force_fed"
      food_type: "wet" | "dry" | "raw" | "treat" | "supplement" | "other"
      food_unit: "g" | "ml" | "sachet" | "piece"
      heat_intensity: "mild" | "moderate" | "strong"
      lab_result_file_type: "pdf" | "image"
      lang_code: "en" | "id"
      mating_method: "natural" | "ai"
      mating_status:
        | "planned"
        | "confirmed"
        | "pregnant"
        | "delivered"
        | "failed"
      med_route: "oral" | "topical" | "injection" | "other"
      preventive_treatment_type: "deworming" | "flea" | "combined"
      room_type:
        | "breeding"
        | "kitten"
        | "quarantine"
        | "general"
        | "isolation"
        | "other"
      theme_pref: "light" | "dark" | "system"
      ticket_event_type:
        | "comment"
        | "status_change"
        | "resolved"
        | "reopened"
        | "vet_referral"
      ticket_severity: "low" | "medium" | "high" | "critical"
      ticket_status: "open" | "in_progress" | "resolved"
      user_role: "admin" | "cat_sitter"
      vaccine_type: "f3" | "f4" | "tricat" | "felv" | "rabies" | "other"
      vet_visit_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      vet_visit_type:
        | "routine_checkup"
        | "emergency"
        | "follow_up"
        | "vaccination"
        | "surgery"
        | "dental"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cat_gender: ["male", "female"],
      cat_status: ["active", "retired", "deceased", "sold"],
      doctor_specialisation: [
        "general",
        "dermatology",
        "cardiology",
        "oncology",
        "dentistry",
        "surgery",
        "other",
      ],
      eaten_ratio: ["all", "most", "half", "little", "none"],
      feeding_method: ["self", "assisted", "force_fed"],
      food_type: ["wet", "dry", "raw", "treat", "supplement", "other"],
      food_unit: ["g", "ml", "sachet", "piece"],
      heat_intensity: ["mild", "moderate", "strong"],
      lab_result_file_type: ["pdf", "image"],
      lang_code: ["en", "id"],
      mating_method: ["natural", "ai"],
      mating_status: [
        "planned",
        "confirmed",
        "pregnant",
        "delivered",
        "failed",
      ],
      med_route: ["oral", "topical", "injection", "other"],
      preventive_treatment_type: ["deworming", "flea", "combined"],
      room_type: [
        "breeding",
        "kitten",
        "quarantine",
        "general",
        "isolation",
        "other",
      ],
      theme_pref: ["light", "dark", "system"],
      ticket_event_type: [
        "comment",
        "status_change",
        "resolved",
        "reopened",
        "vet_referral",
      ],
      ticket_severity: ["low", "medium", "high", "critical"],
      ticket_status: ["open", "in_progress", "resolved"],
      user_role: ["admin", "cat_sitter"],
      vaccine_type: ["f3", "f4", "tricat", "felv", "rabies", "other"],
      vet_visit_status: ["scheduled", "in_progress", "completed", "cancelled"],
      vet_visit_type: [
        "routine_checkup",
        "emergency",
        "follow_up",
        "vaccination",
        "surgery",
        "dental",
        "other",
      ],
    },
  },
} as const
