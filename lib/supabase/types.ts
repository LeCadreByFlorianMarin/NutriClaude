export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      aisles: {
        Row: {
          created_at: string
          household_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "aisles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_list_items: {
        Row: {
          actor_id: string | null
          actor_kind: string | null
          added_by: string | null
          aisle_id: string | null
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          intent_at: string
          name: string
          product_id: string | null
          quantity: number | null
          recipe_id: string | null
          source_ref: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string | null
          added_by?: string | null
          aisle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          intent_at?: string
          name: string
          product_id?: string | null
          quantity?: number | null
          recipe_id?: string | null
          source_ref?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string | null
          added_by?: string | null
          aisle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          intent_at?: string
          name?: string
          product_id?: string | null
          quantity?: number | null
          recipe_id?: string | null
          source_ref?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          household_id: string
          uses_remaining: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id: string
          uses_remaining?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id?: string
          uses_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          default_servings: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_servings?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_servings?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      meal_plan_entries: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          meal_date: string
          meal_type: string
          notes: string | null
          recipe_id: string
          servings: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          meal_date: string
          meal_type: string
          notes?: string | null
          recipe_id: string
          servings?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          meal_date?: string
          meal_type?: string
          notes?: string | null
          recipe_id?: string
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aisle_map: {
        Row: {
          aisle_id: string
          created_at: string
          household_id: string
          id: string
          keyword: string | null
          product_id: string | null
        }
        Insert: {
          aisle_id: string
          created_at?: string
          household_id: string
          id?: string
          keyword?: string | null
          product_id?: string | null
        }
        Update: {
          aisle_id?: string
          created_at?: string
          household_id?: string
          id?: string
          keyword?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_aisle_map_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aisle_map_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aisle_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_100g: number | null
          categories: string[] | null
          created_at: string
          energy_kcal_100g: number | null
          fat_100g: number | null
          fiber_100g: number | null
          id: string
          image_url: string | null
          last_synced_at: string | null
          name: string
          nutriscore: string | null
          off_data: Json | null
          protein_100g: number | null
          salt_100g: number | null
          saturated_fat_100g: number | null
          sugar_100g: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_100g?: number | null
          categories?: string[] | null
          created_at?: string
          energy_kcal_100g?: number | null
          fat_100g?: number | null
          fiber_100g?: number | null
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          name: string
          nutriscore?: string | null
          off_data?: Json | null
          protein_100g?: number | null
          salt_100g?: number | null
          saturated_fat_100g?: number | null
          sugar_100g?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_100g?: number | null
          categories?: string[] | null
          created_at?: string
          energy_kcal_100g?: number | null
          fat_100g?: number | null
          fiber_100g?: number | null
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          name?: string
          nutriscore?: string | null
          off_data?: Json | null
          protein_100g?: number | null
          salt_100g?: number | null
          saturated_fat_100g?: number | null
          sugar_100g?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_calories: number | null
          daily_carbs_g: number | null
          daily_fat_g: number | null
          daily_fiber_g: number | null
          daily_protein_g: number | null
          display_name: string
          household_id: string
          id: string
          preferences: Json | null
          restrictions: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_calories?: number | null
          daily_carbs_g?: number | null
          daily_fat_g?: number | null
          daily_fiber_g?: number | null
          daily_protein_g?: number | null
          display_name: string
          household_id: string
          id: string
          preferences?: Json | null
          restrictions?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_calories?: number | null
          daily_carbs_g?: number | null
          daily_fat_g?: number | null
          daily_fiber_g?: number | null
          daily_protein_g?: number | null
          display_name?: string
          household_id?: string
          id?: string
          preferences?: Json | null
          restrictions?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          aisle_keyword: string | null
          created_at: string
          id: string
          name: string
          optional: boolean
          product_id: string | null
          quantity: number | null
          recipe_id: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          aisle_keyword?: string | null
          created_at?: string
          id?: string
          name: string
          optional?: boolean
          product_id?: string | null
          quantity?: number | null
          recipe_id: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          aisle_keyword?: string | null
          created_at?: string
          id?: string
          name?: string
          optional?: boolean
          product_id?: string | null
          quantity?: number | null
          recipe_id?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_time_min: number | null
          created_at: string
          created_by: string | null
          description: string | null
          household_id: string
          id: string
          instructions: string | null
          prep_time_min: number | null
          servings: number
          source: string
          tags: string[] | null
          title: string
          total_carbs_g: number | null
          total_fat_g: number | null
          total_kcal: number | null
          total_protein_g: number | null
          updated_at: string
        }
        Insert: {
          cook_time_min?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id: string
          id?: string
          instructions?: string | null
          prep_time_min?: number | null
          servings?: number
          source?: string
          tags?: string[] | null
          title: string
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_kcal?: number | null
          total_protein_g?: number | null
          updated_at?: string
        }
        Update: {
          cook_time_min?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id?: string
          id?: string
          instructions?: string | null
          prep_time_min?: number | null
          servings?: number
          source?: string
          tags?: string[] | null
          title?: string
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_kcal?: number | null
          total_protein_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      grocery_list_by_aisle: {
        Row: {
          actor_id: string | null
          actor_kind: string | null
          added_by: string | null
          aisle_icon: string | null
          aisle_id: string | null
          aisle_name: string | null
          aisle_sort: number | null
          created_at: string | null
          deleted_at: string | null
          household_id: string | null
          id: string | null
          intent_at: string | null
          name: string | null
          product_id: string | null
          quantity: number | null
          recipe_id: string | null
          source_ref: string | null
          status: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites_valides: {
        Row: {
          code: string | null
          created_at: string | null
          expires_at: string | null
          household_id: string | null
          uses_remaining: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          household_id?: string | null
          uses_remaining?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          household_id?: string | null
          uses_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_household_with_profile: {
        Args: { p_display_name: string; p_household_name: string }
        Returns: string
      }
      current_household_id: { Args: never; Returns: string }
      generate_grocery_list_from_menu: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: number
      }
      generate_household_invite: { Args: never; Returns: string }
      redeem_household_invite: {
        Args: { p_code: string; p_display_name: string }
        Returns: string
      }
      reorder_aisles: { Args: { p_ids: string[] }; Returns: undefined }
      reorder_recipe_ingredients: {
        Args: { p_ids: string[]; p_recipe_id: string }
        Returns: undefined
      }
      resolve_aisle_id: {
        Args: {
          p_fallback_kw: string
          p_household_id: string
          p_ingredient: string
          p_product_id: string
        }
        Returns: string
      }
      seed_default_aisles: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      strip_accents: { Args: { p_texte: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

