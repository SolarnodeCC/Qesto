/* MOBILE-01 — minimal service worker (cache shell for offline join page) */
const CACHE = 'qesto-pwa-v1'
const SHELL = ['/', '/index.html', '/icon-192.png', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('/'))),
  )
})
