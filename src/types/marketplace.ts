export interface Listing {
  id: string;
  title: string;
  price: number;
  category: string;
  location: string;
  description: string;
  image_url: string;
  video_url?: string;
  video_thumbnail?: string;
  seller: {
    id: string;
    name: string;
    avatar_initials: string;
    level: "basic" | "verified" | "trusted";
    rating: number;
    completed_sales: number;
  };
  created_at: string;
}

export interface Order {
  id: string;
  listing: Listing;
  status: "pending" | "paid" | "shipped" | "delivered" | "completed" | "disputed";
  buyer_id: string;
  seller_id: string;
  amount: number;
  delivery_timer_end?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: "text" | "image" | "system";
  created_at: string;
}

export interface Conversation {
  id: string;
  listing: Listing;
  other_user: {
    name: string;
    avatar_initials: string;
  };
  last_message: string;
  unread_count: number;
  updated_at: string;
}

export const CATEGORIES = [
  "Electronics",
  "Furniture",
  "Clothing",
  "Vehicles",
  "Tools",
  "Home & Garden",
  "Sports",
  "Services",
  "Other",
] as const;
