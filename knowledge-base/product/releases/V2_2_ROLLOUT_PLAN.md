---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 2.0
created: 2026-04-01
updated: 2026-05-20
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# v2.2 LIVE Engagement Rollout Plan

**RC-ROLLOUT-01 — Sprint 32**
Owner: product and platform lead.

## v2.2 Release Gate Status (2026-05-20)

All local quality gates: **PASSED**

| Gate | Status |
|---|---|
| `npm test` — 797 tests | ✓ Green |
| `npm run typecheck` — 0 errors | ✓ Green |
| Circuit breakers (CB-01/CB-02) | ✓ Shipped + 18 unit tests |
| Enterprise permissions (QA-ENT-02) | ✓ Shipped + 41 integration tests |
| PII sanitization (RES-PII-01) | ✓ Shipped + 21 privacy tests |
| Zero-knowledge mode (ANON-DEPTH-01) | ✓ Shipped + i18n all 5 locales |
| Slack integration (SLACK-01) | ✓ Shipped — OAuth2 + session close hook |
| Rich export (EXPORT-RICH-01-A) | ✓ Shipped — JSON + CSV, team-only |
| Vote latency baseline (PERF-PROOF-01) | ✓ Shipped — AQL queries in LATENCY_BENCHMARKS.md |

**Remaining blocker:** Cloudflare-backed staging WebSocket smoke with `LIVE_ENERGIZERS_ENABLED=true`.
See `STAGING_MIGRATION_CHECKLIST.md` for the full smoke procedure.

---

Current go-live decision after the 2026-05-05 validation run: blocked until commit parity and the Cloudflare-backed WebSocket smoke pass. Sprint 32 RC local gates are now all green.

## Cohorts

1. Internal workspace with `LIVE_ENERGIZERS_ENABLED=false` to confirm no baseline regressions.
2. Internal workspace with `LIVE_ENERGIZERS_ENABLED=true` for Quick Finger and Team Quiz smoke.
3. One friendly team workspace with admin analytics monitored daily.
4. Gradual team-plan rollout after 48 hours without release-blocking incidents.

## Metrics Watched

- WebSocket error rate
- Reconnect rate
- Capacity denials
- Energizer activations
- Energizer participants
- Energizer completions
- Dropout count
- Badge awards
- Support tickets tagged realtime or energizer

## Audit Closure Checks Before Cohort 3

- Activate and complete one Quick Finger and one Team Quiz through the real WebSocket path.
- Confirm `/api/admin/analytics` increments `engagement.energizer_activations`, `engagement.energizer_participants`, and `engagement.energizer_completions`.
- Confirm `/api/admin/audit?action=ws.energizer_activated`, `/api/admin/audit?action=ws.energizer_answered`, and `/api/admin/audit?action=ws.energizer_completed` return rows for the smoke window.
- Confirm a team member without `energizer:activate` receives an activation denial, and a custom role with `energizer:activate` can activate.
- Confirm audit/admin exports contain no prompt text, answer values, emails, bearer tokens, SAML material, Stripe identifiers, or magic links.

## Rollback Trigger

Disable `LIVE_ENERGIZERS_ENABLED` immediately if WebSocket error rate exceeds 5% for two consecutive monitoring windows, reconnect rate doubles against baseline, activation denial spikes without matching role changes, or support reports participant data exposure.

## Rollback Steps

1. Set `LIVE_ENERGIZERS_ENABLED=false`.
2. Confirm presenter activation controls show the disabled state.
3. Keep standard session voting enabled.
4. Review admin analytics and audit labels for the incident window.
5. Patch behind the flag and rerun the Sprint 32 regression gate.
