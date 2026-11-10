export type Json = string | number | boolean | null | {[key: string]: Json | undefined} | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {Args: {extensions?: Json; operationName?: string; query?: string; variables?: Json}; Returns: Json}
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          last_sign_in_at: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          last_sign_in_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          last_sign_in_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_emails: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          label: string | null
        }
        ComputedFields: never
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          label?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'client_emails_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
      client_hidden_resources: {
        Row: {
          client_id: string
          resource_id: string
        }
        ComputedFields: never
        Insert: {
          client_id: string
          resource_id: string
        }
        Update: {
          client_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_hidden_resources_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_hidden_resources_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          added_on: string
          category: string
          client_id: string | null
          cover_image: string | null
          cover_image_alt: string | null
          cover_image_hotspot: Json | null
          cover_image_lqip: string | null
          created_at: string
          file: string | null
          id: string
          pdf_preview: string | null
          pdf_preview_lqip: string | null
          sort_order: number
          title: string
          type: Database['public']['Enums']['resource_type']
          updated_at: string
          url: string | null
        }
        ComputedFields: never
        Insert: {
          added_on?: string
          category: string
          client_id?: string | null
          cover_image?: string | null
          cover_image_alt?: string | null
          cover_image_hotspot?: Json | null
          cover_image_lqip?: string | null
          created_at?: string
          file?: string | null
          id?: string
          pdf_preview?: string | null
          pdf_preview_lqip?: string | null
          sort_order?: number
          title: string
          type: Database['public']['Enums']['resource_type']
          updated_at?: string
          url?: string | null
        }
        Update: {
          added_on?: string
          category?: string
          client_id?: string | null
          cover_image?: string | null
          cover_image_alt?: string | null
          cover_image_hotspot?: Json | null
          cover_image_lqip?: string | null
          created_at?: string
          file?: string | null
          id?: string
          pdf_preview?: string | null
          pdf_preview_lqip?: string | null
          sort_order?: number
          title?: string
          type?: Database['public']['Enums']['resource_type']
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'resources_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_client: {Args: {target: string}; Returns: boolean}
      can_view_main_resource: {Args: {target: string}; Returns: boolean}
      claim_admin_profile: {Args: Record<PropertyKey, never>; Returns: boolean}
      claim_link_send: {Args: {p_email: string}; Returns: boolean}
      email_can_access_slug: {Args: {p_email: string; p_slug: string}; Returns: boolean}
      get_client_page: {Args: {p_slug: string}; Returns: Json}
      hit_rate_limit: {Args: {p_key: string; p_limit: number; p_window: string}; Returns: boolean}
      hook_before_user_created: {Args: {event: Json}; Returns: Json}
      is_admin: {Args: Record<PropertyKey, never>; Returns: boolean}
      jwt_email: {Args: Record<PropertyKey, never>; Returns: string}
      reorder_main_resources: {Args: {ids: string[]}; Returns: undefined}
      save_client: {Args: {payload: Json}; Returns: string}
      take_storage_garbage: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket: string
          path: string
        }[]
      }
    }
    Enums: {
      resource_type: 'pdf' | 'video' | 'link' | 'slides'
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
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {schema: keyof DatabaseWithoutInternals}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {schema: keyof DatabaseWithoutInternals}
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {schema: keyof DatabaseWithoutInternals}
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | {schema: keyof DatabaseWithoutInternals},
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {schema: keyof DatabaseWithoutInternals}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | {schema: keyof DatabaseWithoutInternals},
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {schema: keyof DatabaseWithoutInternals}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      resource_type: ['pdf', 'video', 'link', 'slides'],
    },
  },
} as const
