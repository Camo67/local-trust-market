import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, AlertTriangle } from "lucide-react";
import { useMessages } from "@/hooks/useConversations";
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
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

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

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate("/inbox")}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <p className="text-sm font-semibold text-card-foreground">Chat</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages?.map((msg) => {
          if (msg.message_type === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-escrow/10 px-3 py-1 text-xs text-escrow font-medium">{msg.content}</span>
              </div>
            );
          }
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card text-card-foreground rounded-bl-sm shadow-sm"}`}>
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
      </div>

      {warning && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{warning}</p>
        </div>
      )}

      <div className="border-t border-border bg-card px-4 py-3 safe-bottom">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); if (warning) setWarning(null); }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={sendMessage} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
