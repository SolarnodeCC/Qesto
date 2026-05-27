# ADR-0034: PWA offline shell + push rich actions

**Status:** Accepted (S71)  
**Date:** 2026-05-27

## Context

S41 delivered PWA shell v2 and push scaffold. S71 hardens push payloads, inbox deep links, and subscription persistence.

## Decision

1. Store push subscriptions in `USERS_KV` under `push:sub:{userId}` (90-day TTL).
2. Expose `GET/PUT/DELETE /api/pwa/push/subscription` and `GET /api/pwa/push/status`.
3. Service worker uses `tag`, `renotify`, and optional `actions` for session notifications.
4. VAPID keys via `VAPID_PUBLIC_KEY` (var) and `VAPID_PRIVATE_KEY` (secret); push send deferred until keys configured.

## Consequences

- Rich actions work client-side without server send in dev.
- Full push delivery SLA remains `WEBHOOK-DELIVERY-SLA-01` territory (S78) for partner webhooks; mobile push SLA in S73 (`PUSH-SLA-01`).
