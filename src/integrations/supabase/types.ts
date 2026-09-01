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
      care_events: {
        Row: {
          confirmed_safe: boolean | null
          conversation_id: string | null
          created_at: string
          event_name: string
          follow_up_status: string | null
          human_support_requested: boolean
          id: string
          risk_band: string | null
          support_level: number | null
          user_id: string
        }
        Insert: {
          confirmed_safe?: boolean | null
          conversation_id?: string | null
          created_at?: string
          event_name: string
          follow_up_status?: string | null
          human_support_requested?: boolean
          id?: string
          risk_band?: string | null
          support_level?: number | null
          user_id: string
        }
        Update: {
          confirmed_safe?: boolean | null
          conversation_id?: string | null
          created_at?: string
          event_name?: string
          follow_up_status?: string | null
          human_support_requested?: boolean
          id?: string
          risk_band?: string | null
          support_level?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_follow_ups: {
        Row: {
          choice_label: string
          conversation_id: string | null
          created_at: string
          due_at: string
          id: string
          outcome: string | null
          responded_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          choice_label: string
          conversation_id?: string | null
          created_at?: string
          due_at: string
          id?: string
          outcome?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          choice_label?: string
          conversation_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          outcome?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_follow_ups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_safety_plans: {
        Row: {
          calming_activities: string | null
          created_at: string
          follow_up_preference: string | null
          people_to_contact: string | null
          professional_resources: string | null
          reason_to_pause: string | null
          safer_places: string | null
          updated_at: string
          user_id: string
          warning_signs: string | null
        }
        Insert: {
          calming_activities?: string | null
          created_at?: string
          follow_up_preference?: string | null
          people_to_contact?: string | null
          professional_resources?: string | null
          reason_to_pause?: string | null
          safer_places?: string | null
          updated_at?: string
          user_id: string
          warning_signs?: string | null
        }
        Update: {
          calming_activities?: string | null
          created_at?: string
          follow_up_preference?: string | null
          people_to_contact?: string | null
          professional_resources?: string | null
          reason_to_pause?: string | null
          safer_places?: string | null
          updated_at?: string
          user_id?: string
          warning_signs?: string | null
        }
        Relationships: []
      }
      care_trusted_contacts: {
        Row: {
          consent_urgent: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          preferred_method: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_urgent?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          preferred_method?: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_urgent?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_method?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connect_requests: {
        Row: {
          admin_id: string
          created_at: string
          flagged_at: string | null
          flagged_message_excerpt: string | null
          flagged_message_id: string | null
          id: string
          responded_at: string | null
          risk_level: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          flagged_at?: string | null
          flagged_message_excerpt?: string | null
          flagged_message_id?: string | null
          id?: string
          responded_at?: string | null
          risk_level?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          flagged_at?: string | null
          flagged_message_excerpt?: string | null
          flagged_message_id?: string | null
          id?: string
          responded_at?: string | null
          risk_level?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_decisions: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          new_status: string
          prior_status: string
          reason: string | null
          recommendation_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          prior_status: string
          reason?: string | null
          recommendation_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          prior_status?: string
          reason?: string | null
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_decisions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "evolution_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_health_snapshots: {
        Row: {
          created_at: string
          evolution_score: number
          health_score: number
          id: string
          kpis: Json
          notes: string | null
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          evolution_score?: number
          health_score?: number
          id?: string
          kpis?: Json
          notes?: string | null
          snapshot_date: string
        }
        Update: {
          created_at?: string
          evolution_score?: number
          health_score?: number
          id?: string
          kpis?: Json
          notes?: string | null
          snapshot_date?: string
        }
        Relationships: []
      }
      evolution_observations: {
        Row: {
          active_users: number
          ai_reply_count: number
          avg_questions: number
          avg_repetition: number
          bucket_start: string
          created_at: string
          emotion_distribution: Json
          extras: Json
          high_risk_count: number
          id: string
          language_distribution: Json
          message_count: number
          solution_mode_pct: number
        }
        Insert: {
          active_users?: number
          ai_reply_count?: number
          avg_questions?: number
          avg_repetition?: number
          bucket_start: string
          created_at?: string
          emotion_distribution?: Json
          extras?: Json
          high_risk_count?: number
          id?: string
          language_distribution?: Json
          message_count?: number
          solution_mode_pct?: number
        }
        Update: {
          active_users?: number
          ai_reply_count?: number
          avg_questions?: number
          avg_repetition?: number
          bucket_start?: string
          created_at?: string
          emotion_distribution?: Json
          extras?: Json
          high_risk_count?: number
          id?: string
          language_distribution?: Json
          message_count?: number
          solution_mode_pct?: number
        }
        Relationships: []
      }
      evolution_recommendations: {
        Row: {
          area: string
          benefits: string | null
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          dependencies: Json
          description: string
          difficulty: string
          id: string
          implementation_plan: string | null
          metrics_snapshot: Json
          priority: string
          problem: string | null
          proposed_solution: string | null
          risk_level: string
          source: string
          status: string
          time_estimate: string | null
          title: string
          updated_at: string
        }
        Insert: {
          area?: string
          benefits?: string | null
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          dependencies?: Json
          description: string
          difficulty?: string
          id?: string
          implementation_plan?: string | null
          metrics_snapshot?: Json
          priority?: string
          problem?: string | null
          proposed_solution?: string | null
          risk_level?: string
          source?: string
          status?: string
          time_estimate?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          benefits?: string | null
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          dependencies?: Json
          description?: string
          difficulty?: string
          id?: string
          implementation_plan?: string | null
          metrics_snapshot?: Json
          priority?: string
          problem?: string | null
          proposed_solution?: string | null
          risk_level?: string
          source?: string
          status?: string
          time_estimate?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          emotion: string | null
          follow_up_sent_at: string | null
          id: string
          message_length: number | null
          resolved_at: string | null
          resolved_by: string | null
          response_delay_seconds: number | null
          risk_level: string | null
          role: string
          sentiment: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          follow_up_sent_at?: string | null
          id?: string
          message_length?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_delay_seconds?: number | null
          risk_level?: string | null
          role: string
          sentiment?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          follow_up_sent_at?: string | null
          id?: string
          message_length?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_delay_seconds?: number | null
          risk_level?: string | null
          role?: string
          sentiment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_logs: {
        Row: {
          created_at: string
          emotion: string
          id: string
          risk_level: string
          sentiment: string
          sentiment_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emotion: string
          id?: string
          risk_level: string
          sentiment: string
          sentiment_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          emotion?: string
          id?: string
          risk_level?: string
          sentiment?: string
          sentiment_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      panic_events: {
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
      profiles: {
        Row: {
          age: number | null
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          profession: string | null
          profile_completed_at: string | null
          trusted_contact_email: string | null
          trusted_contact_name: string | null
          trusted_contact_phone: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id: string
          profession?: string | null
          profile_completed_at?: string | null
          trusted_contact_email?: string | null
          trusted_contact_name?: string | null
          trusted_contact_phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          profession?: string | null
          profile_completed_at?: string | null
          trusted_contact_email?: string | null
          trusted_contact_name?: string | null
          trusted_contact_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      psych_assessments: {
        Row: {
          context_summary: string | null
          conversation_id: string | null
          created_at: string
          emotion: string | null
          escalation_triggered: boolean
          id: string
          intensity: number | null
          matched_case_codes: string[]
          message_id: string | null
          next_probe: string | null
          patterns: string[]
          severity_level: number
          signal_state: Json | null
          strategy: string | null
          uncertainty: number | null
          user_id: string
        }
        Insert: {
          context_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          escalation_triggered?: boolean
          id?: string
          intensity?: number | null
          matched_case_codes?: string[]
          message_id?: string | null
          next_probe?: string | null
          patterns?: string[]
          severity_level?: number
          signal_state?: Json | null
          strategy?: string | null
          uncertainty?: number | null
          user_id: string
        }
        Update: {
          context_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          escalation_triggered?: boolean
          id?: string
          intensity?: number | null
          matched_case_codes?: string[]
          message_id?: string | null
          next_probe?: string | null
          patterns?: string[]
          severity_level?: number
          signal_state?: Json | null
          strategy?: string | null
          uncertainty?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psych_assessments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      psych_cases: {
        Row: {
          avoid_saying: string[]
          case_code: string
          category: string
          confidence: number
          context_notes: string | null
          created_at: string
          created_by: string | null
          detected_signals: string[]
          enabled: boolean
          escalation_criteria: string | null
          example_statements: string[]
          follow_up_questions: string[]
          id: string
          next_steps: string[]
          possible_patterns: string[]
          response_strategy: string
          reviewed: boolean
          search_text: string | null
          severity_level: number
          source: string | null
          source_license: string | null
          subcategory: string | null
          updated_at: string
          user_situation: string
          version: number
        }
        Insert: {
          avoid_saying?: string[]
          case_code: string
          category: string
          confidence?: number
          context_notes?: string | null
          created_at?: string
          created_by?: string | null
          detected_signals?: string[]
          enabled?: boolean
          escalation_criteria?: string | null
          example_statements?: string[]
          follow_up_questions?: string[]
          id?: string
          next_steps?: string[]
          possible_patterns?: string[]
          response_strategy: string
          reviewed?: boolean
          search_text?: string | null
          severity_level?: number
          source?: string | null
          source_license?: string | null
          subcategory?: string | null
          updated_at?: string
          user_situation: string
          version?: number
        }
        Update: {
          avoid_saying?: string[]
          case_code?: string
          category?: string
          confidence?: number
          context_notes?: string | null
          created_at?: string
          created_by?: string | null
          detected_signals?: string[]
          enabled?: boolean
          escalation_criteria?: string | null
          example_statements?: string[]
          follow_up_questions?: string[]
          id?: string
          next_steps?: string[]
          possible_patterns?: string[]
          response_strategy?: string
          reviewed?: boolean
          search_text?: string | null
          severity_level?: number
          source?: string | null
          source_license?: string | null
          subcategory?: string | null
          updated_at?: string
          user_situation?: string
          version?: number
        }
        Relationships: []
      }
      psych_simulations: {
        Row: {
          admin_id: string
          category: string
          created_at: string
          emotional_intensity: number
          id: string
          notes: string | null
          overall_score: number | null
          persona: string | null
          scenario: string | null
          scores: Json
          severity_level: number
          transcript: Json
          turns: number
          verdict: string | null
        }
        Insert: {
          admin_id: string
          category: string
          created_at?: string
          emotional_intensity?: number
          id?: string
          notes?: string | null
          overall_score?: number | null
          persona?: string | null
          scenario?: string | null
          scores?: Json
          severity_level?: number
          transcript?: Json
          turns?: number
          verdict?: string | null
        }
        Update: {
          admin_id?: string
          category?: string
          created_at?: string
          emotional_intensity?: number
          id?: string
          notes?: string | null
          overall_score?: number | null
          persona?: string | null
          scenario?: string | null
          scores?: Json
          severity_level?: number
          transcript?: Json
          turns?: number
          verdict?: string | null
        }
        Relationships: []
      }
      reply_analytics: {
        Row: {
          conversation_id: string | null
          created_at: string
          emotion: string | null
          id: string
          language: string | null
          message_id: string | null
          question_count: number
          repetition_score: number
          reply_length: number | null
          solution_mode: boolean
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          question_count?: number
          repetition_score?: number
          reply_length?: number | null
          solution_mode?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          question_count?: number
          repetition_score?: number
          reply_length?: number | null
          solution_mode?: boolean
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          request_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          request_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "connect_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_learning_profile: {
        Row: {
          active_hours: Json | null
          avg_user_msg_length: number | null
          emotion_history: Json | null
          engagement_pattern: Json | null
          interaction_count: number | null
          last_style: string | null
          preferred_language: string | null
          preferred_tone: string | null
          prefers_short_replies: boolean | null
          recurring_topics: Json | null
          response_effectiveness: number | null
          successful_styles: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_hours?: Json | null
          avg_user_msg_length?: number | null
          emotion_history?: Json | null
          engagement_pattern?: Json | null
          interaction_count?: number | null
          last_style?: string | null
          preferred_language?: string | null
          preferred_tone?: string | null
          prefers_short_replies?: boolean | null
          recurring_topics?: Json | null
          response_effectiveness?: number | null
          successful_styles?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_hours?: Json | null
          avg_user_msg_length?: number | null
          emotion_history?: Json | null
          engagement_pattern?: Json | null
          interaction_count?: number | null
          last_style?: string | null
          preferred_language?: string | null
          preferred_tone?: string | null
          prefers_short_replies?: boolean | null
          recurring_topics?: Json | null
          response_effectiveness?: number | null
          successful_styles?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_behavior_flags: {
        Args: never
        Returns: {
          detail: string
          display_name: string
          flag: string
          last_active: string
          user_id: string
        }[]
      }
      admin_care_bridge_events: {
        Args: { limit_n?: number }
        Returns: {
          confirmed_safe: boolean
          created_at: string
          event_id: string
          event_name: string
          follow_up_status: string
          human_support_requested: boolean
          masked_user: string
          risk_band: string
          support_level: number
        }[]
      }
      admin_care_bridge_summary: {
        Args: never
        Returns: {
          confirmed_safe_24h: number
          events_24h: number
          false_alarms_24h: number
          follow_ups_pending: number
          safety_checks_24h: number
          urgent_requests_24h: number
        }[]
      }
      admin_demographics: {
        Args: never
        Returns: {
          age: number
          created_at: string
          display_name: string
          gender: string
          profession: string
          profile_completed_at: string
          user_id: string
        }[]
      }
      admin_emotion_distribution: {
        Args: { days?: number }
        Returns: {
          count: number
          emotion: string
        }[]
      }
      admin_emotion_insights: {
        Args: never
        Returns: {
          emotion: string
          last_week: number
          pct_change: number
          this_week: number
        }[]
      }
      admin_high_risk_cases: {
        Args: { limit_n?: number }
        Returns: {
          active_request_id: string
          age: number
          created_at: string
          display_name: string
          emotion: string
          flagged_excerpt: string
          follow_up_sent_at: string
          gender: string
          message_id: string
          pending_request_id: string
          profession: string
          resolved_at: string
          risk_level: string
          sentiment_score: number
          user_id: string
          user_last_message_at: string
          user_message_count_24h: number
        }[]
      }
      admin_high_risk_feed: {
        Args: { limit_n?: number }
        Returns: {
          created_at: string
          display_name: string
          emotion: string
          sentiment_score: number
          user_id: string
        }[]
      }
      admin_mark_case: {
        Args: { _action: string; _message_id: string }
        Returns: undefined
      }
      admin_overview: {
        Args: never
        Returns: {
          active_today: number
          high_risk_today: number
          total_messages: number
          total_panic: number
          total_users: number
        }[]
      }
      admin_request_connect: { Args: { _message_id: string }; Returns: string }
      admin_risk_trend: {
        Args: { days?: number }
        Returns: {
          day: string
          high: number
          low: number
          moderate: number
        }[]
      }
      admin_user_list: {
        Args: never
        Returns: {
          display_name: string
          last_active: string
          message_count: number
          recent_high_risk: number
          user_id: string
        }[]
      }
      admin_user_timeline: {
        Args: { days?: number; target: string }
        Returns: {
          created_at: string
          emotion: string
          risk_level: string
          sentiment_score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_psych_cases: {
        Args: { _limit?: number; _query: string }
        Returns: {
          avoid_saying: string[]
          case_code: string
          category: string
          confidence: number
          detected_signals: string[]
          escalation_criteria: string
          follow_up_questions: string[]
          next_steps: string[]
          possible_patterns: string[]
          rank: number
          response_strategy: string
          severity_level: number
          source: string
          subcategory: string
          user_situation: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
