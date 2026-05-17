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

# Sprint 32 Implementation Spec — v2.2 Release Candidate

Status: release candidate prepared.

## Release Candidate Contents

Sprint 32 freezes the v2.2 LIVE engagement arc:

- Sprint 26-27 Quick Finger activation and gameplay
- Sprint 28 Team Quiz progression
- Sprint 29 live leaderboard and badges
- Sprint 30 admin engagement analytics and export-safe metrics
- Sprint 31 enterprise permission and audit hardening

## Regression Gate

The release candidate is ready only after these local gates are run and any exceptions are documented:

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test` — 526 tests passed
- `npm run test:a11y`
- `npm run build`

Full-stack staging still requires Cloudflare auth, local D1 schema setup, and WebSocket smoke testing with `LIVE_ENERGIZERS_ENABLED` both disabled and enabled.

## Audit Closeout Result

The Sprint 30-32 audit findings for admin engagement analytics, realtime custom-role denial, D1 audit evidence, and executable coverage are closed locally. Details live in `docs/V2_2_AUDIT_OUTCOMES.md`. The remaining release caveat is Cloudflare-backed staging smoke for the real Durable Object WebSocket path.

## Health Dashboard Checklist

Admins and operators must be able to answer:

- How many sessions are active?
- Are WebSocket errors or reconnects rising?
- How many energizers were activated?
- How many participants engaged?
- How many energizers completed?
- Were badge and leaderboard signals emitted?

## Accepted Local Exceptions

Cloudflare-authenticated checks can fail locally when `CLOUDFLARE_API_TOKEN` is unavailable. Durable Object realtime smoke tests are constrained locally because `SESSION_ROOM` points at the external `qesto` worker.

## Local Regression Result

Completed on 2026-05-05:

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test` — 526 tests passed
- `npm run test:a11y`
- `npm run build`

Build passes with the pre-existing generated CSS `@import` ordering warnings.
