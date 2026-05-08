import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllLastRead } from "@/lib/lastRead";

export const useUnreadCounts = (
  userId: string | undefined,
  convIds: string[]
) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = convIds.join(",");

  const fetchCounts = useCallback(async () => {
    if (!userId || convIds.length === 0) return;

    const lastReadMap = getAllLastRead(userId, convIds);
    const minTs = Math.min(...Object.values(lastReadMap));
    const minIso = new Date(minTs || 0).toISOString();

    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, created_at")
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .gte("created_at", minIso);

    if (error || !data) return;

    const next: Record<string, number> = {};
    for (const id of convIds) next[id] = 0;
    for (const msg of data as any[]) {
      const lastRead = lastReadMap[msg.conversation_id] ?? 0;
      if (new Date(msg.created_at).getTime() > lastRead) {
        next[msg.conversation_id] = (next[msg.conversation_id] ?? 0) + 1;
      }
    }
    setCounts(next);
  }, [userId, key]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!userId || convIds.length === 0) return;

    const channel = supabase
      .channel(`unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!convIds.includes(msg.conversation_id)) return;
          if (msg.sender_id === userId) return;
          setCounts((prev) => ({
            ...prev,
            [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, key]);

  const markRead = useCallback((convId: string) => {
    setCounts((prev) => ({ ...prev, [convId]: 0 }));
  }, []);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return { counts, markRead, total };
};
