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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clinician_applications: {
        Row: {
          created_at: string
          full_name: string
          gphc_number: string
          id: string
          ods_code: string | null
          postcode: string
          reviewed_at: string | null
          reviewed_by: string | null
          setting: Database["public"]["Enums"]["clinician_setting"]
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
          workplace: string
        }
        Insert: {
          created_at?: string
          full_name: string
          gphc_number: string
          id?: string
          ods_code?: string | null
          postcode: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          setting: Database["public"]["Enums"]["clinician_setting"]
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
          workplace: string
        }
        Update: {
          created_at?: string
          full_name?: string
          gphc_number?: string
          id?: string
          ods_code?: string | null
          postcode?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          setting?: Database["public"]["Enums"]["clinician_setting"]
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
          workplace?: string
        }
        Relationships: []
      }
      medicine_barcodes: {
        Row: {
          gtin: string
          medicine_id: string
        }
        Insert: {
          gtin: string
          medicine_id: string
        }
        Update: {
          gtin?: string
          medicine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_barcodes_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          bnf_codes: string[]
          created_at: string
          dmd_vmp_id: string | null
          equivalence_group: string
          form: string | null
          id: string
          is_controlled: boolean
          name: string
          strength: string | null
        }
        Insert: {
          bnf_codes?: string[]
          created_at?: string
          dmd_vmp_id?: string | null
          equivalence_group: string
          form?: string | null
          id?: string
          is_controlled?: boolean
          name: string
          strength?: string | null
        }
        Update: {
          bnf_codes?: string[]
          created_at?: string
          dmd_vmp_id?: string | null
          equivalence_group?: string
          form?: string | null
          id?: string
          is_controlled?: boolean
          name?: string
          strength?: string | null
        }
        Relationships: []
      }
      nhs_dispensing: {
        Row: {
          icb_name: string
          items: number
          medicine_id: string
          month: string
        }
        Insert: {
          icb_name: string
          items: number
          medicine_id: string
          month: string
        }
        Update: {
          icb_name?: string
          items?: number
          medicine_id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "nhs_dispensing_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address_line: string
          created_at: string
          id: string
          location: unknown
          name: string
          ods_code: string | null
          opening_hours: Json
          phone: string | null
          postcode: string
          share_with_clinicians: boolean
          town: string
        }
        Insert: {
          address_line: string
          created_at?: string
          id?: string
          location: unknown
          name: string
          ods_code?: string | null
          opening_hours?: Json
          phone?: string | null
          postcode: string
          share_with_clinicians?: boolean
          town: string
        }
        Update: {
          address_line?: string
          created_at?: string
          id?: string
          location?: unknown
          name?: string
          ods_code?: string | null
          opening_hours?: Json
          phone?: string | null
          postcode?: string
          share_with_clinicians?: boolean
          town?: string
        }
        Relationships: []
      }
      pharmacy_staff: {
        Row: {
          created_at: string
          pharmacy_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pharmacy_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          pharmacy_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_staff_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_listing_views: {
        Row: {
          day: string
          medicine_id: string
          pharmacy_id: string
          views: number
        }
        Insert: {
          day?: string
          medicine_id: string
          pharmacy_id: string
          views?: number
        }
        Update: {
          day?: string
          medicine_id?: string
          pharmacy_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_listing_views_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_listing_views_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_listings: {
        Row: {
          created_at: string
          created_by: string | null
          medicine_id: string
          pharmacy_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          medicine_id: string
          pharmacy_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          medicine_id?: string
          pharmacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_listings_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_listings_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          request_id: string
          sender_pharmacy_id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          request_id: string
          sender_pharmacy_id: string
          sender_user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_pharmacy_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_messages_sender_pharmacy_id_fkey"
            columns: ["sender_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_applications: {
        Row: {
          created_at: string
          full_name: string
          gphc_number: string
          id: string
          pharmacy_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          gphc_number: string
          id?: string
          pharmacy_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          gphc_number?: string
          id?: string
          pharmacy_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_applications_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requests: {
        Row: {
          broadcast_id: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          from_pharmacy_id: string
          id: string
          medicine_id: string
          message: string | null
          pack_size: number | null
          quantity: number | null
          reserved_until: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          to_pharmacy_id: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }
        Insert: {
          broadcast_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_pharmacy_id: string
          id?: string
          medicine_id: string
          message?: string | null
          pack_size?: number | null
          quantity?: number | null
          reserved_until?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_pharmacy_id: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Update: {
          broadcast_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_pharmacy_id?: string
          id?: string
          medicine_id?: string
          message?: string | null
          pack_size?: number | null
          quantity?: number | null
          reserved_until?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_pharmacy_id?: string
          urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_from_pharmacy_id_fkey"
            columns: ["from_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_to_pharmacy_id_fkey"
            columns: ["to_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_status: {
        Row: {
          level: Database["public"]["Enums"]["stock_level"]
          medicine_id: string
          pharmacy_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          level: Database["public"]["Enums"]["stock_level"]
          medicine_id: string
          pharmacy_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          level?: Database["public"]["Enums"]["stock_level"]
          medicine_id?: string
          pharmacy_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_status_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_status_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_nhs_pharmacy: {
        Args: {
          p_address_line: string
          p_lat: number
          p_lng: number
          p_name: string
          p_ods_code: string
          p_phone: string
          p_postcode: string
          p_town: string
        }
        Returns: string
      }
      admin_add_pharmacy: {
        Args: {
          p_address_line: string
          p_lat: number
          p_lng: number
          p_name: string
          p_ods_code: string
          p_phone: string
          p_postcode: string
          p_town: string
        }
        Returns: string
      }
      broadcast_stock_request: {
        Args: {
          p_from_pharmacy_id: string
          p_medicine_id: string
          p_pack_size?: number
          p_quantity?: number
          p_radius_m: number
          p_urgency?: Database["public"]["Enums"]["request_urgency"]
        }
        Returns: {
          broadcast_id: string
          recipients: number
        }[]
      }
      can_see_stock: { Args: { p_pharmacy_id: string }; Returns: boolean }
      close_broadcast: { Args: { p_broadcast_id: string }; Returns: number }
      close_stock_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: string
      }
      contains_patient_details: { Args: { p_text: string }; Returns: boolean }
      expire_stale_requests: {
        Args: { p_from_pharmacy_id: string }
        Returns: number
      }
      incoming_requests: {
        Args: { p_pharmacy_id: string }
        Returns: {
          broadcast_id: string
          created_at: string
          distance_m: number
          from_name: string
          from_postcode: string
          id: string
          medicine_form: string
          medicine_name: string
          medicine_strength: string
          pack_size: number
          quantity: number
          reserved_until: string
          state: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }[]
      }
      is_approved_clinician: { Args: never; Returns: boolean }
      is_manager_of: { Args: { p_pharmacy_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_staff_of: { Args: { p_pharmacy_id: string }; Returns: boolean }
      nearby_stock: {
        Args: {
          p_include_equivalents?: boolean
          p_lat: number
          p_lng: number
          p_medicine_id: string
          p_radius_m?: number
        }
        Returns: {
          address_line: string
          distance_m: number
          lat: number
          level: Database["public"]["Enums"]["stock_level"]
          lng: number
          medicine_id: string
          medicine_name: string
          pharmacy_id: string
          pharmacy_name: string
          phone: string
          postcode: string
          town: string
          updated_at: string
          verified: boolean
        }[]
      }
      nhs_dispensing_months: { Args: never; Returns: string[] }
      nhs_dispensing_series: { Args: { p_icb_name: string }; Returns: Json }
      outgoing_requests: {
        Args: { p_pharmacy_id: string }
        Returns: {
          broadcast_id: string
          created_at: string
          distance_m: number
          id: string
          medicine_name: string
          pack_size: number
          quantity: number
          reserved_until: string
          state: string
          to_address: string
          to_name: string
          to_phone: string
          to_postcode: string
          urgency: Database["public"]["Enums"]["request_urgency"]
        }[]
      }
      pharmacy_insights: { Args: { p_pharmacy_id: string }; Returns: Json }
      public_find_stock: {
        Args: {
          p_lat: number
          p_lng: number
          p_medicine_id: string
          p_radius_m?: number
        }
        Returns: {
          address_line: string
          confirmed_at: string
          distance_m: number
          lat: number
          level: Database["public"]["Enums"]["stock_level"]
          lng: number
          medicine_name: string
          pharmacy_id: string
          pharmacy_name: string
          phone: string
          postcode: string
          town: string
        }[]
      }
      public_listing_stats: {
        Args: { p_pharmacy_id: string }
        Returns: {
          medicine_id: string
          medicine_name: string
          views_30d: number
        }[]
      }
      push_targets: {
        Args: { p_exclude_user: string; p_pharmacy_ids: string[] }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
        }[]
      }
      reconfirm_stock: { Args: { p_pharmacy_id: string }; Returns: number }
      refresh_demo_data: { Args: never; Returns: Json }
      request_open_window: { Args: never; Returns: string }
      request_state: {
        Args: { r: Database["public"]["Tables"]["stock_requests"]["Row"] }
        Returns: string
      }
      review_clinician_application: {
        Args: { p_application_id: string; p_approve: boolean }
        Returns: Database["public"]["Enums"]["application_status"]
      }
      review_staff_application: {
        Args: { p_application_id: string; p_approve: boolean }
        Returns: Database["public"]["Enums"]["application_status"]
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      search_medicines: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          bnf_codes: string[]
          created_at: string
          dmd_vmp_id: string | null
          equivalence_group: string
          form: string | null
          id: string
          is_controlled: boolean
          name: string
          strength: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "medicines"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_clinician_sharing: {
        Args: { p_pharmacy_id: string; p_share: boolean }
        Returns: undefined
      }
      stock_verified_window: { Args: never; Returns: string }
    }
    Enums: {
      application_status: "pending" | "approved" | "rejected"
      clinician_setting: "gp_practice" | "other"
      request_status: "pending" | "confirmed" | "declined"
      request_urgency: "urgent" | "routine"
      stock_level: "in_stock" | "low" | "out_of_stock"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      application_status: ["pending", "approved", "rejected"],
      clinician_setting: ["gp_practice", "other"],
      request_status: ["pending", "confirmed", "declined"],
      request_urgency: ["urgent", "routine"],
      stock_level: ["in_stock", "low", "out_of_stock"],
    },
  },
} as const
