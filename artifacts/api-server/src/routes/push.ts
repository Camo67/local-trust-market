import { Router, type Request, type Response, type NextFunction } from "express";
import webpush from "web-push";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const router = Router();

interface AuthRequest extends Request {
  user?: User;
}

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Auth middleware error");
    res.status(401).json({ error: "Unauthorized" });
  }
};

let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Supabase env vars not set");
  _supabase = createClient(url, key);
  return _supabase;
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

router.post("/push/subscribe", authMiddleware, async (req: AuthRequest, res) => {
  const { userId, subscription } = req.body as {
    userId: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  if (!userId || !subscription?.endpoint) {
    res.status(400).json({ error: "userId and subscription required" });
    return;
  }

  if (req.user?.id !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const supabase = getSupabase();
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

router.delete("/push/unsubscribe", authMiddleware, async (req: AuthRequest, res) => {
  const { userId, endpoint } = req.body as { userId: string; endpoint: string };
  if (!userId || !endpoint) {
    res.status(400).json({ error: "userId and endpoint required" });
    return;
  }

  if (req.user?.id !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);

    if (error) {
      req.log.error({ error }, "Failed to delete push subscription");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "push/unsubscribe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/push/notify", authMiddleware, async (req: AuthRequest, res) => {
  const { recipientUserIds, title, body, conversationId } = req.body as {
    recipientUserIds: string[];
    title: string;
    body: string;
    conversationId: string;
  };

  if (!recipientUserIds?.length || !body || !conversationId) {
    res.status(400).json({ error: "recipientUserIds, body and conversationId required" });
    return;
  }

  try {
    ensureVapid();
    const supabase = getSupabase();

    // Verify sender is participant in conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("buyer_id, seller_id, moderator_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const isParticipant =
      conv.buyer_id === req.user?.id ||
      conv.seller_id === req.user?.id ||
      conv.moderator_id === req.user?.id;

    if (!isParticipant) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", recipientUserIds);

    if (error) {
      req.log.error({ error }, "Failed to fetch push subscriptions");
      res.status(500).json({ error: "Internal server error" });
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
