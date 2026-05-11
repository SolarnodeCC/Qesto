---
id: PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - planning
  - sprints
  - implementation
relates_to:
  - BACKLOG_MASTER
  - ROADMAP_FULL
---

# Sprint 30 Implementation Spec — Admin Engagement Analytics

Status: shipped in the v2.2 release-candidate branch.

## Scope

Sprint 30 makes LIVE energizer engagement visible to admins without exposing participant content. The admin analytics payload now includes an `engagement` block with activation, participant, completion, dropout, leaderboard, badge, WebSocket error, and reconnect counters. The dashboard renders these as dense operational KPIs and includes them in the CSV export.

## Data Contract

`GET /api/admin/analytics` returns aggregate labels only:

- `engagement.energizer_activations`
- `engagement.energizer_participants`
- `engagement.energizer_completions`
- `engagement.energizer_dropouts`
- `engagement.leaderboard_participants`
- `engagement.badges_awarded`
- `engagement.ws_error_rate`
- `engagement.reconnect_rate`
- `badge_breakdown[]`

The endpoint is defensive: if gamification tables, audit tables, or live metrics buckets are absent in a local or staging environment, the response returns zeros rather than failing the admin page.

LIVE Quick Finger and Team Quiz now write sanitized `ws.energizer_*` audit rows from the Durable Object, so the engagement funnel is backed by the realtime path rather than only by REST energizer tables or best-effort metrics buckets.

Audit outcome `AUDIT-ENGAGE-01` is closed by this D1 audit ingestion plus the executable admin analytics integration test. Staging must still confirm counts move through a Cloudflare-backed Durable Object smoke.

## Privacy Boundary

Analytics and CSV export must contain no raw prompts, participant free text, email addresses, bearer tokens, SAML material, Stripe identifiers, or magic links. Participant counts use distinct opaque voter/user IDs, and badge rows use badge type labels only.

## Verification

- Contract coverage: `tests/functional/ui/sprint30-32-contract.test.ts`
- Executable analytics coverage: `tests/integration/admin-dashboard.test.ts`
- Realtime audit coverage: `tests/unit/session-room.test.ts`
- Type surface: `functions/api/routes/admin.ts`, `src/hooks/useAdminAnalytics.ts`
- UI/export surface: `src/components/admin/AdminAnalyticsTab.tsx`
