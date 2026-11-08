const CACHE = "laundry-static-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("laundry-static-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
// Never cache machine status or API responses. Offline pages must not imply availability.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  }
});
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* show a useful fallback */ }
  event.waitUntil(self.registration.showNotification(data.title || "Laundry update", {
    body: data.body || "Open Laundry Room to check your machine.",
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    tag: data.tag || "laundry-update", renotify: false,
    data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = candidate.origin === self.location.origin ? candidate.href : self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
        await client.navigate(url); return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
