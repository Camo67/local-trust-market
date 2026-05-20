import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export const usePushNotifications = () => {
  const { user, session } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!supported) { setPermission("unsupported"); return; }
    setPermission(Notification.permission as PushPermission);
  }, [supported]);

  useEffect(() => {
    if (!supported || !user) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [supported, user]);

  const subscribe = useCallback(async () => {
    if (!supported || !user || !session) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supported, user, session]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !user || !session) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.id, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supported, user, session]);

  return { supported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
};

export const sendPushNotification = async (opts: {
  recipientUserIds: string[];
  title: string;
  body: string;
  conversationId: string;
}, session?: { access_token: string }) => {
  const API_BASE = (import.meta.env.BASE_URL as string)?.replace(/\/$/, "");
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    await fetch(`${API_BASE}/api/push/notify`, {
      method: "POST",
      headers,
      body: JSON.stringify(opts),
    });
  } catch {
    // Non-fatal — push is best-effort
  }
};
