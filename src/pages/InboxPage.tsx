import { useNavigate } from "react-router-dom";
import { MOCK_CONVERSATIONS } from "@/data/mock";

const InboxPage = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">Inbox</h1>
      </header>

      {/* Trust warning */}
      <div className="mx-4 mb-3 rounded-xl bg-warning/10 px-3 py-2">
        <p className="text-xs text-foreground">
          ⚠️ <span className="font-semibold">Never pay outside Buddies Worldwide.</span> All messages are monitored for your safety.
        </p>
      </div>

      <main className="px-4 space-y-2">
        {MOCK_CONVERSATIONS.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          MOCK_CONVERSATIONS.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm text-left"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {conv.other_user.avatar_initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-card-foreground">{conv.other_user.name}</h3>
                  {conv.unread_count > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.listing.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
              </div>
            </button>
          ))
        )}
      </main>
    </div>
  );
};

export default InboxPage;
