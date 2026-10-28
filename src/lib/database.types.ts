// Generiert mit dem Supabase-MCP (generate_typescript_types) am 28.10.2026,
// ergänzt um recipes.thumb_url (Migration recipes_thumb_url). Bei Schema-
// änderungen neu generieren und thumb_url-Ergänzung prüfen.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cook_history: {
        Row: {
          cooked_at: string
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          cooked_at?: string
          created_at?: string
          id?: string
          recipe_id: string
          user_id?: string
        }
        Update: {
          cooked_at?: string
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cook_history_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      import_log: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          amount: number | null
          id: string
          is_scalable: boolean
          name: string
          recipe_id: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          is_scalable?: boolean
          name: string
          recipe_id: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          is_scalable?: boolean
          name?: string
          recipe_id?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_collections: {
        Row: {
          collection_id: string
          recipe_id: string
        }
        Insert: {
          collection_id: string
          recipe_id: string
        }
        Update: {
          collection_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_collections_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_collections_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipes: {
        Row: {
          base_servings: number
          category: string | null
          cook_time_min: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          is_favorite: boolean
          keywords: string[]
          last_cooked_at: string | null
          notes: string | null
          prep_time_min: number | null
          rating: number | null
          source_type: string
          source_url: string | null
          status: string
          steps: Json
          thumb_url: string | null
          title: string
          user_id: string
          video_embed_url: string | null
        }
        Insert: {
          base_servings?: number
          category?: string | null
          cook_time_min?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          keywords?: string[]
          last_cooked_at?: string | null
          notes?: string | null
          prep_time_min?: number | null
          rating?: number | null
          source_type?: string
          source_url?: string | null
          status?: string
          steps?: Json
          thumb_url?: string | null
          title: string
          user_id?: string
          video_embed_url?: string | null
        }
        Update: {
          base_servings?: number
          category?: string | null
          cook_time_min?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          keywords?: string[]
          last_cooked_at?: string | null
          notes?: string | null
          prep_time_min?: number | null
          rating?: number | null
          source_type?: string
          source_url?: string | null
          status?: string
          steps?: Json
          thumb_url?: string | null
          title?: string
          user_id?: string
          video_embed_url?: string | null
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          amount: number | null
          checked: boolean
          created_at: string
          id: string
          ingredient_name: string
          source_recipe_id: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          checked?: boolean
          created_at?: string
          id?: string
          ingredient_name: string
          source_recipe_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Update: {
          amount?: number | null
          checked?: boolean
          created_at?: string
          id?: string
          ingredient_name?: string
          source_recipe_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shopping_list_source_recipe_id_fkey'
            columns: ['source_recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never
