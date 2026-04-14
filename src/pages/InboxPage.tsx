import { useNavigate } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";

const InboxPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conversations, isLoading } = useConversations();

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
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : conversations && conversations.length > 0 ? (
          conversations.map((conv: any) => {
            const otherName = conv.buyer_id === user?.id
              ? conv.seller_profile?.display_name
              : conv.buyer_profile?.display_name;
            const initials = otherName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm text-left"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-card-foreground">{otherName || "User"}</h3>
                  <p className="text-xs text-muted-foreground truncate">{conv.listing?.title || "Listing"}</p>
                </div>
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
