---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# v2.2 LIVE Engagement Rollout Plan

Owner: product and platform lead.

Current go-live decision after the 2026-05-05 validation run: blocked until commit parity and the Cloudflare-backed WebSocket smoke pass. Local code and tests are green; deployed production still reports `COMMIT_SHA=dev`, and no preview/staging target is configured in `wrangler.toml`.

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
