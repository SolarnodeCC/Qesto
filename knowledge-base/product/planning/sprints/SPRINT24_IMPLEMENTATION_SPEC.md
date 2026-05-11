# Sprint 24 Implementation Spec — v2.2 Realtime Governance + Admin Hardening

_Started: 2026-05-04._

## Goal

Sprint 24 starts v2.2 depth without destabilising LIVE voting. The sprint accepts the Durable Object protocol/versioning ADR, matures admin analytics/export, closes the deferred custom-role management UI, and reconciles sprint/backlog planning status after Sprints 21-23 were built ahead of their calendar windows.

## Committed Scope

| Item | Status | Acceptance Signal |
|---|---|---|
| DO-PROTOCOL-ADR-01 | In progress | `ADR-0005` accepted; current wire protocol has backwards-compatible `v: 1` support and unsupported-version rejection. |
| AUTHZ-ROLE-UI-01 | In progress | Team settings can list, create, edit, delete, assign, and unassign custom roles using Sprint 21 APIs. |
| ADMIN-ANALYTICS-01 | In progress | Admin analytics has a client-side CSV export for sanitized aggregate reporting. |
| BACKLOG-HYGIENE-01 | In progress | `ROADMAP_FULL.md`, `SPRINT_PLAN.md`, and `BACKLOG.md` clearly mark Sprint 24 as active and Sprints 21-23 as built/verification-dependent. |
| S21-S23-VERIFY-01 | In progress | Focused checks cover realtime protocol compatibility plus recently built template/Launchpad/admin surfaces. |

## Explicit Deferrals

- Full LIVE energizer rollout.
- Advanced energizers, tournaments, leaderboard depth, referral mechanics.
- Broad session-route permission rollout.
- Billing permission UI.
- New external AI providers.

## Verification

Focused gates:

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npx vitest run tests/unit/session-room.test.ts tests/unit/live-session-reducer.test.ts tests/functional/ui/sprint24-contract.test.ts`

Full deploy gate remains:

- `npm test`
- `npm run test:a11y`
- `npm run check:baseline`
- `npm run build`
