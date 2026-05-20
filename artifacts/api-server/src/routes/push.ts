import { Router, type Request } from "express";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

let _serviceSupabase: SupabaseClient | null = null;

function getServiceSupabase() {
  if (_serviceSupabase) return _serviceSupabase;
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server push notifications");
  _serviceSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceSupabase;
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function getUserSupabase(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Authorization bearer token required");
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

let _vapidSet = false;
function ensureVapid() {
  if (_vapidSet) return;
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  const contact = process.env["VAPID_CONTACT"] || "mailto:admin@buddiesworldwide.app";
  if (!pub || !priv) throw new Error("VAPID keys not set");
  webpush.setVapidDetails(contact, pub, priv);
  _vapidSet = true;
}

// All push routes require authentication
router.use(authMiddleware);

router.post("/push/subscribe", async (req, res) => {
  const { subscription } = req.body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  // Authorization check: Always use req.user.id to prevent IDOR
  const userId = (req as any).user.id;

  if (!subscription?.endpoint) {
    res.status(400).json({ error: "subscription required" });
    return;
  }

  try {
    const supabase = getUserSupabase(req);
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

    if (error) {
      req.log.error({ error }, "Failed to store push subscription");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "push/subscribe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint: string };

  // Authorization check: Always use req.user.id to prevent IDOR
  const userId = (req as any).user.id;

  if (!endpoint) {
    res.status(400).json({ error: "endpoint required" });
    return;
  }
  try {
    const supabase = getUserSupabase(req);
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "push/unsubscribe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/push/notify", async (req, res) => {
  const { recipientUserIds, title, body, conversationId } = req.body as {
    recipientUserIds: string[];
    title: string;
    body: string;
    conversationId: string;
  };

  if (!recipientUserIds?.length || !body || !conversationId) {
    res.status(400).json({ error: "recipientUserIds, body, and conversationId required" });
    return;
  }

  try {
    ensureVapid();
    const supabase = getServiceSupabase();

    // Verify sender and recipients are participants in the conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("buyer_id, seller_id, moderator_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      req.log.error({ convError, conversationId }, "Conversation not found or access error");
      res.status(403).json({ error: "Unauthorized: Conversation access denied" });
      return;
    }

    const participants = new Set([
      conversation.buyer_id,
      conversation.seller_id,
      conversation.moderator_id,
    ].filter(Boolean));

    const senderId = (req as any).user.id;
    if (!participants.has(senderId)) {
      req.log.warn({ senderId, conversationId }, "Sender not participant in conversation");
      res.status(403).json({ error: "Unauthorized: You are not a participant in this conversation" });
      return;
    }

    for (const rid of recipientUserIds) {
      if (!participants.has(rid)) {
        req.log.warn({ rid, conversationId }, "Recipient not participant in conversation");
        res.status(403).json({ error: "Unauthorized: One or more recipients are not in this conversation" });
        return;
      }
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", recipientUserIds);

    if (error) {
      req.log.error({ error }, "Failed to fetch push subscriptions");
      res.status(500).json({ error: "Failed to fetch subscriptions" });
      return;
    }

    if (!subs || subs.length === 0) {
      res.json({ sent: 0 });
      return;
    }

    const payload = JSON.stringify({
      title: title || "New message",
      body,
      conversationId,
      url: `/chat/${conversationId}`,
    });

    const results = await Promise.allSettled(
      (subs as any[]).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) req.log.warn({ sent, failed }, "Some pushes failed");

    res.json({ sent, failed });
  } catch (err: any) {
    req.log.error({ err }, "push/notify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
