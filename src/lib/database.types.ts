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
      stock_requests: {
        Row: {
          broadcast_id: string | null
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
        }
        Insert: {
          broadcast_id?: string | null
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
        }
        Update: {
          broadcast_id?: string | null
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
      broadcast_stock_request: {
        Args: {
          p_from_pharmacy_id: string
          p_medicine_id: string
          p_pack_size?: number
          p_quantity?: number
          p_radius_m: number
        }
        Returns: {
          broadcast_id: string
          recipients: number
        }[]
      }
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
      reconfirm_stock: { Args: { p_pharmacy_id: string }; Returns: number }
      search_medicines: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
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
      stock_verified_window: { Args: never; Returns: string }
    }
    Enums: {
      request_status: "pending" | "confirmed" | "declined"
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
      request_status: ["pending", "confirmed", "declined"],
      stock_level: ["in_stock", "low", "out_of_stock"],
    },
  },
} as const
