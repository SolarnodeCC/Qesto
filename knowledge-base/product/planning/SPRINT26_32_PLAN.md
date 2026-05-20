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

# Sprint 26-32 Plan — v2.2 Live Engagement to Enterprise Release

_Created: 2026-05-04._
_Planning basis: Sprint 24 accepted the versioned Durable Object protocol; Sprint 25 added dark-launched LIVE energizer transport._

## Arc Goal

Sprints 26-32 take Qesto from hidden LIVE energizer transport to a controlled v2.2 engagement release, then harden enterprise/admin reporting and rollout quality. The sequence is intentionally gated: each gameplay sprint depends on protocol compatibility, staging WebSocket validation, and observability evidence from the prior sprint.

## Guardrails

- Existing voting, presenter controls, reconnect, pause/resume, and close flows remain the regression baseline.
- No breaking WebSocket protocol change without a new ADR and compatibility test matrix.
- Energizer rollout stays feature-flagged until staging and a11y/i18n checks are green.
- Analytics and exports must use aggregate labels and IDs, not raw prompts, participant text, emails, tokens, SAML material, or Stripe secrets.
- Advanced tournament mechanics wait until the simple LIVE energizer loop proves stable.

## Sprint Summary

| Sprint | Goal | Committed Scope | Gate |
|---|---|---|---|
| Sprint 26 | Staging validation + presenter controls for LIVE energizers | WebSocket staging smoke, Launchpad/presenter activation controls, disabled/flag-off UX, protocol audit events | No participant gameplay until activation is stable in staging |
| Sprint 27 | First playable LIVE energizer: Quick Finger | Participant quick-answer UI, server-side answer validation, score event broadcast, reconnect-safe state | No second energizer until vote flow and Quick Finger can coexist |
| Sprint 28 | Team Quiz LIVE loop | Multi-question quiz progression, presenter advance, participant answer locking, score summary | No leaderboard/badges until quiz scoring evidence is reliable |
| Sprint 29 | Leaderboard + badges foundation | Aggregated score model, live leaderboard broadcast, badge-award hooks, admin metric labels | No advanced competitions until scoring and badge idempotency are proven |
| Sprint 30 | Admin engagement analytics maturity | Engagement funnels, exportable energizer metrics, entitlement/ops correlation, privacy review | No release-candidate posture until dashboards answer support questions |
| Sprint 31 | Enterprise rollout hardening | Role/permission rollout to session and energizer actions, audit UX polish, staging migration check | No broad rollout until permission-deny and audit paths are clear |
| Sprint 32 | v2.2 release candidate | Full regression pass, docs closeout, feature-flag rollout plan, release notes, rollback plan | Release only after full-stack smoke and staging WebSocket validation |

## Sprint 26 — LIVE Energizer Activation Readiness

**Goal:** Prove the Sprint 25 dark-launched protocol works in a production-like path and expose activation controls without enabling public gameplay.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-STAGE-01: Staging WebSocket smoke for v1 protocol + energizer activation | 5 | GAM/QA | Staging validates legacy v1, explicit v1, unsupported version, reconnect, and activation flag-off/on cases. |
| GAM-CTRL-01: Presenter/Launchpad activation controls | 5 | GAM/UX | Presenter can see eligible energizers and trigger activation only when `LIVE_ENERGIZERS_ENABLED=true`. |
| GAM-CTRL-02: Disabled and permission-denied UX | 3 | GAM/I18N | Flag-off, non-presenter, and invalid-state messages are localized and accessible. |
| OBS-GAM-01: Protocol audit/metrics events | 3 | OPS | Activation attempts, flag denials, and protocol denials emit sanitized event labels. |

**Deferrals:** Participant gameplay, score tracking, badges.

## Sprint 27 — Quick Finger LIVE Gameplay

**Goal:** Ship the first playable LIVE energizer behind the feature flag while preserving the normal voting loop.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-QF-01: Participant quick-answer UI | 8 | GAM/UX | Participants receive active Quick Finger state and can submit one answer with keyboard/touch. |
| GAM-QF-02: Server-side answer validation + result broadcast | 8 | GAM/REALTIME | DO validates answer IDs, records first correct answer timing, and broadcasts sanitized score deltas. |
| GAM-QF-03: Reconnect-safe energizer state | 5 | GAM/REALTIME | Reconnecting clients receive active question, locked answer state, and current score summary. |
| GAM-QF-QA-01: Compatibility regression tests | 5 | QA | Existing vote/presenter tests stay green alongside Quick Finger activation and answer tests. |

