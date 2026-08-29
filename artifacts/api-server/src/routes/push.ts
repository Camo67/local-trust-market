import { Router, type Response } from "express";
import webpush from "web-push";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth";
import { getUserSupabase, getServiceSupabase } from "../lib/supabase";

const router = Router();

let _vapidSet = false;
function ensureVapid() {
  if (_vapidSet) return;
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  const contact =
    process.env["VAPID_CONTACT"] || "mailto:admin@buddiesworldwide.app";
  if (!pub || !priv) throw new Error("VAPID keys not set");
  webpush.setVapidDetails(contact, pub, priv);
  _vapidSet = true;
}

router.post("/push/subscribe", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { userId, subscription } = req.body as {
    userId: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  if (!userId || !subscription?.endpoint) {
    res.status(400).json({ error: "userId and subscription required" });
    return;
  }

  // Users can only subscribe for themselves.
  if (userId !== req.user?.id) {
    res.status(403).json({ error: "Unauthorized: You can only subscribe for yourself" });
    return;
  }

  try {
    // Forward the caller's own token — RLS ("Users can insert own push
    // subscriptions") enforces the ownership check at the DB layer too.
    const supabase = getUserSupabase(req.accessToken!);
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "user_id,endpoint" },
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

router.delete("/push/unsubscribe", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { userId, endpoint } = req.body as { userId: string; endpoint: string };

  if (!userId || !endpoint) {
    res.status(400).json({ error: "userId and endpoint required" });
    return;
  }

  if (userId !== req.user?.id) {
    res.status(403).json({ error: "Unauthorized: You can only unsubscribe for yourself" });
    return;
  }

  try {
    const supabase = getUserSupabase(req.accessToken!);
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

router.post("/push/notify", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    const currentUserId = req.user!.id;

    // The caller's own token is enough to read the conversation they're
    // asking to notify about — RLS only lets participants see it at all.
    const userSupabase = getUserSupabase(req.accessToken!);
    const { data: conversation, error: convError } = await userSupabase
      .from("conversations")
      .select("buyer_id, seller_id, moderator_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      req.log.error({ convError, conversationId }, "Conversation not found or access denied");
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { buyer_id, seller_id, moderator_id } = conversation;
    if (currentUserId !== buyer_id && currentUserId !== seller_id && currentUserId !== moderator_id) {
      res.status(403).json({ error: "Unauthorized: You are not a participant in this conversation" });
      return;
    }

    // Only notify recipients who are actually participants in this conversation.
    const participants = [buyer_id, seller_id, moderator_id].filter(Boolean);
    const validRecipientUserIds = recipientUserIds.filter((id) => participants.includes(id));

    if (validRecipientUserIds.length === 0) {
      res.json({ sent: 0, failed: 0 });
      return;
    }

    // Reading another user's push subscription requires bypassing RLS
    // ("Users can view own push subscriptions" only permits the owner) —
    // this is exactly what the service-role client is for.
    const serviceSupabase = getServiceSupabase();
    const { data: subs, error } = await serviceSupabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", validRecipientUserIds);

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
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
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
