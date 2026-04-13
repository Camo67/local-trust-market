import type { Listing, Conversation, Order } from "@/types/marketplace";

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "1",
    title: "Handmade beaded baskets",
    price: 450,
    category: "Home & Garden",
    location: "Soweto, Johannesburg",
    description: "Beautiful handmade Zulu beaded baskets. Perfect for home decor. Each basket is unique and made with love.",
    image_url: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=300&fit=crop",
    seller: { id: "s1", name: "Thandiwe M.", avatar_initials: "TM", level: "verified", rating: 4.8, completed_sales: 23 },
    created_at: "2026-04-12T10:00:00Z",
  },
  {
    id: "2",
    title: "Reconditioned lawn mower",
    price: 1200,
    category: "Tools",
    location: "Alexandra, Johannesburg",
    description: "Fully reconditioned Briggs & Stratton lawn mower. Runs like new. 30-day guarantee included.",
    image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
    seller: { id: "s2", name: "Bongani K.", avatar_initials: "BK", level: "trusted", rating: 4.9, completed_sales: 67 },
    created_at: "2026-04-11T14:00:00Z",
  },
  {
    id: "3",
    title: "Samsung Galaxy A14 - Good condition",
    price: 2800,
    category: "Electronics",
    location: "Pretoria CBD",
    description: "Samsung Galaxy A14, 64GB, dual SIM. Minor scratches on back but screen is perfect. Charger included.",
    image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop",
    seller: { id: "s3", name: "Sipho N.", avatar_initials: "SN", level: "basic", rating: 4.2, completed_sales: 5 },
    created_at: "2026-04-10T09:00:00Z",
  },
  {
    id: "4",
    title: "Wooden dining table - 6 seater",
    price: 3500,
    category: "Furniture",
    location: "Sandton, Johannesburg",
    description: "Solid wood dining table with 6 chairs. Seats a full family comfortably. Collection only.",
    image_url: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400&h=300&fit=crop",
    seller: { id: "s4", name: "Lindiwe P.", avatar_initials: "LP", level: "verified", rating: 4.6, completed_sales: 15 },
    created_at: "2026-04-09T16:00:00Z",
  },
  {
    id: "5",
    title: "Fresh farm eggs - 30 pack",
    price: 85,
    category: "Other",
    location: "Midrand",
    description: "Free-range farm eggs. Fresh daily. Collected from happy chickens! Bulk orders welcome.",
    image_url: "https://images.unsplash.com/photo-1569288052389-dac9b0ac9eac?w=400&h=300&fit=crop",
    seller: { id: "s5", name: "Ma Dlamini", avatar_initials: "MD", level: "trusted", rating: 5.0, completed_sales: 142 },
    created_at: "2026-04-13T06:00:00Z",
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    listing: MOCK_LISTINGS[0],
    other_user: { name: "Thandiwe M.", avatar_initials: "TM" },
    last_message: "Hi! Is this still available?",
    unread_count: 2,
    updated_at: "2026-04-13T08:30:00Z",
  },
  {
    id: "c2",
    listing: MOCK_LISTINGS[1],
    other_user: { name: "Bongani K.", avatar_initials: "BK" },
    last_message: "I can deliver to Sandton for R100 extra",
    unread_count: 0,
    updated_at: "2026-04-12T15:00:00Z",
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: "o1",
    listing: MOCK_LISTINGS[0],
    status: "shipped",
    buyer_id: "me",
    seller_id: "s1",
    amount: 450,
    created_at: "2026-04-11T10:00:00Z",
  },
  {
    id: "o2",
    listing: MOCK_LISTINGS[4],
    status: "paid",
    buyer_id: "me",
    seller_id: "s5",
    amount: 85,
    created_at: "2026-04-13T07:00:00Z",
  },
];
