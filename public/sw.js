/* AUTO-GENERATED from src/sw.ts — do not edit by hand.
   Regenerate: npm run build:sw */
"use strict";
(() => {
  // src/sw.ts
  var CACHE = "qesto-pwa-v3";
  var SHELL = ["/", "/index.html", "/icon-192.png", "/icon-512.png", "/favicon.svg", "/manifest.webmanifest"];
  self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then(
        (keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
    );
  });
  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).catch(async () => {
          const shell = await caches.match("/") ?? await caches.match("/index.html");
          return shell ?? new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
      })
    );
  });
  self.addEventListener("push", (event) => {
    let data = { title: "Qesto", body: "Session update", url: "/", tag: "qesto-session" };
    try {
      data = { ...data, ...event.data?.json() ?? {} };
    } catch {
    }
    const options = {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "qesto-session",
      renotify: true,
      data: {
        url: data.url ?? "/",
        sessionId: data.sessionId ?? null,
        inbox: data.inbox === true
      },
      actions: data.sessionId ? [
        { action: "open", title: "Open session" },
        { action: "dismiss", title: "Dismiss" }
      ] : []
    };
    event.waitUntil(self.registration.showNotification(data.title ?? "Qesto", options));
  });
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "dismiss") return;
    const url = event.notification.data?.url ?? "/";
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ("focus" in client && client.url.includes(url)) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
    );
  });
})();
