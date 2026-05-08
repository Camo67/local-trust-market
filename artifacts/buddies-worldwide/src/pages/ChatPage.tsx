import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, AlertTriangle, Shield } from "lucide-react";
import { useMessages, useConversation } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const BLOCKED_PATTERNS = [
  /whatsapp/i, /watsapp/i, /wat'sap/i,
  /pay outside/i, /pay direct/i,
  /(\d{10,})/,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /fnb|capitec|absa|nedbank|standard bank/i,
];

const ChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: messages } = useMessages(id || "");
  const { data: conversation } = useConversation(id || "");
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isParticipant = conversation &&
    (conversation.buyer_id === user?.id ||
     conversation.seller_id === user?.id ||
     conversation.moderator_id === user?.id);

  const isModerator = conversation?.moderator_id === user?.id;

  const getParticipantName = (senderId: string) => {
    if (!conversation) return "User";
    if (senderId === conversation.buyer_id) return conversation.buyer_profile?.display_name || "Buyer";
    if (senderId === conversation.seller_id) return conversation.seller_profile?.display_name || "Seller";
    if (senderId === conversation.moderator_id) return `${conversation.moderator_profile?.display_name || "Moderator"} (Mod)`;
    return "User";
  };

  const getSenderRole = (senderId: string) => {
    if (!conversation) return null;
    if (senderId === conversation.moderator_id) return "moderator";
    if (senderId === conversation.buyer_id) return "buyer";
    if (senderId === conversation.seller_id) return "seller";
    return null;
  };

  const checkForBlockedContent = (text: string): boolean => {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(text)) {
        setWarning("⚠️ Do not share personal details or pay outside Buddies Worldwide. Your safety depends on it!");
        return true;
      }
    }
    setWarning(null);
    return false;
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !id) return;
    if (checkForBlockedContent(input)) return;

    const content = input.trim();
    setInput("");

    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
      message_type: "text",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const otherName = conversation
    ? (conversation.buyer_id === user?.id ? conversation.seller_profile?.display_name : conversation.buyer_profile?.display_name)
    : "Chat";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate("/inbox")}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground truncate">{otherName || "Chat"}</p>
          <p className="text-xs text-muted-foreground truncate">{conversation?.listing?.title}</p>
        </div>
        {conversation?.moderator_id && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            <Shield className="h-3 w-3" /> Mediated
          </span>
        )}
      </header>

      {conversation?.moderator_id && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2">
          <Shield className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">{conversation.moderator_profile?.display_name || "A moderator"}</span> has joined to help resolve this dispute.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages?.map((msg: any) => {
          if (msg.message_type === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-escrow/10 px-3 py-1 text-xs text-escrow font-medium">{msg.content}</span>
              </div>
            );
          }
          const isMe = msg.sender_id === user?.id;
          const role = getSenderRole(msg.sender_id);
          const isMod = role === "moderator";
          const senderName = getParticipantName(msg.sender_id);
          const isThreeWay = !!conversation?.moderator_id;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {isThreeWay && !isMe && (
                <span className={`mb-0.5 text-[10px] font-medium ${isMod ? "text-destructive" : "text-muted-foreground"}`}>
                  {senderName}
                </span>
              )}
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                isMe
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : isMod
                    ? "bg-destructive/10 text-foreground rounded-bl-sm border border-destructive/20"
                    : "bg-card text-card-foreground rounded-bl-sm shadow-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          );
        })}
        {(!messages || messages.length === 0) && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Start the conversation!</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {warning && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{warning}</p>
        </div>
      )}

      {isModerator && (
        <div className="mx-3 mb-1 rounded-xl bg-destructive/10 px-3 py-1.5 text-center">
          <p className="text-[10px] font-medium text-destructive">You are moderating this conversation</p>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3 safe-bottom">
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); if (warning) checkForBlockedContent(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={isParticipant ? "Type a message..." : "You are not part of this conversation"}
          disabled={!isParticipant}
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !isParticipant}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
