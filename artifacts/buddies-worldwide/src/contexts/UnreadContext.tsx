import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getAllLastRead, setLastRead } from "@/lib/lastRead";

interface UnreadContextValue {
  counts: Record<string, number>;
  total: number;
  markRead: (convId: string) => void;
  refreshCounts: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  counts: {},
  total: 0,
  markRead: () => {},
  refreshCounts: () => {},
});

export const useUnread = () => useContext(UnreadContext);

export const UnreadProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [convIds, setConvIds] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) { setConvIds([]); setCounts({}); return; }
    supabase
      .from("conversations")
      .select("id")
      .then(({ data }) => {
        if (data) setConvIds((data as any[]).map((r) => r.id));
      });
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!user || convIds.length === 0) return;

    const lastReadMap = getAllLastRead(user.id, convIds);
    const minTs = Math.min(...Object.values(lastReadMap));
    const minIso = new Date(minTs || 0).toISOString();

    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, created_at")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
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
  }, [user, convIds.join(",")]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  useEffect(() => {
    if (!user || convIds.length === 0) return;

    const channel = supabase
      .channel(`unread_ctx:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!convIds.includes(msg.conversation_id)) return;
          if (msg.sender_id === user.id) return;
          setCounts((prev) => ({
            ...prev,
            [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1,
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        ({ new: row }) => {
          const id = (row as any).id;
          if (!convIds.includes(id)) setConvIds((prev) => [...prev, id]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, convIds.join(",")]);

  const markRead = useCallback((convId: string) => {
    if (!user) return;
    setLastRead(user.id, convId);
    setCounts((prev) => ({ ...prev, [convId]: 0 }));
  }, [user]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <UnreadContext.Provider value={{ counts, total, markRead, refreshCounts: fetchCounts }}>
      {children}
    </UnreadContext.Provider>
  );
};
