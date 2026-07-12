self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Jahon Xabarlari", body: event.data ? event.data.text() : "Yangi muhim xabar" };
  }

  const options = {
    body: payload.body || "Yangi muhim xabar",
    icon: payload.icon || "/logo.png",
    badge: payload.badge || "/favicon-96x96.png",
    image: payload.image,
    tag: payload.tag || "jx-news",
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: payload.data || { url: "/" },
    actions: Array.isArray(payload.actions) ? payload.actions : []
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Jahon Xabarlari", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(event.notification.data?.url || "/", self.location.origin);
  const targetUrl = requested.origin === self.location.origin ? requested.href : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => client.url === targetUrl);
      if (existing && "focus" in existing) return existing.focus();
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
