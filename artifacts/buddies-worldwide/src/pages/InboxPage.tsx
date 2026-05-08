import { useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { useUnread } from "@/contexts/UnreadContext";
import { Shield } from "lucide-react";

const InboxPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const { counts } = useUnread();

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">Inbox</h1>
      </header>

      <div className="mx-4 mb-3 rounded-xl bg-warning/10 px-3 py-2">
        <p className="text-xs text-foreground">
          ⚠️ <span className="font-semibold">Never pay outside Buddies Worldwide.</span> All messages are monitored for your safety.
        </p>
      </div>

      <main className="px-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : conversations && conversations.length > 0 ? (
          conversations.map((conv: any) => {
            const isbuyer = conv.buyer_id === user?.id;
            const otherName = isbuyer ? conv.seller_profile?.display_name : conv.buyer_profile?.display_name;
            const initials = otherName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
            const hasmod = !!conv.moderator_id;
            const unread = counts[conv.id] ?? 0;

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm text-left"
              >
                <div className="relative">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                  </div>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className={`text-sm truncate ${unread > 0 ? "font-bold text-foreground" : "font-semibold text-card-foreground"}`}>
                      {otherName || "User"}
                    </h3>
                    {hasmod && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive flex-shrink-0">
                        <Shield className="h-2.5 w-2.5" /> Mediated
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {conv.listing?.title || "Listing"}
                  </p>
                </div>
                {unread > 0 && (
                  <div className="flex-shrink-0 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No conversations yet</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxPage;
