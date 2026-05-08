self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New message", body: event.data.text() };
  }

  const options = {
    body: payload.body || "You have a new message",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.conversationId || "buddies-msg",
    renotify: true,
    data: { url: payload.url || "/inbox" },
    vibrate: [200, 100, 200],
    actions: [{ action: "open", title: "Open chat" }],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Buddies Worldwide", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/inbox";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
