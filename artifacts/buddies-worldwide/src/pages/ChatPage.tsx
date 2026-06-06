import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, AlertTriangle, Shield } from "lucide-react";
import { useMessages, useConversation } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { useUnread } from "@/contexts/UnreadContext";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/hooks/usePushNotifications";

const BLOCKED_PATTERNS = [
  /whatsapp/i, /watsapp/i, /wat'sap/i,
  /pay outside/i, /pay direct/i,
  /(\d{10,})/,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /fnb|capitec|absa|nedbank|standard bank/i,
];

const TYPING_TIMEOUT_MS = 2500;

const ChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { markRead } = useUnread();
  const { data: messages } = useMessages(id || "");
  const { data: conversation } = useConversation(id || "");
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const broadcastChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef<number>(0);

  useEffect(() => {
    if (id) markRead(id);
  }, [id, markRead]);

  useEffect(() => {
    if (id && messages && messages.length > 0) markRead(id);
  }, [id, messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  useEffect(() => {
    if (!id || !user) return;

    const channel = supabase.channel(`typing:${id}`, {
      config: { broadcast: { self: false } },
    });

    broadcastChannel.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, displayName } = payload as { userId: string; displayName: string };
        if (userId === user.id) return;
        setTypingUsers((prev) => ({ ...prev, [userId]: displayName }));
        if (typingTimers.current[userId]) clearTimeout(typingTimers.current[userId]);
        typingTimers.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }, TYPING_TIMEOUT_MS);
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        const { userId } = payload as { userId: string };
        if (typingTimers.current[userId]) clearTimeout(typingTimers.current[userId]);
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      broadcastChannel.current = null;
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [id, user]);

  const broadcastTyping = useCallback(() => {
    if (!broadcastChannel.current || !user || !id) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 800) return;
    lastTypingSent.current = now;

    const displayName =
      conversation?.buyer_id === user.id
        ? conversation?.buyer_profile?.display_name
        : conversation?.seller_id === user.id
          ? conversation?.seller_profile?.display_name
          : conversation?.moderator_profile?.display_name ?? "Someone";

    broadcastChannel.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, displayName: displayName || "Someone" },
    });
  }, [user, id, conversation]);

  const broadcastStopTyping = useCallback(() => {
    if (!broadcastChannel.current || !user) return;
    broadcastChannel.current.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { userId: user.id },
    });
  }, [user]);

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
    broadcastStopTyping();
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
      message_type: "text",
    });

    if (conversation) {
      const myName =
        conversation.buyer_id === user.id
          ? conversation.buyer_profile?.display_name
          : conversation.seller_id === user.id
            ? conversation.seller_profile?.display_name
            : conversation.moderator_profile?.display_name ?? "Someone";

      const recipients = [
        conversation.buyer_id,
        conversation.seller_id,
        conversation.moderator_id,
      ].filter((uid): uid is string => !!uid && uid !== user.id);

      if (recipients.length > 0) {
        sendPushNotification({
          recipientUserIds: recipients,
          title: myName || "New message",
          body: content.length > 80 ? content.slice(0, 77) + "…" : content,
          conversationId: id,
        }, session || undefined);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (warning) checkForBlockedContent(val);
    if (val.trim()) broadcastTyping();
    else broadcastStopTyping();
  };

  const otherName = conversation
    ? (conversation.buyer_id === user?.id ? conversation.seller_profile?.display_name : conversation.buyer_profile?.display_name)
    : "Chat";

  const typingNames = Object.values(typingUsers);
  const typingLabel =
    typingNames.length === 1
      ? `${typingNames[0]} is typing`
      : typingNames.length === 2
        ? `${typingNames[0]} and ${typingNames[1]} are typing`
        : typingNames.length > 2
          ? "Several people are typing"
          : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate("/inbox")}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground truncate">{otherName || "Chat"}</p>
          <div className="h-4 overflow-hidden">
            {typingLabel ? (
              <p className="flex items-center gap-1 text-xs text-primary animate-pulse">
                <span>{typingLabel}</span>
                <span className="inline-flex gap-0.5 items-end pb-0.5">
                  <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                  <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                  <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground truncate">{conversation?.listing?.title}</p>
            )}
          </div>
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

        {typingLabel && (
          <div className="flex items-start">
            <div className="rounded-2xl rounded-bl-sm bg-card shadow-sm px-3 py-2.5 flex gap-1 items-center">
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </div>
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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={broadcastStopTyping}
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
