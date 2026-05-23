---
id: ADR-0015
status: accepted
created: 2026-05-22
---

# ADR-0015: Mobile Client Contract (PWA)

## Decision

1. **PWA shell** — `manifest.webmanifest` + minimal `sw.js` caches app shell only; API and WebSocket always hit network.
2. **Offline join** — `localStorage` caches last successful `by-code` lookup per code (MOBILE-01).
3. **Touch** — minimum 44×44px targets via `@media (hover: none)` in global CSS (MOBILE-02/03).
4. **Presenter** — live controls remain in Present route; safe-area padding on mobile chrome.

## Consequences

- No native app store binaries in v2.4.
- Service worker updates require cache bump (`qesto-pwa-v1`).
