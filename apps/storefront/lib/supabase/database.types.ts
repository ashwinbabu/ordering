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
    PostgrestVersion: "14.15"
  }
  core: {
    Tables: {
      business_locations: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          business_id: string
          city: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          locality: string | null
          longitude: number
          name: string
          phone: string | null
          postal_code: string | null
          state: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          business_id: string
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          locality?: string | null
          longitude: number
          name: string
          phone?: string | null
          postal_code?: string | null
          state: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          business_id?: string
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          locality?: string | null
          longitude?: number
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          name: string
          slug: string
          status: string
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_business_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          business_id: string
          city: string
          created_at: string
          customer_business_id: string
          customer_id: string
          delivery_instructions: string | null
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          latitude: number
          locality: string
          longitude: number
          postal_code: string | null
          recipient_name: string
          recipient_phone: string
          state: string
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          business_id: string
          city: string
          created_at?: string
          customer_business_id: string
          customer_id: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean
          label: string
          landmark?: string | null
          latitude: number
          locality: string
          longitude: number
          postal_code?: string | null
          recipient_name: string
          recipient_phone: string
          state: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          business_id?: string
          city?: string
          created_at?: string
          customer_business_id?: string
          customer_id?: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          latitude?: number
          locality?: string
          longitude?: number
          postal_code?: string | null
          recipient_name?: string
          recipient_phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_business_addresses_owner_fkey"
            columns: ["business_id", "customer_id", "customer_business_id"]
            isOneToOne: false
            referencedRelation: "customer_businesses"
            referencedColumns: ["business_id", "customer_id", "id"]
          },
        ]
      }
      customer_businesses: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          first_order_at: string | null
          first_seen_at: string
          id: string
          last_order_at: string | null
          last_seen_at: string
          lifetime_order_value: number
          order_count: number
          original_acquisition_source_id: string | null
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          first_order_at?: string | null
          first_seen_at: string
          id?: string
          last_order_at?: string | null
          last_seen_at: string
          lifetime_order_value?: number
          order_count?: number
          original_acquisition_source_id?: string | null
          status: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          first_order_at?: string | null
          first_seen_at?: string
          id?: string
          last_order_at?: string | null
          last_seen_at?: string
          lifetime_order_value?: number
          order_count?: number
          original_acquisition_source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_businesses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_businesses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          id: string
          phone_e164: string
          phone_verified_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id?: string
          phone_e164: string
          phone_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id?: string
          phone_e164?: string
          phone_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_customer_business_address: {
        Args: {
          p_address_line_1: string
          p_address_line_2?: string
          p_city: string
          p_customer_business_id: string
          p_delivery_instructions?: string
          p_is_default?: boolean
          p_label: string
          p_landmark?: string
          p_latitude: number
          p_locality: string
          p_longitude: number
          p_postal_code?: string
          p_recipient_name: string
          p_recipient_phone: string
          p_state: string
        }
        Returns: string
      }
      delete_customer_business_address: {
        Args: { p_address_id: string }
        Returns: undefined
      }
      record_customer_business_visit: {
        Args: {
          p_acquisition_source_id?: string
          p_business_id: string
          p_customer_id: string
          p_seen_at?: string
        }
        Returns: string
      }
      set_default_customer_business_address: {
        Args: { p_address_id: string; p_customer_business_id: string }
        Returns: undefined
      }
      update_customer_business_address: {
        Args: {
          p_address_id: string
          p_address_line_1: string
          p_address_line_2?: string
          p_city: string
          p_delivery_instructions?: string
          p_is_default: boolean
          p_label: string
          p_landmark?: string
          p_latitude: number
          p_locality: string
          p_longitude: number
          p_postal_code?: string
          p_recipient_name: string
          p_recipient_phone: string
          p_state: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  ordering: {
    Tables: {
      acquisition_sources: {
        Row: {
          business_id: string
          campaign_id: string | null
          channel: string
          code: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          channel: string
          code: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          channel?: string
          code?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_sources_business_id_campaign_id_fkey"
            columns: ["business_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          acquisition_source_id: string | null
          business_id: string
          cart_id: string | null
          customer_id: string | null
          event_name: string
          id: string
          location_id: string | null
          metadata: Json
          occurred_at: string
          order_id: string | null
          session_id: string
        }
        Insert: {
          acquisition_source_id?: string | null
          business_id: string
          cart_id?: string | null
          customer_id?: string | null
          event_name: string
          id?: string
          location_id?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          session_id: string
        }
        Update: {
          acquisition_source_id?: string | null
          business_id?: string
          cart_id?: string | null
          customer_id?: string | null
          event_name?: string
          id?: string
          location_id?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_business_location_cart_fkey"
            columns: ["business_id", "location_id", "cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["business_id", "location_id", "id"]
          },
          {
            foreignKeyName: "analytics_events_business_order_fkey"
            columns: ["business_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "analytics_events_business_source_fkey"
            columns: ["business_id", "acquisition_source_id"]
            isOneToOne: false
            referencedRelation: "acquisition_sources"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      campaigns: {
        Row: {
          business_id: string
          code: string
          created_at: string
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_item_options: {
        Row: {
          cart_item_id: string
          option_id: string
          quantity: number
        }
        Insert: {
          cart_item_id: string
          option_id: string
          quantity?: number
        }
        Update: {
          cart_item_id?: string
          option_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_options_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          customer_note: string | null
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          customer_note?: string | null
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          customer_note?: string | null
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          acquisition_source_id: string | null
          anonymous_session_id: string | null
          business_id: string
          converted_order_id: string | null
          coupon_id: string | null
          created_at: string
          customer_business_id: string | null
          customer_id: string | null
          expires_at: string
          id: string
          location_id: string
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_source_id?: string | null
          anonymous_session_id?: string | null
          business_id: string
          converted_order_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_business_id?: string | null
          customer_id?: string | null
          expires_at: string
          id?: string
          location_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_source_id?: string | null
          anonymous_session_id?: string | null
          business_id?: string
          converted_order_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_business_id?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          location_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_business_id_acquisition_source_id_fkey"
            columns: ["business_id", "acquisition_source_id"]
            isOneToOne: false
            referencedRelation: "acquisition_sources"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "carts_business_id_coupon_id_fkey"
            columns: ["business_id", "coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "carts_business_location_converted_order_fkey"
            columns: ["business_id", "location_id", "converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["business_id", "location_id", "id"]
          },
        ]
      }
      catalog_availability_windows: {
        Row: {
          category_id: string | null
          created_at: string
          day_of_week: number
          ends_at: string
          id: string
          location_id: string
          product_id: string | null
          starts_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          day_of_week: number
          ends_at: string
          id?: string
          location_id: string
          product_id?: string | null
          starts_at: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          day_of_week?: number
          ends_at?: string
          id?: string
          location_id?: string
          product_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_availability_windows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_availability_windows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_locations: {
        Row: {
          coupon_id: string
          location_id: string
        }
        Insert: {
          coupon_id: string
          location_id: string
        }
        Update: {
          coupon_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_locations_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          business_id: string
          campaign_id: string | null
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          minimum_order_value: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          minimum_order_value?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          minimum_order_value?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_business_id_campaign_id_fkey"
            columns: ["business_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          delivery_fee: number
          estimated_delivery_cost: number
          free_delivery_threshold: number | null
          id: string
          is_active: boolean
          location_id: string
          max_distance_km: number
          min_distance_km: number
          minimum_order_value: number
          name: string
          sort_order: number
        }
        Insert: {
          delivery_fee: number
          estimated_delivery_cost: number
          free_delivery_threshold?: number | null
          id?: string
          is_active?: boolean
          location_id: string
          max_distance_km: number
          min_distance_km: number
          minimum_order_value?: number
          name: string
          sort_order?: number
        }
        Update: {
          delivery_fee?: number
          estimated_delivery_cost?: number
          free_delivery_threshold?: number | null
          id?: string
          is_active?: boolean
          location_id?: string
          max_distance_km?: number
          min_distance_km?: number
          minimum_order_value?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      opening_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          location_id: string
          opens_at: string | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          location_id: string
          opens_at?: string | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          location_id?: string
          opens_at?: string | null
        }
        Relationships: []
      }
      option_groups: {
        Row: {
          business_id: string
          id: string
          is_active: boolean
          max_selections: number
          min_selections: number
          name: string
          selection_type: string
          sort_order: number
        }
        Insert: {
          business_id: string
          id?: string
          is_active?: boolean
          max_selections: number
          min_selections?: number
          name: string
          selection_type: string
          sort_order?: number
        }
        Update: {
          business_id?: string
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          selection_type?: string
          sort_order?: number
        }
        Relationships: []
      }
      options: {
        Row: {
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          option_group_id: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          option_group_id: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          option_group_id?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "options_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          business_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          order_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          business_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          business_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_business_id_order_id_fkey"
            columns: ["business_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          id: string
          option_group_name: string
          option_id: string
          option_name: string
          order_item_id: string
          price_delta: number
          quantity: number
        }
        Insert: {
          id?: string
          option_group_name: string
          option_id: string
          option_name: string
          order_item_id: string
          price_delta: number
          quantity: number
        }
        Update: {
          id?: string
          option_group_name?: string
          option_id?: string
          option_name?: string
          order_item_id?: string
          price_delta?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_unit_price: number
          category_id_snapshot: string
          created_at: string
          customer_note: string | null
          final_unit_price: number
          id: string
          line_total: number
          modifier_unit_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
        }
        Insert: {
          base_unit_price: number
          category_id_snapshot: string
          created_at?: string
          customer_note?: string | null
          final_unit_price: number
          id?: string
          line_total: number
          modifier_unit_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
        }
        Update: {
          base_unit_price?: number
          category_id_snapshot?: string
          created_at?: string
          customer_note?: string | null
          final_unit_price?: number
          id?: string
          line_total?: number
          modifier_unit_total?: number
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_category_id_snapshot_fkey"
            columns: ["category_id_snapshot"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          acquisition_source_id: string | null
          aggregator_benchmark_rate_snapshot: number
          business_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          coupon_code_snapshot: string | null
          coupon_discount_amount: number
          coupon_id: string | null
          created_at: string
          currency: string
          customer_business_id: string
          customer_id: string
          customer_name_snapshot: string
          customer_note: string | null
          customer_phone_snapshot: string
          delivered_at: string | null
          delivery_address_snapshot: Json | null
          delivery_distance_km: number | null
          delivery_fee: number
          delivery_zone_id: string | null
          discount_total: number
          estimated_delivery_cost: number
          estimated_delivery_minutes: number
          food_subtotal: number
          fulfillment_type: string
          grand_total: number
          id: string
          latitude: number | null
          location_id: string
          longitude: number | null
          loyalty_redeemed: number
          normal_delivery_fee: number
          order_number: string
          out_for_delivery_at: string | null
          payment_status: string
          placed_at: string | null
          restaurant_note: string | null
          skrowia_commission_rate_snapshot: number
          skrowia_commissionable_amount: number
          status: string
          tax_total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          acquisition_source_id?: string | null
          aggregator_benchmark_rate_snapshot: number
          business_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code_snapshot?: string | null
          coupon_discount_amount?: number
          coupon_id?: string | null
          created_at?: string
          currency: string
          customer_business_id: string
          customer_id: string
          customer_name_snapshot: string
          customer_note?: string | null
          customer_phone_snapshot: string
          delivered_at?: string | null
          delivery_address_snapshot?: Json | null
          delivery_distance_km?: number | null
          delivery_fee: number
          delivery_zone_id?: string | null
          discount_total: number
          estimated_delivery_cost: number
          estimated_delivery_minutes: number
          food_subtotal: number
          fulfillment_type: string
          grand_total: number
          id?: string
          latitude?: number | null
          location_id: string
          longitude?: number | null
          loyalty_redeemed?: number
          normal_delivery_fee: number
          order_number: string
          out_for_delivery_at?: string | null
          payment_status: string
          placed_at?: string | null
          restaurant_note?: string | null
          skrowia_commission_rate_snapshot: number
          skrowia_commissionable_amount: number
          status: string
          tax_total: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          acquisition_source_id?: string | null
          aggregator_benchmark_rate_snapshot?: number
          business_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code_snapshot?: string | null
          coupon_discount_amount?: number
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_business_id?: string
          customer_id?: string
          customer_name_snapshot?: string
          customer_note?: string | null
          customer_phone_snapshot?: string
          delivered_at?: string | null
          delivery_address_snapshot?: Json | null
          delivery_distance_km?: number | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          discount_total?: number
          estimated_delivery_cost?: number
          estimated_delivery_minutes?: number
          food_subtotal?: number
          fulfillment_type?: string
          grand_total?: number
          id?: string
          latitude?: number | null
          location_id?: string
          longitude?: number | null
          loyalty_redeemed?: number
          normal_delivery_fee?: number
          order_number?: string
          out_for_delivery_at?: string | null
          payment_status?: string
          placed_at?: string | null
          restaurant_note?: string | null
          skrowia_commission_rate_snapshot?: number
          skrowia_commissionable_amount?: number
          status?: string
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_acquisition_source_id_fkey"
            columns: ["business_id", "acquisition_source_id"]
            isOneToOne: false
            referencedRelation: "acquisition_sources"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "orders_business_id_coupon_id_fkey"
            columns: ["business_id", "coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "orders_location_id_delivery_zone_id_fkey"
            columns: ["location_id", "delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["location_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          currency: string
          failed_at: string | null
          gateway_fee: number | null
          gateway_payload: Json
          gateway_tax: number | null
          id: string
          method: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          currency: string
          failed_at?: string | null
          gateway_fee?: number | null
          gateway_payload?: Json
          gateway_tax?: number | null
          id?: string
          method?: string | null
          order_id: string
          paid_at?: string | null
          provider: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          currency?: string
          failed_at?: string | null
          gateway_fee?: number | null
          gateway_payload?: Json
          gateway_tax?: number | null
          id?: string
          method?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_order_id_fkey"
            columns: ["business_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      product_locations: {
        Row: {
          is_available: boolean
          location_id: string
          price_override: number | null
          product_id: string
        }
        Insert: {
          is_available?: boolean
          location_id: string
          price_override?: number | null
          product_id: string
        }
        Update: {
          is_available?: boolean
          location_id?: string
          price_override?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_locations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          option_group_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          option_group_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          option_group_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          business_id: string
          category_id: string
          created_at: string
          description: string | null
          dietary_type: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          name: string
          prep_time_minutes: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price: number
          business_id: string
          category_id: string
          created_at?: string
          description?: string | null
          dietary_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name: string
          prep_time_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          business_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          dietary_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name?: string
          prep_time_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_category_id_fkey"
            columns: ["business_id", "category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          external_reference: string | null
          id: string
          method: string
          order_id: string
          payment_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          external_reference?: string | null
          id?: string
          method: string
          order_id: string
          payment_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_reference?: string | null
          id?: string
          method?: string
          order_id?: string
          payment_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_payment_id_fkey"
            columns: ["order_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["order_id", "id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          accept_orders_when_closed: boolean
          aggregator_benchmark_rate: number | null
          created_at: string
          currency: string
          default_prep_minutes: number
          location_id: string
          minimum_order_value: number
          ordering_enabled: boolean
          ordering_mode: string
          skrowia_commission_rate: number
          tax_mode: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          accept_orders_when_closed?: boolean
          aggregator_benchmark_rate?: number | null
          created_at?: string
          currency: string
          default_prep_minutes: number
          location_id: string
          minimum_order_value?: number
          ordering_enabled?: boolean
          ordering_mode: string
          skrowia_commission_rate: number
          tax_mode: string
          tax_rate: number
          updated_at?: string
        }
        Update: {
          accept_orders_when_closed?: boolean
          aggregator_benchmark_rate?: number | null
          created_at?: string
          currency?: string
          default_prep_minutes?: number
          location_id?: string
          minimum_order_value?: number
          ordering_enabled?: boolean
          ordering_mode?: string
          skrowia_commission_rate?: number
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_order_messages: {
        Row: {
          created_at: string
          id: string
          last_rendered_status: string
          order_id: string
          telegram_chat_id: number
          telegram_message_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_rendered_status: string
          order_id: string
          telegram_chat_id: number
          telegram_message_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_rendered_status?: string
          order_id?: string
          telegram_chat_id?: number
          telegram_message_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_staff: {
        Row: {
          business_id: string
          created_at: string
          display_name: string
          id: string
          is_authorized: boolean
          telegram_user_id: number
        }
        Insert: {
          business_id: string
          created_at?: string
          display_name: string
          id?: string
          is_authorized?: boolean
          telegram_user_id: number
        }
        Update: {
          business_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_authorized?: boolean
          telegram_user_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_anonymous_cart: {
        Args: {
          p_anonymous_session_id: string
          p_business_id: string
          p_customer_business_id: string
          p_location_id: string
          p_new_cart_id: string
        }
        Returns: Json
      }
      checkout_cart: {
        Args: {
          p_cart_id: string
          p_customer_business_address_id?: string
          p_customer_note?: string
          p_fulfillment_type: string
          p_order_id: string
          p_trusted_delivery_minutes?: number
        }
        Returns: Json
      }
      create_manual_refund: {
        Args: {
          p_amount: number
          p_order_id: string
          p_payment_id: string
          p_reason: string
          p_refund_id: string
        }
        Returns: Json
      }
      create_payment_attempt: {
        Args: {
          p_amount: number
          p_currency: string
          p_method?: string
          p_order_id: string
          p_payment_id: string
          p_provider: string
        }
        Returns: Json
      }
      get_analytics_diagnostics: {
        Args: { p_business_id: string; p_from?: string; p_to?: string }
        Returns: Json
      }
      get_analytics_funnel: {
        Args: { p_business_id: string; p_from?: string; p_to?: string }
        Returns: Json
      }
      get_cart: {
        Args: { p_anonymous_session_id?: string; p_cart_id: string }
        Returns: Json
      }
      get_delivery_quote: {
        Args: {
          p_destination_latitude: number
          p_destination_longitude: number
          p_food_subtotal_after_discount: number
          p_location_id: string
        }
        Returns: Json
      }
      get_menu: {
        Args: { p_business_id: string; p_location_id: string }
        Returns: Json
      }
      get_order: { Args: { p_order_id: string }; Returns: Json }
      get_order_finance: { Args: { p_order_id: string }; Returns: Json }
      get_public_menu: {
        Args: { p_business_slug: string; p_location_id: string }
        Returns: Json
      }
      get_storefront_menu: { Args: { p_location_id: string }; Returns: Json }
      get_telegram_message_payload: {
        Args: { p_order_id: string }
        Returns: Json
      }
      ingest_analytics_events: { Args: { p_events: Json }; Returns: Json }
      list_orders: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_business_id: string
          p_limit?: number
          p_statuses?: string[]
        }
        Returns: Json
      }
      list_orders_for_location: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_business_id: string
          p_limit?: number
          p_location_id: string
          p_statuses?: string[]
        }
        Returns: Json
      }
      list_stale_payment_attempts: {
        Args: { p_before: string; p_limit?: number }
        Returns: Json
      }
      list_telegram_reconciliation_candidates: {
        Args: { p_limit?: number }
        Returns: {
          business_id: string
          current_status: string
          last_rendered_status: string
          order_id: string
          telegram_chat_id: number
          telegram_message_id: number
          telegram_user_id: number
        }[]
      }
      list_telegram_staff: { Args: { p_business_id: string }; Returns: Json }
      maintain_cart_lifecycle: {
        Args: {
          p_abandon_before?: string
          p_batch_size?: number
          p_expire_before?: string
        }
        Returns: Json
      }
      mark_payment_pending: {
        Args: {
          p_gateway_payload?: Json
          p_payment_id: string
          p_provider_order_id: string
        }
        Returns: Json
      }
      open_anonymous_cart: {
        Args: {
          p_acquisition_source_id?: string
          p_anonymous_session_id: string
          p_business_id: string
          p_cart_id: string
          p_location_id: string
        }
        Returns: Json
      }
      open_customer_cart: {
        Args: {
          p_acquisition_source_id?: string
          p_business_id: string
          p_cart_id: string
          p_customer_business_id: string
          p_location_id: string
        }
        Returns: Json
      }
      quote_cart: {
        Args: {
          p_anonymous_session_id: string
          p_cart_id: string
          p_customer_business_address_id?: string
          p_fulfillment_type: string
          p_trusted_delivery_minutes?: number
        }
        Returns: Json
      }
      record_payment_result: {
        Args: {
          p_gateway_fee?: number
          p_gateway_payload?: Json
          p_gateway_tax?: number
          p_method?: string
          p_occurred_at?: string
          p_payment_id: string
          p_provider_event_id: string
          p_provider_payment_id?: string
          p_result_status: string
        }
        Returns: Json
      }
      record_trusted_order_placed_event: {
        Args: { p_metadata?: Json; p_order_id: string; p_session_id: string }
        Returns: Json
      }
      remove_cart_item: {
        Args: {
          p_anonymous_session_id: string
          p_cart_id: string
          p_cart_item_id: string
        }
        Returns: Json
      }
      save_business_settings: {
        Args: {
          p_baseline: Json
          p_business_id: string
          p_location_id: string
          p_settings: Json
        }
        Returns: undefined
      }
      save_menu_changes: {
        Args: {
          p_baseline: Json
          p_business_id: string
          p_location_id: string
          p_menu: Json
        }
        Returns: undefined
      }
      save_menu_changes_with_baseline: {
        Args: {
          p_baseline: Json
          p_business_id: string
          p_location_id: string
          p_menu: Json
        }
        Returns: Json
      }
      set_cart_coupon: {
        Args: {
          p_anonymous_session_id: string
          p_cart_id: string
          p_code?: string
        }
        Returns: Json
      }
      set_cart_item: {
        Args: {
          p_anonymous_session_id: string
          p_cart_id: string
          p_cart_item_id: string
          p_customer_note?: string
          p_options?: Json
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
      set_manual_refund_status: {
        Args: {
          p_external_reference?: string
          p_new_status: string
          p_refund_id: string
        }
        Returns: Json
      }
      set_order_restaurant_note: {
        Args: { p_order_id: string; p_restaurant_note: string }
        Returns: Json
      }
      transition_order: {
        Args: {
          p_cancel_reason?: string
          p_expected_status: string
          p_new_status: string
          p_order_id: string
        }
        Returns: Json
      }
      transition_order_at_location: {
        Args: {
          p_business_id: string
          p_cancel_reason?: string
          p_expected_status: string
          p_location_id: string
          p_new_status: string
          p_order_id: string
        }
        Returns: Json
      }
      transition_order_from_telegram: {
        Args: {
          p_cancel_reason?: string
          p_expected_status: string
          p_new_status: string
          p_order_id: string
          p_telegram_user_id: number
        }
        Returns: Json
      }
      upsert_telegram_order_message: {
        Args: {
          p_last_rendered_status: string
          p_order_id: string
          p_telegram_chat_id: number
          p_telegram_message_id: number
        }
        Returns: Json
      }
      upsert_telegram_staff: {
        Args: {
          p_business_id: string
          p_display_name: string
          p_is_authorized?: boolean
          p_telegram_user_id: number
        }
        Returns: Json
      }
      validate_coupon: {
        Args: {
          p_at?: string
          p_business_id: string
          p_code: string
          p_eligible_food_subtotal: number
          p_location_id: string
        }
        Returns: Json
      }
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
  core: {
    Enums: {},
  },
  ordering: {
    Enums: {},
  },
} as const
