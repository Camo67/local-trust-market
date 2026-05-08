import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useOrders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          listing:listings(title, image_url, price),
          seller_profile:profiles!orders_seller_id_fkey(display_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((item) => ({
        ...item,
        listing: item.listing?.[0] ?? item.listing ?? null,
        seller_profile: item.seller_profile?.[0] ?? item.seller_profile ?? null,
      }));
    },
    enabled: !!user,
  });
};