**Deferrals:** Team Quiz, leaderboard persistence, badges.

## Sprint 28 — Team Quiz LIVE Loop

**Goal:** Add a multi-question LIVE energizer loop with controlled presenter progression.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-TQ-01: Team Quiz state machine | 8 | GAM/REALTIME | DO tracks quiz index, answer windows, locked submissions, and completion state. |
| GAM-TQ-02: Presenter quiz controls | 5 | GAM/UX | Presenter can advance quiz questions and close the energizer without closing the session. |
| GAM-TQ-03: Participant answer flow | 5 | GAM/UX | Participants see current quiz question, submit once, and receive clear locked/late states. |
| GAM-TQ-QA-01: Multi-question reconnect tests | 5 | QA | Reconnect at start/middle/end of quiz restores the correct snapshot. |

**Deferrals:** Tournament mechanics and advanced competitions.

## Sprint 29 — Leaderboard + Badge Foundation

**Goal:** Convert simple energizer outcomes into reusable scoring and recognition primitives.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-SCORE-01: Aggregated score model | 8 | GAM/DATA | Per-session energizer scores are idempotent and queryable without storing participant text. |
| GAM-LB-01: Live leaderboard broadcast | 5 | GAM/REALTIME | Leaderboard updates are versioned, bounded, and do not leak participant PII. |
| GAM-BADGE-01: Badge-award hooks | 5 | GAM | First-answer, speedster, perfect-trivia, and engagement badges award once per eligible event. |
| GAM-QA-02: Score/badge idempotency tests | 5 | QA | Duplicate messages/reconnects cannot double-award score or badges. |

**Deferrals:** Battle royale, bracket tournaments, referral mechanics.

## Sprint 30 — Admin Engagement Analytics + Resilience P0

**Window:** 2026-05-27 to 2026-06-10
**Status:** In progress (branch `sprint/sprint-30`; core implementation delivered 2026-05-20)
**Goal:** Make engagement and realtime health visible to admins AND eliminate GDPR-risk PII leaks. No v2.2 RC posture until resilience P0 items are merged.

| Item | Size | Epic | Acceptance Signal | Status |
|---|---:|---|---|---|
| ADMIN-ENGAGE-01: Energizer engagement funnel | 5 | ENT/OPS | Admin analytics shows activation, participation, completion, and dropout counts. | ✅ Shipped S29 |
| ADMIN-ENGAGE-02: Exportable engagement metrics | 5 | ENT/OPS | CSV export includes session-level energizer metrics using sanitized labels. | ✅ Shipped S29 |
| ADMIN-OPS-02: Realtime health correlation | 5 | OPS | Admin can compare energizer activity with WebSocket capacity, reconnect, and error signals. | ✅ Delivered |
| PRIVACY-GAM-01: Engagement analytics privacy review | 3 | SECURITY | 21 privacy tests confirm no PII in energizer AE events or export payloads. | ✅ Delivered |
| RES-PII-01: PII sanitization — safeLogContext() + CI gate | 8 | SEC | CI blocks raw `console.error(err)` outside `lib/log.ts`; 9 denylist patterns redact emails, JWTs, Stripe keys, SAML, AI prompts. ADR-0009 compliance. | ✅ Delivered |
| RES-D1-01: Plan + admin middleware D1 safe fallback | 3 | OPS | D1 transient failure → 403 deny (not 500) in admin middleware. | ✅ Delivered |
| OBS-VOTE-01: ws.vote_submitted Analytics Engine event | 5 | OPS | SessionRoom emits ws.vote_submitted with sessionId, teamId, plan, latency_ms after every vote. | ✅ Delivered |

**Already complete (pre-Sprint 30):** RES-TIMEOUT-01 (25s timeout in ai-insights.ts), RES-ERR-01 (sanitizeError in app.ts), RES-RETRY-01 (runInsightsAI retry)
**Deferrals to Sprint 31:** Circuit breakers (CB-01, CB-02), integration provider library (INT-PROVIDER-01).

