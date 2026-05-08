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
  images?: string[];
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
    verification_status: string;
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
          seller:profiles!listings_seller_id_fkey(display_name, seller_level, rating, completed_sales, avatar_url, verification_status)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (category) query = query.eq("category", category);
      if (search) query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;

      const listings = (data as any[]).map((item) => ({
        ...item,
        seller: item.seller?.[0] ?? item.seller ?? null,
      }));

      const ids = listings.map((l) => l.id);
      if (ids.length === 0) return listings;

      const { data: imgData } = await supabase
        .from("listing_images")
        .select("listing_id, url, position")
        .in("listing_id", ids)
        .order("position", { ascending: true });

      const imgMap: Record<string, string[]> = {};
      for (const img of (imgData || []) as any[]) {
        if (!imgMap[img.listing_id]) imgMap[img.listing_id] = [];
        imgMap[img.listing_id].push(img.url);
      }

      return listings.map((l) => ({
        ...l,
        images: imgMap[l.id] ?? (l.image_url ? [l.image_url] : []),
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
          seller:profiles!listings_seller_id_fkey(display_name, seller_level, rating, completed_sales, avatar_url, verification_status)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      const item = data as any;
      const listing: ListingWithSeller = {
        ...item,
        seller: item.seller?.[0] ?? item.seller ?? null,
      };

      const { data: imgData } = await supabase
        .from("listing_images")
        .select("url, position")
        .eq("listing_id", id)
        .order("position", { ascending: true });

      listing.images = (imgData as any[])?.map((i) => i.url) ?? (listing.image_url ? [listing.image_url] : []);
      return listing;
    },
    enabled: !!id,
  });
};
