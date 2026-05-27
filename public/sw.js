/* MOBILE-PWA-02 — app shell cache + offline join fallback */
const CACHE = 'qesto-pwa-v3'
const SHELL = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  // Only intercept same-origin assets — cross-origin (Google Fonts, analytics,
  // Cloudflare beacons, etc.) must bypass the SW so they hit their real
  // host and CSP `font-src` / `style-src` rules apply correctly.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).catch(() => caches.match('/') ?? caches.match('/index.html'))
    }),
  )
})

/* Push scaffold — no keys required until VAPID is configured server-side */
self.addEventListener('push', (event) => {
  let data = { title: 'Qesto', body: 'Session update', url: '/', tag: 'qesto-session' }
  try {
    data = { ...data, ...(event.data?.json() ?? {}) }
  } catch {
    /* non-JSON payload */
  }
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag ?? 'qesto-session',
    renotify: true,
    data: {
      url: data.url ?? '/',
      sessionId: data.sessionId ?? null,
      inbox: data.inbox === true,
    },
    actions: data.sessionId
      ? [
          { action: 'open', title: 'Open session' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [],
  }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Qesto', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(url)) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
