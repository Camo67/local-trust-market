import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ListingWithSeller {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  location: string;
  image_url: string | null;
  video_url: string | null;
  video_thumbnail: string | null;
  status: string;
  seller_id: string;
  created_at: string;
  seller: {
    display_name: string;
    seller_level: string;
    rating: number;
    completed_sales: number;
    avatar_url: string | null;
  } | null;
}

export const useListings = (category?: string, search?: string) => {
  return useQuery({
    queryKey: ["listings", category, search],
    queryFn: async (): Promise<ListingWithSeller[]> => {
      let query = supabase
        .from("listings")
        .select(`
          *,
          seller:profiles!listings_seller_id_fkey(display_name, seller_level, rating, completed_sales, avatar_url)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (category) {
        query = query.eq("category", category);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map((item) => ({
        ...item,
        seller: item.seller?.[0] ?? item.seller ?? null,
      }));
    },
  });
};

export const useListing = (id: string) => {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: async (): Promise<ListingWithSeller | null> => {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          seller:profiles!listings_seller_id_fkey(display_name, seller_level, rating, completed_sales, avatar_url)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      const item = data as any;
      return {
        ...item,
        seller: item.seller?.[0] ?? item.seller ?? null,
      };
    },
    enabled: !!id,
  });
};
