import { Router } from "express";
import webpush from "web-push";
import { getSupabase, getSupabaseAdmin } from "../lib/supabase";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

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
  const { userId, subscription } = req.body as {
    userId: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  // Authorization check: User can only subscribe for themselves
  // @ts-ignore
  if (userId !== req.user.id) {
    res.status(403).json({ error: "Unauthorized: You can only subscribe for yourself" });
    return;
  }

  if (!userId || !subscription?.endpoint) {
    res.status(400).json({ error: "userId and subscription required" });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
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
      res.status(500).json({ error: "Failed to save subscription" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "push/subscribe error");
    res.status(500).json({ error: err.message });
  }
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { userId, endpoint } = req.body as { userId: string; endpoint: string };

  // Authorization check: User can only unsubscribe for themselves
  // @ts-ignore
  if (userId !== req.user.id) {
    res.status(403).json({ error: "Unauthorized: You can only unsubscribe for yourself" });
    return;
  }

  if (!userId || !endpoint) {
    res.status(400).json({ error: "userId and endpoint required" });
    return;
  }
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/push/notify", async (req, res) => {
  const { recipientUserIds, title, body, conversationId } = req.body as {
    recipientUserIds: string[];
    title: string;
    body: string;
    conversationId: string;
  };

  if (!recipientUserIds?.length || !body) {
    res.status(400).json({ error: "recipientUserIds and body required" });
    return;
  }

  try {
    ensureVapid();
    const supabase = getSupabaseAdmin();

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
    res.status(500).json({ error: err.message });
  }
});

export default router;