## Sprint 31 — Enterprise Hardening + Circuit Breakers + Integration Foundation

**Window:** 2026-06-10 to 2026-06-24
**Goal:** Lock the enterprise surface, arm the resilience layer, build the integration highway. LIVE energizers stay behind flag. No broad rollout until permission-deny + audit paths are clear.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| AUTHZ-GAM-01: Permission gate for energizer activation | 5 | ENT/AUTH | Custom roles can allow/deny energizer activation separately from session close/launch. |
| AUDIT-GAM-01: Audit UX polish for realtime actions | 5 | ENT/OPS | Audit viewer clearly distinguishes activation, answer-window changes, completion, and denials. |
| DEPLOY-GAM-01: Staging migration/flag checklist | 3 | OPS | Staging checklist covers D1/KV compatibility, flag state, rollback, and WebSocket smoke. |
| QA-ENT-02: Enterprise permission regression bundle | 5 | QA | Owner/admin/member/custom-role allow/deny paths cover session + energizer actions. |
| CB-01: Circuit breaker — Stripe + Resend (ADR-0007) | 8 | OPS | CLOSED/OPEN/HALF_OPEN state machine for both; KV-backed; 5 failures/60s → OPEN; 5s timeouts. |
| CB-02: Circuit breaker — Workers AI + JWKS (ADR-0007) | 5 | OPS | Workers AI 10s/3 failures; JWKS 5s/3 failures; graceful degrade (free plan on JWKS OPEN). |
| INT-PROVIDER-01: Integration provider library (ADR-0008) | 8 | INT | Typed provider interface; OAuth2Client, EncryptedTokenStore, IntegrationHttpClient, webhook-verify. |
| ANON-DEPTH-01: Zero-knowledge mode session config + trust badge | 5 | UX | Session config shows anonymity level selector; trust badge visible to participants; i18n validated. |

**Total committed: 44 pts**
**Deferrals:** Specific integration providers (Slack in Sprint 32), compliance evidence (Sprint 33).

## Sprint 32 — v2.2 Release Candidate + Slack Integration + Rich Export ✓ SHIPPED

**Window:** 2026-06-24 to 2026-07-08 (executed 2026-05-20)
**Goal:** Quality gate everything, ship v2.2, deliver the #1 commercial request (Slack). Slack is additive — no v2.2 rollback risk.

| Item | Size | Epic | Status | Acceptance Signal |
|---|---:|---|---|---|
| RC-REGRESSION-01: Full regression pass | 8 | QA | ✓ | 797 tests green, 0 typecheck errors |
| RC-DOCS-01: Spec and runbook closeout | 5 | DOCS/OPS | ✓ | V2_2_AUDIT_OUTCOMES, V2_2_ROLLOUT_PLAN updated |
| RC-ROLLOUT-01: Feature-flag rollout plan | 3 | OPS | ✓ | Cohorts, metrics, rollback trigger in V2_2_ROLLOUT_PLAN |
| RC-OBS-01: Release health dashboard checklist | 3 | OPS | ✓ | RELEASE_HEALTH_DASHBOARD.md with AQL queries |
| SLACK-01: Slack session results push notification (ADR-0008) | 8 | INT | ✓ | SlackProvider + OAuth routes + session close hook |
| EXPORT-RICH-01-A: Structured JSON + enhanced CSV with metadata | 8 | ENT | ✓ | `/export.json` + `/export.csv`, team-only |
| PERF-PROOF-01: Cloudflare latency benchmark data capture | 3 | OPS | ✓ | LATENCY_BENCHMARKS.md with AQL p50/p95/p99 queries |

**Total committed: 38 pts — all shipped**
**Stretch:** NOTION-01, EXPORT-PDF-01-A deferred to Sprint 33.
**v2.2 Release Gate:** All RC local gates green. Remaining: staging WebSocket smoke + SLACK-01 staging smoke.

## Cross-Sprint Verification

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test`
- `npm run test:a11y`
- `npm run build`
- Staging WebSocket smoke for every sprint that touches `SessionRoom`

## Out Of Scope For Sprints 26-32

- Battle royale and bracket tournament public rollout.
- Mobile app work.
- External AI provider integration.
- Broad redesign of dashboard or marketing pages.
- Billing/pricing changes unrelated to energizer entitlement evidence.
