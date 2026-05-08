import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useConversations = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          listing:listings(title, image_url),
          buyer_profile:profiles!conversations_buyer_id_fkey(display_name),
          seller_profile:profiles!conversations_seller_id_fkey(display_name),
          moderator_profile:profiles!conversations_moderator_id_fkey(display_name)
        `)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((item) => ({
        ...item,
        listing: item.listing?.[0] ?? item.listing ?? null,
        buyer_profile: item.buyer_profile?.[0] ?? item.buyer_profile ?? null,
        seller_profile: item.seller_profile?.[0] ?? item.seller_profile ?? null,
        moderator_profile: item.moderator_profile?.[0] ?? item.moderator_profile ?? null,
      }));
    },
    enabled: !!user,
  });
};

export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          listing:listings(title, image_url, price),
          buyer_profile:profiles!conversations_buyer_id_fkey(display_name, verification_status),
          seller_profile:profiles!conversations_seller_id_fkey(display_name, verification_status),
          moderator_profile:profiles!conversations_moderator_id_fkey(display_name)
        `)
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      const item = data as any;
      return {
        ...item,
        listing: item.listing?.[0] ?? item.listing ?? null,
        buyer_profile: item.buyer_profile?.[0] ?? item.buyer_profile ?? null,
        seller_profile: item.seller_profile?.[0] ?? item.seller_profile ?? null,
        moderator_profile: item.moderator_profile?.[0] ?? item.moderator_profile ?? null,
      };
    },
    enabled: !!conversationId,
  });
};
