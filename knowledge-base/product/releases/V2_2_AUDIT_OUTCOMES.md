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

# v2.2 Audit Outcomes — LIVE Engagement Release Candidate

_Reviewed against current code: 2026-05-05 (UTC)._

## Status

The Sprint 30-32 audit findings are closed in the local release-candidate codebase. Staging still needs a Cloudflare-backed WebSocket smoke because the local Pages Functions setup cannot fully connect to the external `SESSION_ROOM` Durable Object binding.

## Scope Reviewed

- Sprint 30 admin engagement analytics and export privacy.
- Sprint 31 enterprise realtime permissions and audit labels.
- Sprint 32 release-candidate regression gates.
- Current code in `functions/api/SessionRoom.ts`, `functions/api/routes/sessions.ts`, `functions/api/routes/admin.ts`, `functions/api/lib/authz.ts`, `functions/api/lib/audit.ts`, `src/components/AuditLogViewer.tsx`, `src/components/admin/AdminAnalyticsTab.tsx`, and `src/pages/TeamSettings.tsx`.

## Findings

| ID | Audit Outcome | Status | Code Evidence | Test Evidence |
|----|---------------|--------|---------------|---------------|
| `AUDIT-ENGAGE-01` | Admin engagement analytics missed LIVE energizer events because production Quick Finger and Team Quiz events were only emitted to Analytics Engine. | Closed | `SessionRoom` now writes sanitized `ws.energizer_*` rows to D1 `audit_events`; `/api/admin/analytics` counts those rows plus optional metrics buckets. | `tests/integration/admin-dashboard.test.ts`, `tests/unit/session-room.test.ts` |
| `AUDIT-AUTHZ-01` | Custom-role energizer deny was not wired into real WebSocket upgrades. | Closed | `/api/sessions/:id/ws` resolves effective team permissions and forwards them internally as `x-qesto-permissions`; `SessionRoom` denies presenter activation when an attached permission list omits `energizer:activate`. | `tests/integration/session-lifecycle.test.ts`, `tests/unit/session-room.test.ts` |
| `AUDIT-EVIDENCE-01` | Audit filter labels were not backed by realtime D1 writes. | Closed | `AuditAction` and the admin audit filter include `ws.energizer_activated`, `ws.energizer_activation_denied`, `ws.energizer_answered`, `ws.energizer_advanced`, and `ws.energizer_completed`; `SessionRoom` writes the corresponding sanitized rows. | `tests/unit/session-room.test.ts`, `tests/functional/ui/sprint30-32-contract.test.ts` |
| `AUDIT-COVERAGE-01` | Sprint 30-32 tests were mostly static source checks. | Improved and closed for local release-candidate criteria | Static source contracts remain as guardrails, but executable integration/unit tests now exercise admin analytics, WebSocket permission forwarding, Durable Object allow/deny behavior, and audit sanitization. | `tests/integration/admin-dashboard.test.ts`, `tests/integration/session-lifecycle.test.ts`, `tests/unit/session-room.test.ts`, `tests/functional/ui/sprint30-32-contract.test.ts` |

## Coverage Ruling

- Functional coverage is now executable for the critical release paths: admin engagement counts, WebSocket permission propagation, Durable Object energizer allow/deny, and realtime audit evidence.
- Security coverage confirms `energizer:activate` is separate from session lifecycle controls, default members do not automatically receive activation rights, and custom roles can grant or omit the permission.
- Privacy coverage confirms LIVE audit rows and admin exports use aggregate or opaque identifiers only; prompt text, free-text answers, emails, bearer tokens, SAML material, Stripe identifiers, and magic links must not be written into engagement analytics.
- Code quality coverage is improved by D1 mock support for the admin analytics/audit queries used by the integration tests.

## Residual Release Caveats

- Run a Cloudflare-backed staging smoke with `LIVE_ENERGIZERS_ENABLED=true` and `false` before cohort rollout.
- Confirm `/api/admin/analytics` engagement counts move after a real Quick Finger and Team Quiz activation/completion.
- Confirm `/api/admin/audit` returns the expected `ws.energizer_*` rows and that exported/admin payloads remain sanitized.
- Build currently passes with the known generated CSS `@import` ordering warnings.

## Go-Live Validation Run — 2026-05-05

Local release gates passed:

- Targeted audited-path tests: 4 files, 53 tests passed.
- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test` — 62 files, 526 tests passed.
- `npm run test:a11y` — 3 files, 38 tests passed.
- `npm run build` — passed with the known generated CSS `@import` ordering warnings.
- `npm run deploy:api:dry-run` — passed and confirmed Worker bindings plus commit metadata injection.

Go-live remains blocked on deployment/staging evidence:

- `wrangler.toml` currently has no preview/staging environment block, so the required staging WebSocket smoke cannot be executed from this checkout.
- `https://qesto.cc/api/version` returns HTML instead of the JSON version payload, so public-host commit parity cannot be verified there.
- `https://qesto-api.oostelaar.workers.dev/api/version` is reachable, but reports remote commit `dev` while local validation ran against `719710689f41`.
- Production should not be promoted until the audited commit is deployed from a clean worktree, `/api/version` reports that commit, and the real WebSocket smoke confirms analytics/audit/permission behavior.

## Local Regression Evidence

Completed on 2026-05-05 (Sprint 30–31 baseline):

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test` — 526 tests passed
- `npm run test:a11y`
- `npm run build`

## Sprint 32 RC Regression Pass (RC-REGRESSION-01)

Completed on 2026-05-20:

- `npm run typecheck` — 0 errors
- `npm test` — **797 tests passed** (80 test files; +271 tests from Sprint 30–32 additions)
- Circuit breaker unit tests: 18/18 green (CB-01/CB-02, ADR-0007)
- Enterprise permission regression bundle: 41/41 green (QA-ENT-02)
- Privacy gamification tests: 21/21 green (PRIVACY-GAM-01)
- Build: clean (no blocking errors)

### Sprint 32 Additions (RC scope)

| Item | Status | Evidence |
|---|---|---|
| CB-01/CB-02 Circuit breakers | Shipped | 18 unit tests; wired into billing.ts, email.ts, ai-insights.ts, oauth.ts |
| RES-PII-01 PII sanitization | Shipped | 21 privacy tests; `safeLogContext()` in lib/log.ts |
| RES-TIMEOUT-01 Workers AI 25s timeout | Shipped | ai-insights.ts, circuit-breaker.ts config |
| AUTHZ-GAM-01 Energizer permission gate | Shipped (pre-existing) | QA-ENT-02 tests |
| ANON-DEPTH-01 Zero-knowledge mode | Shipped | Full type chain + JoinPage trust badge + i18n |
| AUDIT-GAM-01 Audit UX badges | Shipped | AuditLogViewer color-coded badges |
| SLACK-01 Slack integration | Shipped (Sprint 32) | SlackProvider + OAuth routes |
| EXPORT-RICH-01-A Rich export | Shipped (Sprint 32) | /export.json + /export.csv endpoints |
| PERF-PROOF-01 Latency baseline | Shipped (Sprint 32) | AQL queries in LATENCY_BENCHMARKS.md |

### v2.2 Go-Live Gate

All local gates pass. Remaining: Cloudflare staging WebSocket smoke with `LIVE_ENERGIZERS_ENABLED=true`.
See `knowledge-base/operations/STAGING_MIGRATION_CHECKLIST.md` for the full checklist.
