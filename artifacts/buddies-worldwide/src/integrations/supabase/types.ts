export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          listing_id: string;
          moderator_id: string | null;
          seller_id: string;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          listing_id: string;
          moderator_id?: string | null;
          seller_id: string;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
          moderator_id?: string | null;
          seller_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      disputes: {
        Row: {
          created_at: string;
          description: string | null;
          evidence_url: string | null;
          id: string;
          order_id: string;
          raised_by: string;
          reason: string;
          resolution: string | null;
          resolved_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          evidence_url?: string | null;
          id?: string;
          order_id: string;
          raised_by: string;
          reason: string;
          resolution?: string | null;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          evidence_url?: string | null;
          id?: string;
          order_id?: string;
          raised_by?: string;
          reason?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      listing_images: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          position: number;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          position?: number;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          position?: number;
          url?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          location: string;
          price: number;
          seller_id: string;
          status: string;
          title: string;
          updated_at: string;
          video_thumbnail: string | null;
          video_url: string | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          location: string;
          price: number;
          seller_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          video_thumbnail?: string | null;
          video_url?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          location?: string;
          price?: number;
          seller_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          video_thumbnail?: string | null;
          video_url?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          image_url: string | null;
          message_type: string;
          sender_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          message_type?: string;
          sender_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          message_type?: string;
          sender_id?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          amount: number;
          buyer_id: string;
          completed_at: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_deadline: string | null;
          id: string;
          listing_id: string;
          payment_reference: string | null;
          seller_id: string;
          shipped_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          buyer_id: string;
          completed_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_deadline?: string | null;
          id?: string;
          listing_id: string;
          payment_reference?: string | null;
          seller_id: string;
          shipped_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          buyer_id?: string;
          completed_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_deadline?: string | null;
          id?: string;
          listing_id?: string;
          payment_reference?: string | null;
          seller_id?: string;
          shipped_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          completed_sales: number;
          created_at: string;
          display_name: string;
          id: string;
          id_verified: boolean;
          is_admin: boolean;
          location: string | null;
          phone_verified: boolean;
          rating: number;
          seller_level: string;
          updated_at: string;
          user_id: string;
          verification_status: string;
        };
        Insert: {
          avatar_url?: string | null;
          completed_sales?: number;
          created_at?: string;
          display_name?: string;
          id?: string;
          id_verified?: boolean;
          is_admin?: boolean;
          location?: string | null;
          phone_verified?: boolean;
          rating?: number;
          seller_level?: string;
          updated_at?: string;
          user_id: string;
          verification_status?: string;
        };
        Update: {
          avatar_url?: string | null;
          completed_sales?: number;
          created_at?: string;
          display_name?: string;
          id?: string;
          id_verified?: boolean;
          is_admin?: boolean;
          location?: string | null;
          phone_verified?: boolean;
          rating?: number;
          seller_level?: string;
          updated_at?: string;
          user_id?: string;
          verification_status?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          order_id: string;
          rating: number;
          reviewed_user_id: string;
          reviewer_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          rating: number;
          reviewed_user_id: string;
          reviewer_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          rating?: number;
          reviewed_user_id?: string;
          reviewer_id?: string;
        };
        Relationships: [];
      };
      verification_requests: {
        Row: {
          created_at: string;
          doc_back_url: string | null;
          doc_front_url: string | null;
          doc_type: string;
          id: string;
          notes: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          selfie_url: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          doc_back_url?: string | null;
          doc_front_url?: string | null;
          doc_type: string;
          id?: string;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          selfie_url?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          doc_back_url?: string | null;
          doc_front_url?: string | null;
          doc_type?: string;
          id?: string;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          selfie_url?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
