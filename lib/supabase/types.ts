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
      eaten_ratio: "all" | "most" | "half" | "little" | "none"
      feeding_method: "self" | "assisted" | "force_fed"
      food_type: "wet" | "dry" | "raw" | "treat" | "supplement" | "other"
      food_unit: "g" | "ml" | "sachet" | "piece"
      lang_code: "en" | "id"
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
      user_role: "admin" | "cat_sitter"
      vaccine_type: "f3" | "f4" | "tricat" | "felv" | "rabies" | "other"
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
      eaten_ratio: ["all", "most", "half", "little", "none"],
      feeding_method: ["self", "assisted", "force_fed"],
      food_type: ["wet", "dry", "raw", "treat", "supplement", "other"],
      food_unit: ["g", "ml", "sachet", "piece"],
      lang_code: ["en", "id"],
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
      user_role: ["admin", "cat_sitter"],
      vaccine_type: ["f3", "f4", "tricat", "felv", "rabies", "other"],
    },
  },
} as const

// ---------------------------------------------------------------------------
// App-level aliases. Keep below the generated block so `supabase gen types`
// output can be pasted above without clobbering them.
// ---------------------------------------------------------------------------
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Cat = Database['public']['Tables']['cats']['Row']
export type CatPhoto = Database['public']['Tables']['cat_photos']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomMovement = Database['public']['Tables']['room_movements']['Row']
export type WeightLog = Database['public']['Tables']['weight_logs']['Row']
export type FoodItem = Database['public']['Tables']['food_items']['Row']
export type EatingLog = Database['public']['Tables']['eating_logs']['Row']
export type EatingLogItem = Database['public']['Tables']['eating_log_items']['Row']
export type Vaccination = Database['public']['Tables']['vaccinations']['Row']
export type PreventiveTreatment = Database['public']['Tables']['preventive_treatments']['Row']
export type Medication = Database['public']['Tables']['medications']['Row']
export type MedicationTask = Database['public']['Tables']['medication_tasks']['Row']
export type AdHocMedicine = Database['public']['Tables']['ad_hoc_medicines']['Row']

export type UserRole = Database['public']['Enums']['user_role']
export type ThemePref = Database['public']['Enums']['theme_pref']
export type LangCode = Database['public']['Enums']['lang_code']
export type CatGender = Database['public']['Enums']['cat_gender']
export type CatStatus = Database['public']['Enums']['cat_status']
export type RoomType = Database['public']['Enums']['room_type']
export type FoodType = Database['public']['Enums']['food_type']
export type FoodUnit = Database['public']['Enums']['food_unit']
export type FeedingMethod = Database['public']['Enums']['feeding_method']
export type EatenRatio = Database['public']['Enums']['eaten_ratio']
export type VaccineType = Database['public']['Enums']['vaccine_type']
export type PreventiveType = Database['public']['Enums']['preventive_treatment_type']
export type MedRoute = Database['public']['Enums']['med_route']
