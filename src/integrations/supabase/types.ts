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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_analysis_results: {
        Row: {
          analysis_type: string
          article_id: string | null
          created_at: string
          id: string
          project_id: string | null
          result: Json
        }
        Insert: {
          analysis_type: string
          article_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          result: Json
        }
        Update: {
          analysis_type?: string
          article_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_results_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "saved_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_analysis_data: {
        Row: {
          article_id: string | null
          created_at: string
          effect_size: number | null
          effect_size_type: string | null
          events_control: number | null
          events_treatment: number | null
          id: string
          mean_control: number | null
          mean_treatment: number | null
          project_id: string | null
          sample_size_control: number | null
          sample_size_treatment: number | null
          sd_control: number | null
          sd_treatment: number | null
          standard_error: number | null
          study_name: string
          subgroup: string | null
          variance: number | null
          weight: number | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          effect_size?: number | null
          effect_size_type?: string | null
          events_control?: number | null
          events_treatment?: number | null
          id?: string
          mean_control?: number | null
          mean_treatment?: number | null
          project_id?: string | null
          sample_size_control?: number | null
          sample_size_treatment?: number | null
          sd_control?: number | null
          sd_treatment?: number | null
          standard_error?: number | null
          study_name: string
          subgroup?: string | null
          variance?: number | null
          weight?: number | null
        }
        Update: {
          article_id?: string | null
          created_at?: string
          effect_size?: number | null
          effect_size_type?: string | null
          events_control?: number | null
          events_treatment?: number | null
          id?: string
          mean_control?: number | null
          mean_treatment?: number | null
          project_id?: string | null
          sample_size_control?: number | null
          sample_size_treatment?: number | null
          sd_control?: number | null
          sd_treatment?: number | null
          standard_error?: number | null
          study_name?: string
          subgroup?: string | null
          variance?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_analysis_data_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "saved_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_analysis_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          sections: Json
          status: string | null
          template_format: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          sections?: Json
          status?: string | null
          template_format?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          sections?: Json
          status?: string | null
          template_format?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          status: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          status?: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          status?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_articles: {
        Row: {
          abstract: string | null
          authors: Json | null
          citations_count: number | null
          created_at: string
          doi: string | null
          exclusion_reason: string | null
          extracted_data: Json | null
          id: string
          is_included: boolean | null
          journal: string | null
          notes: string | null
          pdf_url: string | null
          project_id: string | null
          publication_date: string | null
          risk_of_bias: Json | null
          screening_status: string | null
          source: string
          source_id: string
          tags: string[] | null
          title: string
          url: string | null
        }
        Insert: {
          abstract?: string | null
          authors?: Json | null
          citations_count?: number | null
          created_at?: string
          doi?: string | null
          exclusion_reason?: string | null
          extracted_data?: Json | null
          id?: string
          is_included?: boolean | null
          journal?: string | null
          notes?: string | null
          pdf_url?: string | null
          project_id?: string | null
          publication_date?: string | null
          risk_of_bias?: Json | null
          screening_status?: string | null
          source: string
          source_id: string
          tags?: string[] | null
          title: string
          url?: string | null
        }
        Update: {
          abstract?: string | null
          authors?: Json | null
          citations_count?: number | null
          created_at?: string
          doi?: string | null
          exclusion_reason?: string | null
          extracted_data?: Json | null
          id?: string
          is_included?: boolean | null
          journal?: string | null
          notes?: string | null
          pdf_url?: string | null
          project_id?: string | null
          publication_date?: string | null
          risk_of_bias?: Json | null
          screening_status?: string | null
          source?: string
          source_id?: string
          tags?: string[] | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_articles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
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
