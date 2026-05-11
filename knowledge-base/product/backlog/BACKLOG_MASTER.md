# Qesto — Product Backlog (Epic-Based)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-05-05 (UTC)_
_Sprint 17 Completion Sync: 2026-04-22_
_Sprint 18 Active (2026-04-29 to 2026-05-13) — see SPRINT_PLAN.md §Sprint 18_
_Sprint 19 Implementation Complete: 2026-04-30 (implemented ahead of planned 2026-05-13 to 2026-05-27 window; see SPRINT_PLAN.md §Sprint 19 for closeout evidence)_
_Sprint 20 Built (2026-05-04) — readiness, entitlement enforcement, observability, Sprint 19 KPI measurement, and AUTHZ-ADR-01 review package; see SPRINT_PLAN.md §Sprint 20_
_Website Design Wave added: 2026-04-19 — see §12_
_**Sprint 20 scope expansion**: 2026-05-01 — Sprint 19 shipped early; AUTHZ-ADR-01 pulled in as committed (was stretch); Sprint A verification bundle added; total committed scope raised from 34 to 45 pts. See SPRINT_PLAN.md §Sprint 20 for updated table._
_**Planning context**: Repository ships v2.x; backlog items are regression contracts + hardening work. Agent review completed 2026-05-01; Sprint 19 implementation is complete; Sprint 20 starts the next five-calendar-sprint plan._

## Overview

This backlog holds **durable user stories** with acceptance criteria (Given / When / Then), grouped under six epics. Items are prioritised with WSJF-style weighting and mapped to a **reference five-sprint sequence** in [`SPRINT_PLAN.md`](./planning/SPRINT_PLAN.md) for dependency ordering and onboarding.

**Shipped baseline:** The repository already ships **v2.x** capabilities summarised in [`ROADMAP_FULL.md`](./roadmap/ROADMAP_FULL.md) and [`SPEC.md`](../../specifications/product/SPEC_PRODUCT.md). Many stories describe behaviour that is **already implemented**; they remain as **regression contracts**, refinement targets, and narrative for new contributors.

**Planning truth:** Use [`ROADMAP_FULL.md`](./roadmap/ROADMAP_FULL.md) for release-level status. Use this file for **incremental committed work** (including §12 Website Design Wave) and story-level acceptance criteria. Use [`ARCHIVED_SPRINTS.md`](../releases/ARCHIVED_SPRINTS.md) for historical sprint summaries. For technical build truth, start at [`spec/INDEX.md`](./spec/INDEX.md) (code wins until specs are updated deliberately).

**Sprint field on stories:** The **Sprint: 1–5** metadata on each story refers to the **reference arc** in [`SPRINT_PLAN.md`](./planning/SPRINT_PLAN.md), not to the calendar sprint counter in [`ARCHIVED_SPRINTS.md`](../releases/ARCHIVED_SPRINTS.md). Treat those numbers as **ordering and pedagogy**, not “we are still in Sprint 1.”

---

## Sprint 19 Closeout + Sprint 20 Planning

**Status**: Implementation completed on 2026-04-30, ahead of the planned calendar window. KPI measurement remains post-ship. See [`SPRINT_PLAN.md` §Sprint 19](./planning/SPRINT_PLAN.md) for full detail and closeout evidence.

**Committed items** (43 pts): ✅ WIZ-AI-01, ✅ WIZ-AI-02, ✅ WIZ-OVERVIEW-01, ✅ LAUNCHPAD-01, ✅ AI-VIS-03, ✅ AI-VIS-02, ✅ LAYOUT-DENSITY-01

**Conditional stretch** (8 pts, if S18 ships `insights_daily` precompute): ✅ DX-INSIGHTS-02

**Deferred from Sprint 19** (architect + PO agreement):
- **RBAC depth (custom roles)**: Cross-cuts auth middleware; needs dedicated 2-sprint epic + permissions ADR. Defer to S20–S21. Note: ENT-02 (base 5-role model) remains on Sprint 3 reference arc.
- **GAM-01 (Energizer in LIVE session)**: Requires DO state machine + `ClientMessage`/`ServerMessage` protocol extension + versioning ADR not yet written. Defer to S21+.

**Sprint 18/19 prerequisite closeout evidence** (implemented by 2026-04-30; keep as traceability checklist):

**Decision Date**: 2026-04-23 | **Decision Maker**: Product Owner + Architect | **Status**: ✅ Delivered 2026-04-30

**Scope Addition**: Required for Sprint 19 to launch on 2026-04-30; formally added to Sprint 18 scope per WSJF prioritization and capacity buffer analysis (BACKLOG.md §OBS-01 scope change decision tree).

**Items**:

1. **D1 Migrations**: 
   - `sessions.ai_generated` (INTEGER, 0/1 flag) — provenance for AIBadge
   - `sessions.ai_consent_at` (INTEGER, epoch ms) — GDPR audit trail for AI generation
   - `sessions.ai_grounding_hash` (TEXT) — deterministic hash of generation context for refine round-trips
   - `questions.kind` widened to include `'wordcloud'` (if not present)
   - `insights_daily` table (session_id, day, themes_json, confidence, n_votes) — conditional for DX-INSIGHTS-02

2. **DRAFT-API Routes**: 
   - `POST /sessions/:id/ai/generate` (streaming SSE, Workers AI) — chunked QuestionsSkeletons, closes with full JSON
   - `POST /sessions/:id/ai/refine` (idempotent on `grounding_hash`) — reuses prior grounding, avoids re-billing
   - `GET /sessions/:id/preflight` — invariant checks; single source of truth for DO entry-gate validation
   - `GET /sessions/:id/insights/themes?window=30d` — `insights_daily` slice (conditional)

3. **KV Schema Updates** (no migration, contract freeze):
   - `SESSIONS_KV` DRAFT shape: add `aiMeta: { consentAt, grounding, model, promptVersion }`
   - `USERS_KV` add `prefs.density: 'compact'|'comfortable'|'spacious'`

4. **ADRs**:
   - ADR-0002: AI streaming transport (SSE vs chunked JSON) — delivered commit 10ee51b
   - ADR-0003: Pre-flight contract (worker vs. DO invariant checks) — delivered commit 10ee51b

**Delivery Confirmation**: All items landed in commit 2452e67 (2026-04-30) and subsequent bug-fix commits. See [`SPRINT_PLAN.md` §Sprint 19](./planning/SPRINT_PLAN.md) for detailed prerequisites and implementation evidence.

### Sprint 20 Planning (2026-05-27 to 2026-06-10)

**Status**: Built on 2026-05-04; **scope expanded 2026-05-01** — Sprint 19 shipped early, creating extra velocity. AUTHZ-ADR-01 pulled forward from stretch to committed. Sprint A design/i18n verification bundle added. Sprint 20 remains a readiness/enforcement sprint, not a broad feature-expansion sprint.

**Committed items** (45 pts): ✅ ENTITLEMENTS-01, ✅ ENTITLEMENTS-02, ✅ OBS-02, ✅ QA-DOCDRIFT-01, ✅ DESIGN-GATE-01, ✅ S19-MEASURE-01, 🔎 AUTHZ-ADR-01 review package, 🔎 Sprint A verification gate

| Item | Pts | Status |
|---|---:|---|
| ENTITLEMENTS-01: Pricing claim → backend gate matrix | 8 | ✅ Done 2026-05-01 |
| ENTITLEMENTS-02: Contract tests for paid capabilities | 8 | ✅ Built 2026-05-04 |
| OBS-02: Sprint 19 operational evidence | 5 | ✅ Done 2026-05-01 |
| QA-DOCDRIFT-01: Align docs with actual scripts | 3 | ✅ Done 2026-05-01 |
| DESIGN-GATE-01: Stabilize token drift locally + CI | 5 | ✅ Done 2026-05-01 |
| S19-MEASURE-01: AI wizard + Launchpad KPI baseline | 5 | ✅ Completed with durable events 2026-05-04 |
| **AUTHZ-ADR-01**: Custom RBAC authorization ADR *(pulled in from stretch)* | 3 | Proposed for review in `docs/adr/ADR-0004-custom-rbac-authorization.md` |
| **Sprint A verification bundle** (LAYOUT-GRID-01, LAYOUT-A11Y-01, DESIGN-TOK-01, DX-INSIGHTS-01, I18N-BUG-01, I18N-BUG-02) | 8 | Verification gate active |

**Sprint goal**: Harden v2.1 by proving plan entitlements are enforced server-side, capturing Sprint 19 KPI and operational evidence, aligning local/CI quality gates, and getting AUTHZ-ADR-01 into review so Sprint 21 opens with implementation.

**Stretch (start only after all core items green)**:
- **DESIGN-POLISH-01** (3 pts) — CTA hover state; all tech deps satisfied; start after Sprint A verification closes.
- **DESIGN-POLISH-02** (3 pts) — logo bump; conditional on brand sign-off by 2026-05-14, else defer to Sprint 23.
- **LAUNCHPAD-02** (8 pts) — inline editor + reorder; gate: S19-MEASURE-01 shows no launch reliability regression. **Do not start before S19-MEASURE-01 is complete.**

**Explicitly deferred**: RBAC depth/custom roles implementation until AUTHZ-ADR-01 is *accepted* (not just drafted); GAM-01 / LIVE energizers until a Durable Object protocol/versioning ADR exists; TPL-CATALOG-* until Sprint 22.
Microsoft OAuth login is also explicitly removed from sprint scope; the login page must not present a Microsoft sign-in option unless re-approved in a future planning cycle.

See [`SPRINT_PLAN.md` §Sprint 20](./planning/SPRINT_PLAN.md) for detailed acceptance criteria, dependencies, KPIs, and Definition of Done.

---

## Next Five Calendar Sprints (Sprint 20 to Sprint 24)

**Planning status**: Agent-assisted planning refresh completed 2026-05-01. Sprint 20 is the committed readiness sprint; Sprints 21–24 are sequenced backlog intent and should be revalidated at each sprint planning ceremony.

| Sprint | Window | Product goal | Backlog posture |
|---|---|---|---|
| **Sprint 20** | 2026-05-27 to 2026-06-10 | v2.1 readiness lock: entitlement tests, Sprint 19 measurement, operational evidence, quality-gate trust, and AUTHZ-ADR-01 in review | Built package: ENTITLEMENTS-02, OBS-02, S19-MEASURE-01 durable events, **AUTHZ-ADR-01** proposed, Sprint A verification gate. Stretch remains deferred. |
| **Sprint 21** | 2026-06-10 to 2026-06-24 | Enterprise authorization foundation + compliance UX | Built backend slice: accepted ADR, D1 custom-role model, role assignment APIs, `team:manage_members` / `team:manage_auth` enforcement, audit evidence. Frontend role-management screen deferred. |
| **Sprint 22** | 2026-06-24 to 2026-07-08 | Template catalogue + session creation polish | Built package: customer/Qesto template groups, 3+ Qesto templates per topic, overview confirmation, wizard seeding, functional tests. |
| **Sprint 23** | 2026-07-08 to 2026-07-22 | Launchpad + design polish | Built package: LAUNCHPAD-02 verified, CTA motion/logo polish verified, and AI narrative copy corrected/i18n-keyed. |
| **Sprint 24** | Started 2026-05-04; original 2026-07-22 to 2026-08-05 | v2.2 realtime governance + admin hardening | Accepted Durable Object protocol/versioning ADR, built custom role-management UI, added admin analytics export, started backlog hygiene, and kept LIVE energizer foundation as stretch behind protocol tests. |

### Active Backlog Additions From Planning Refresh

| ID | Item | Pri | Target | Acceptance signal |
|---|---|---|---|---|
| AUTHZ-ADR-01 | Authorization ADR for custom roles, scoped permissions, route ownership, and audit semantics | P0 | **Sprint 20/21** | ✅ Accepted in `docs/adr/ADR-0004-custom-rbac-authorization.md` |
| AUTHZ-RBAC-01 | Custom role permission matrix + server-side enforcement plan | P0 | Sprint 21 | ✅ Backend foundation built; permission helpers + contract tests added |
| AUTHZ-RBAC-02 | Admin role-management UX for custom roles and delegated permissions | P1 | Sprint 21/22 | Backend APIs built; frontend screen deferred |
| TPL-CATALOG-01 | Customer vs Qesto template catalogue groups | P0 | Sprint 22 | ✅ Built 2026-05-04; Dashboard Templates separates tenant-created and curated Qesto templates |
| TPL-CATALOG-02 | Template overview confirmation flow | P0 | Sprint 22 | ✅ Built 2026-05-04; Template card opens title/description/preview screen; session creation starts only after "Use template" confirmation |
| TPL-CATALOG-03 | Qesto starter-template coverage and functional tests | P0 | Sprint 22 | ✅ Built 2026-05-04; Minimum 3 templates per required topic; `tests/functional/ui/template-catalogue.test.ts` covers UI contract |
| DO-PROTOCOL-ADR-01 | Durable Object protocol/versioning ADR for LIVE session message extensions | P0 | Sprint 24 | ✅ Accepted in `docs/adr/ADR-0005-do-protocol-versioning.md`; v1 envelope support added |
| AUTHZ-ROLE-UI-01 | Team role-management UI for custom roles and delegated permissions | P0 | Sprint 24 | Team Settings can list, create, edit, delete, assign, and unassign custom roles |
| ADMIN-ANALYTICS-01 | Admin analytics reporting/export maturity | P1 | Sprint 24 | Admin can inspect/export key engagement, entitlement, and operational health metrics without raw log spelunking |
| GAM-LIVE-01 | LIVE energizer WebSocket foundation | P0 | Sprint 25 | Presenter-only activation frame, feature-flagged DO state, server broadcast, and reconnect snapshot all work without changing existing voting semantics |
| GAM-STAGE-01 | Staging WebSocket validation for LIVE energizer protocol | P0 | Sprint 26 | Shipped: presenter activation, disabled/permission guards, and reconnect-safe active state |
| GAM-QF-01 | Quick Finger LIVE gameplay | P0 | Sprint 27 | Shipped: participants answer a Quick Finger energizer, server validates answers, and score state broadcasts safely |
| GAM-TQ-01 | Team Quiz LIVE loop | P0 | Sprint 28 | Shipped: multi-question quiz state, presenter progression, participant locking, score summaries, and reconnect snapshots work |
| GAM-SCORE-01 | Leaderboard and badge foundation | P1 | Sprint 29 | Shipped: aggregated scores, leaderboard broadcasts, and badge hooks are idempotent and PII-safe |
| ADMIN-ENGAGE-01 | Admin engagement analytics maturity | P1 | Sprint 30 | Admin can inspect/export energizer activation, participation, completion, and realtime health metrics |
| AUTHZ-GAM-01 | Enterprise permission gate for energizer activation | P1 | Sprint 31 | Custom roles can allow/deny energizer activation with audit evidence |
| RC-REGRESSION-01 | v2.2 release candidate regression and rollout plan | P0 | Sprint 32 | Full quality gates, specs, release notes, rollout plan, and rollback plan are ready |
| MKT-PROMISE-01 | Launch-safe marketing promise audit and copy correction | P0 | Sprint 32 | Public pricing, privacy, terms, feature, and solution pages only promise implemented launch capabilities |
| EXPORT-RICH-01 | Rich export formats for commercial plans | P1 | Future commercial-readiness sprint | JSON, signed PDF, DOCX, and Notion-ready exports have routes, UI entry points, tests, and plan gates before public copy promotes them |
| INT-WEBHOOK-01 | Slack, Notion, Workday, BambooHR, and generic webhook integrations | P1 | Future commercial-readiness sprint | Configurable outbound webhooks exist with auth, retries, audit logs, failure states, and docs before integration copy moves out of roadmap status |
| ENT-COMPLIANCE-01 | Enterprise compliance evidence packet | P0 | Future enterprise-readiness sprint | SOC 2, pen-test summary, DPA/SCC packet, sub-processor list, and security review materials exist before legal/procurement pages claim them |
| ENT-RESIDENCY-01 | Residency guarantees and customer-managed keys | P1 | Future enterprise-readiness sprint | Environment routing, contractual residency language, key-management design, and operational tests exist before residency/CMK marketing claims go live |
| AI-RECAP-PROV-01 | AI recap evidence links and edit provenance | P1 | Future AI-readiness sprint | AI-generated summaries expose evidence links, host edit history, PDF/export provenance, and participant disclosure tests before recap provenance is promoted |
| PERF-PROOF-01 | Production latency benchmark evidence | P1 | Future reliability sprint | Cloudflare-backed benchmark data exists for live voting and energizers before numeric latency claims appear on marketing pages |

**Dependencies and gates**:
- ENTITLEMENTS-02 must be green before Sprint 21 expands role enforcement.
- OBS-02 must land before S19-MEASURE-01 can produce credible KPI baseline.
- AUTHZ-ADR-01 blocks RBAC depth/custom roles implementation.
- DO-PROTOCOL-ADR-01 blocks GAM-01 in LIVE sessions.
- Sprint 26 activation readiness now unblocks Sprint 27 participant gameplay.
- Leaderboard and badge primitives now unblock admin engagement analytics.
- Token/i18n/a11y gates must stay green before Sprint 23 design polish expands affected surfaces.

---

## Epic Catalog

Summary of epic posture versus the **v2.x shipped baseline** (see [`ROADMAP_FULL.md`](./roadmap/ROADMAP_FULL.md)). This table is **not** a greenfield completion percentage.

| Epic | Status | Focus | Notes |
|---|---|---|---|
| **EPIC-CORE** | Shipped (baseline) | Session lifecycle, realtime voting, presenter controls | Core v2.0 platform live; stories remain AC / hardening references |
| **EPIC-BILLING** | Shipped (baseline) | Stripe, plan middleware, subscriptions | Follow-on items may still use BILL-* IDs |
| **EPIC-AUTH** | Shipped (baseline) | Magic link, SAML SSO, JWT | Advanced token / edge cases may remain in backlog |
| **EPIC-ENT** | In progress | Audit, RBAC depth, admin, multi-tenant | Enterprise / compliance completion per roadmap |
| **EPIC-I18N** | In progress | Locales, key validation, translation QA | Bundles shipped; CI and QA hardening ongoing |
| **EPIC-GAM** | In progress | Energizers, leaderboard, badges, referrals | Base gamification live; depth and analytics queued |

---

## EPIC-CORE: Core Session Platform

**Goal**: Build the realtime session engine with presenter + participant flows.

### CORE-01: Session Creation & DRAFT State

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a team owner, I can create a new session in DRAFT state with a title, description, and question list, so I can prepare before going live.

**Acceptance Criteria**:
- Given a team owner on the create session page, when they fill in title/description/questions and click save, then session is created in DRAFT state with a unique session ID
- Given a session in DRAFT, when the presenter clicks "Preview", then they can see a mock participant view without state being LIVE
- Given a DRAFT session, when a non-owner tries to join, then they receive a "Not yet started" error (403)
- Code: D1 schema `sessions` table with `state`, `title`, `description`, owner foreign key
- Tests: Unit test for session creation, integration test for DRAFT state enforcement

**Dependencies**: None

---

### CORE-02: Session Lifecycle Transitions

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a presenter, I can transition a session from DRAFT → LIVE → CLOSED → ARCHIVED, so participants can join at the right time and sessions can be managed post-completion.

**Acceptance Criteria**:
- Given a DRAFT session, when the presenter clicks "Start", then state becomes LIVE and WebSocket DO is created
- Given a LIVE session, when the presenter clicks "Close", then state becomes CLOSED and WebSocket rejects new joins
- Given a CLOSED session, when archived, then state becomes ARCHIVED and session is excluded from active lists (but still queryable)
- Transition validations: DRAFT→LIVE (must have ≥1 question), LIVE→CLOSED (any time), CLOSED→ARCHIVED (24h delay)
- Code: D1 `sessions.state` enum, DO lifecycle hooks
- Tests: State machine tests covering all transitions + invalid transitions

**Dependencies**: CORE-01

---

### CORE-03: Question Types & Configuration

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a session designer, I can configure multiple question types (poll, ranking, consent vote, open question), so the session can gather diverse feedback.

**Acceptance Criteria**:
- Given a session in DRAFT, when adding a question, then I can select type: poll, ranking, consent_vote, open_question
- Given a poll question, when configured, then I can set: question text, answer options (2-5), allow_other boolean
- Given a ranking question, when configured, then I can set: question text, items to rank (2-10)
- Given a consent vote, when configured, then options are fixed (Agree/Neutral/Disagree) 
- Given an open question, when configured, then I can set: question text, char_limit (0=unlimited)
- Code: D1 `questions` table with `question_type` and `config` JSON
- Tests: Unit tests for each question type schema validation

**Dependencies**: CORE-01

---

### CORE-04: WebSocket Live Session Room (Durable Object)

**Size**: 13 pts | **Sprint**: 2 | **Priority**: P0 | **Status**: ✅ Shipped (Phase 3)

**Story**: As the platform, I need a Durable Object SessionRoom that maintains realtime state and broadcasts updates to all connected participants.

**Acceptance Criteria**:
- Given a LIVE session, when participants connect via WebSocket, then DO maintains a list of active connections
- Given connected participants, when one submits a vote, then DO broadcasts `VoteReceived` to all participants (except voter) within 100ms
- Given the presenter, when they advance to the next question, then all participants see the question update via broadcast within 100ms
- Given a participant disconnect, when they reconnect within 5 minutes, then their vote history is preserved
- Given 100+ simultaneous connections, when load testing, then p99 latency < 500ms
- Code: `functions/api/ws/[[session_id]].ts` Durable Object + WebSocket handler
- Tests: Integration tests for concurrent connections, message delivery, reconnection

**Dependencies**: CORE-01, CORE-02

---

### CORE-05: Realtime Vote Submission

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0 | **Status**: ✅ Shipped (Phase 3)

**Story**: As a participant, I can submit my vote in realtime and see it recorded, so I can participate in the session.

**Acceptance Criteria**:
- Given a LIVE session with active question, when I submit a vote, then my vote is recorded in D1 within 500ms
- Given a poll question, when I select an option, then my vote is stored with my participant_id and question_id
- Given a ranking question, when I order items, then my ranking is stored as an ordered array
- Given a consent vote, when I select Agree/Neutral/Disagree, then my vote is recorded
- Given an open question, when I type text, then my response is stored (no character limit unless configured)
- Idempotency: if I resubmit the same vote within 5 seconds, then duplicate entries are not created
- Code: Vote submission route + idempotency ledger in KV
- Tests: Vote insertion tests, duplicate prevention tests, latency tests

**Dependencies**: CORE-04

---

### CORE-06: Presenter Controls

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a presenter, I can advance questions, show/hide results, and control session flow in realtime.

**Acceptance Criteria**:
- Given a LIVE session, when I click "Next Question", then current question closes and next question becomes active
- Given an active question with votes, when I click "Show Results", then a results dashboard appears for all participants (pie chart for poll, bar for ranking)
- Given results shown, when I click "Hide Results", then charts disappear but votes remain recorded
- Given a LIVE session, when I pause, then participants cannot submit new votes but can see pending results
- Given results hidden, when I click "Resume", then participants can vote again
- Broadcast: All control actions trigger WebSocket broadcasts to all participants within 100ms
- Code: Presenter controls route + DO broadcast messages
- Tests: Control flow tests, broadcast delivery tests, concurrent control tests

**Dependencies**: CORE-04

---

### CORE-07: Participant Join Flow

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0 | **Status**: ✅ Shipped (Phase 3)

**Story**: As a participant, I can join a LIVE session via a shareable link and see the current question.

**Acceptance Criteria**:
- Given a session URL, when I click it, then I land on a join page with session title + presenter name
- Given the join page, when I enter my name (or select anonymous), then I click "Join" and am added to the session
- Given a LIVE session, when I join, then I immediately see the current active question
- Given the session is DRAFT or CLOSED, when I try to join, then I see "Session not available" (403)
- Duplicate names: given two participants with the same name, then each gets a unique participant_id (names can be duplicate)
- Code: Join route, participant record creation, WebSocket upgrade
- Tests: Join permission tests, current question fetch tests, anonymous vs named tests

**Dependencies**: CORE-02, CORE-04

---

### CORE-08: Session Results Export

**Size**: 5 pts | **Sprint**: 4 | **Priority**: P1 | **Status**: ✅ Shipped (Phase 4)

**Story**: As a session owner, I can export all votes and responses as CSV after a session closes, so I can analyze results offline.

**Acceptance Criteria**:
- Given a CLOSED or ARCHIVED session, when I click "Export Results", then a CSV download starts
- CSV format: rows = votes, columns = [question_text, answer_text, participant_name, timestamp, question_type]
- For open questions: response text is included in full
- For ranking: ranking order is preserved (e.g., "1st, 2nd, 3rd")
- File naming: `[session_id]_results_[date].csv`
- Code: Export route + CSV generation utility
- Tests: CSV format validation, completeness tests (all votes included)

**Dependencies**: CORE-01, CORE-05

---

## EPIC-BILLING: Billing + Plan Foundations

**Goal**: Integrate Stripe and implement plan-based feature gating.

### BILL-01: Plan Definition & Feature Flags

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As an admin, I can define subscription plans with feature limits (session cap, participant cap, premium features), so the product can be tiered.

**Acceptance Criteria**:
- Given the system, when configured, then 3 plans exist: Free, Pro, Enterprise with defined feature sets
- Free plan: 5 sessions/month, 50 participants/session, no export, no SAML
- Pro plan: 50 sessions/month, 500 participants/session, export, no SAML
- Enterprise: unlimited sessions, unlimited participants, export, SAML, custom branding
- Code: D1 `plans` table, `plan_features` mapping, `PLANS` constant in wrangler.toml
- Tests: Plan definition tests, feature flag retrieval tests

**Dependencies**: None

---

### BILL-02: Stripe Checkout Flow

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a Free plan user, I can upgrade to Pro via Stripe checkout, so I can access paid features.

**Acceptance Criteria**:
- Given a Free user on the billing page, when they click "Upgrade to Pro", then they are redirected to Stripe Checkout
- Checkout session includes: plan name, price, team_id (for reference)
- Given successful payment, when Stripe redirects back, then session_id is stored and processed by webhook
- Given payment failure, when user returns, then they see "Payment declined" with retry button
- Stripe session expires after 24 hours
- Code: `/api/billing/checkout` route, Stripe session creation, success/cancel redirect handlers
- Tests: Checkout flow mock tests, redirect tests, error handling tests

**Dependencies**: BILL-01

---

### BILL-03: Stripe Webhook Idempotent Handling

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As the system, I must idempotently process Stripe webhooks (charge.succeeded, charge.failed, customer.subscription.updated) so duplicate events don't cause double-billing.

**Acceptance Criteria**:
- Given a webhook event, when received, then event_id is checked against KV `STRIPE_EVENTS`
- If event_id exists in KV with success status, then webhook is silently ignored (idempotent)
- If event_id is new, then event is processed and event_id + status stored in KV (TTL 30 days)
- On charge.succeeded: team subscription is upgraded, plan is updated in D1
- On charge.failed: failure is logged, team is notified via email, subscription remains unchanged
- On customer.subscription.updated: plan is updated in D1, feature flags are refreshed
- Code: `/api/webhooks/stripe` route, idempotency ledger in KV
- Tests: Duplicate event handling tests, state transition tests, retry tests

**Dependencies**: BILL-02

---

### BILL-04: Plan Middleware (Feature Gating)

**Size**: 5 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As the API, I must enforce plan-based feature limits, so Free users can't access premium routes.

**Acceptance Criteria**:
- Given a route marked as `@premium`, when a Free user accesses it, then they get 403 with message "Upgrade to Pro"
- Given a Free user, when they try to create session #6 in current month, then 403 "Limit reached"
- Given a Free user, when they add participant #51 to a session, then that participant can't join (403)
- Plan check middleware in Hono before route handler
- Code: Plan middleware in `functions/api/middleware/` + route decorators
- Tests: Feature gate tests for each plan level, limit enforcement tests

**Dependencies**: BILL-01

---

### BILL-05: Subscription Management (Upgrade/Downgrade/Cancel)

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a Pro user, I can manage my subscription (upgrade to Enterprise, downgrade to Free, cancel), so I control my billing.

**Acceptance Criteria**:
- Given a Pro user on billing dashboard, when I click "Change Plan", then I see upgrade (to Enterprise) and downgrade (to Free) options
- On upgrade: Stripe subscription is updated, prorated charge applied, plan is updated in D1
- On downgrade: Stripe subscription is updated, credit applied, plan downgrade takes effect next cycle
- On cancel: Stripe subscription is cancelled, team is moved to Free plan
- All actions trigger email confirmations
- Code: Plan change routes + Stripe subscription update calls
- Tests: Subscription update tests, proration tests, email notification tests

**Dependencies**: BILL-03

---

### BILL-06: Billing Portal & Invoice History

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can view my invoice history and access Stripe Billing Portal, so I manage payments and billing info.

**Acceptance Criteria**:
- Given a team with active Stripe customer_id, when I click "Billing Portal", then I am redirected to Stripe-hosted portal
- On return from portal, user is back on app billing page
- Given the invoices section, when I view it, then all invoices are listed with: date, amount, status, download link
- Invoices are fetched from Stripe API on demand
- Code: Billing portal route, invoice fetch route
- Tests: Portal redirect tests, invoice list tests

**Dependencies**: BILL-03

---

## EPIC-AUTH: Authentication

**Goal**: Implement magic link auth and SAML SSO.

### AUTH-01: Magic Link Email Send & Verify

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a new user, I can enter my email and receive a magic link to sign up without a password.

**Acceptance Criteria**:
- Given the login page, when I enter my email and click "Send Magic Link", then a confirmation message appears
- Email is sent via Resend with subject "Sign in to Qesto" containing a 24-hour-expiring link
- Given the magic link, when I click it, then I land on a set-name page, set my display name
- Given a set name, when I click "Confirm", then a JWT is issued, I'm logged in, and redirected to dashboard
- If link expires, when I click it, then "Link expired" message appears with option to resend
- Duplicate sends: if I send link twice in 5 minutes, second email includes same link (no spam)
- Code: Email send route, token generation/verification, JWT issuance
- Tests: Email delivery tests (Resend mock), token expiry tests, JWT tests

**Dependencies**: None

---

### AUTH-02: JWT Session Management

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As the API, I must manage JWT tokens so sessions are stateless and secure.

**Acceptance Criteria**:
- Given a logged-in user, when I make API calls, then JWT is in Authorization header or secure cookie
- JWT includes: user_id, email, team_ids, issued_at, expires_at (14 days)
- Given an expired JWT, when I use it, then API returns 401 "Unauthorized"
- Given a valid JWT, when decoded, then it's verified using `JWT_SECRET` from env
- Refresh flow: 1 hour before expiry, client can refresh token to get new one (same payload, new expiry)
- Code: JWT middleware, token generation/validation utilities
- Tests: JWT creation tests, expiry tests, refresh tests, invalid token tests

**Dependencies**: AUTH-01

---

### AUTH-03: SAML SSO Integration

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As an enterprise customer, I can use my corporate SAML IdP (Okta, Azure AD, etc.) to sign in, so users don't need separate credentials.

**Acceptance Criteria**:
- Given SAML is enabled for a team, when I click "Sign in with SAML", then I'm redirected to IdP login
- IdP authenticates me and returns SAML assertion to Assertion Consumer Service (ACS)
- ACS verifies signature using team's IdP certificate, extracts email + name
- Given valid SAML assertion, when verified, then user is logged in (JWT issued) or account is auto-created
- If SAML assertion is invalid or signature fails, then "Authentication failed" error appears
- Code: SAML SP metadata endpoint, ACS route, assertion validation
- Tests: SAML assertion validation tests, signature tests, auto-account-creation tests

**Dependencies**: AUTH-02

---

### AUTH-04: SAML Metadata Exchange & IdP Config

**Size**: 5 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a team admin, I can configure SAML by uploading IdP metadata or pasting IdP config URL, so team members can use SSO.

**Acceptance Criteria**:
- Given the team SAML settings, when I paste IdP metadata URL, then metadata is fetched and parsed
- From metadata, extract: IdP SSO URL, logout URL, x509 certificate
- Alternatively, when I upload metadata XML file, then same parsing happens
- Given valid metadata, when I click "Enable SAML", then SAML is activated for team
- Given SAML enabled, when I go to IdP console, then I can add Qesto as a SAML application
- Code: Metadata fetch + parse route, SAML config storage in D1
- Tests: Metadata parsing tests, certificate extraction tests, validation tests

**Dependencies**: AUTH-03

---

### AUTH-05: Auth Middleware (Protected Routes)

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As the API, I must protect all routes with auth middleware so unauthorized users can't access data.

**Acceptance Criteria**:
- Given all protected routes (anything except login, health, public docs), when accessed without JWT, then 401 returned
- Given a valid JWT, when route is accessed, then user context is available to handler (user_id, team_id)
- Given a JWT from different team, when accessing team-specific route, then 403 "Forbidden" returned
- Auth middleware extracts JWT from Authorization header or cookie, validates, attaches user context
- Code: Auth middleware in `functions/api/middleware/auth.ts`
- Tests: Missing JWT tests, valid JWT tests, cross-team tests, role-based tests

**Dependencies**: AUTH-02

---

### AUTH-06: Token Refresh & Revocation

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user, I can refresh my JWT before expiry and revoke tokens (logout), so sessions remain fresh and I can sign out.

**Acceptance Criteria**:
- Given a valid JWT, when I call `/api/auth/refresh`, then new JWT is issued with same user_id but new expiry
- Old JWT remains valid until expiry (grace period for in-flight requests)
- Given a logged-in user, when I click "Logout", then current JWT is revoked (added to D1 `revoked_tokens`)
- After revocation, using revoked token returns 401
- Revoked tokens are garbage-collected after expiry date passes
- Code: Refresh route, revocation route, revocation check in middleware
- Tests: Refresh tests, revocation tests, grace period tests

**Dependencies**: AUTH-02

---

## EPIC-ENT: Enterprise Operations

**Goal**: Implement audit logging, RBAC, admin dashboard, and multi-tenant safeguards.

### ENT-01: Team Management (Create, Invite, Roles)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a team owner, I can create teams, invite members with specific roles, and manage team membership.

**Acceptance Criteria**:
- Given a user, when I click "Create Team", then I enter team name, confirm, and become team owner
- Given a team, when I click "Invite Members", then I can enter email addresses and assign roles (Admin, Member, Presenter, Viewer)
- Invitations are sent via email with 7-day expiry link
- Given an invitation, when recipient clicks link, then they accept and join team with assigned role
- Given a team member, when owner clicks "Remove", then member is immediately removed
- Removing a member revokes their access (JWT invalidated)
- Code: Team CRUD routes, invitation routes, membership routes
- Tests: Team creation tests, invitation tests, role assignment tests, removal tests

**Dependencies**: AUTH-02

---

### ENT-02: Role Model (5 Roles with Permissions)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As the platform, I must implement granular role-based access control with 5 roles (Owner, Admin, Member, Presenter, Viewer), each with specific permissions.

**Acceptance Criteria**:
- **Owner**: Full access (team, users, sessions, billing, audit logs, SAML)
- **Admin**: Team + user management, sessions, audit logs (no billing, no SAML config)
- **Member**: Create/edit own sessions, view team sessions, manage participants
- **Presenter**: View assigned sessions, present live, view results (no editing)
- **Viewer**: View-only access to sessions and results
- Given a user with Presenter role, when they try to create a session, then 403 "Insufficient permissions"
- Permissions are checked in middleware before route handlers
- Code: Role enum in D1, permission matrix utility, role middleware
- Tests: Permission matrix tests, role enforcement tests for each route

**Dependencies**: ENT-01

---

### ENT-03: Audit Logging (All Mutations)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a compliance officer, I need comprehensive audit logs of all mutations (create, update, delete) so I can prove who changed what when.

**Acceptance Criteria**:
- Given any mutation route (session create, team invite, plan change, auth), when handler executes, then audit event is logged
- Audit entry includes: timestamp, user_id, action (CREATE/UPDATE/DELETE), resource_type, resource_id, changes (before/after if applicable)
- Given 1000 audit entries, when queried, then they are indexed on (timestamp, user_id, resource_type)
- Audit entries are immutable (no updates after creation)
- Admin can view audit logs filtered by date range, action, resource type
- Code: Audit log utility, D1 `audit_logs` table, audit log viewer route
- Tests: Audit logging tests for each mutation type, query performance tests

**Dependencies**: ENT-02

---

### ENT-04: Admin Metrics Dashboard

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As an admin, I can view a dashboard with key metrics (active sessions, total participants, feature usage, billing health), so I understand platform health.

**Acceptance Criteria**:
- Dashboard displays: today's active sessions, 30-day session count, total participants this month, top question types, plan distribution
- Metrics are updated every 5 minutes from D1 queries
- Admin can export metrics as CSV
- Dashboard includes: billing health (revenue, churn, plan mix), uptime (if monitoring is set up)
- Charts: line graph (sessions over time), pie (plan distribution), bar (feature usage)
- Code: Metrics aggregation service, dashboard route, Frontend dashboard component
- Tests: Metric calculation tests, dashboard data fetch tests

**Dependencies**: ENT-02, BILL-03

---

### ENT-05: Multi-Tenant Isolation Enforcement

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As the platform, I must ensure strict data isolation between teams so no team can see another's data.

**Acceptance Criteria**:
- Given a user in Team A, when they request Team B's data, then 403 "Forbidden" returned
- All queries include `WHERE team_id = ?` enforced by middleware
- Session join is isolated: given participant from Team B, when they try to join Team A session, then 403
- Reporting/exports are scoped to requesting team only
- Code: Tenant middleware checks team_id on every request, D1 query safeguards
- Tests: Cross-tenant access tests for all routes, data isolation tests

**Dependencies**: ENT-01, ENT-02

---

### ENT-06: Advanced Role Delegation

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can grant delegate permissions to admins, allowing them to perform specific actions on my behalf.

**Acceptance Criteria**:
- Given an admin, when owner grants "Manage Billing" delegation, then admin can upgrade/downgrade plans (but not see payments)
- Given delegated permissions, when admin uses them, then action is logged with delegated_by = owner_id
- Delegation can be time-limited (e.g., "valid until 2026-05-01") or permanent
- Owner can revoke delegations anytime
- Code: Delegation model in D1, delegation check in permission middleware
- Tests: Delegation grant tests, revocation tests, expiry tests, audit logging tests

**Dependencies**: ENT-02, ENT-03

---

## EPIC-I18N: Internationalization QA

**Goal**: Implement multi-language support with quality hardening.

### I18N-01: Locale Bundle Structure (EN/NL/ES/DE/FR)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As the platform, I need locale bundles for 5 languages (EN, NL, ES, DE, FR) organized by namespace, so content can be translated.

**Acceptance Criteria**:
- Structure: `src/i18n/locales/{lang}/{namespace}.json` (e.g., `en/common.json`, `nl/auth.json`)
- 8 namespaces: common, auth, session, billing, admin, errors, templates, gamification
- Each bundle is a flat key-value structure (no nested objects for performance)
- Keys follow pattern: `{domain}.{feature}.{element}` (e.g., `auth.login.email_label`)
- English (EN) is the source of truth; other languages are translations
- Code: i18n folder structure, locale loading utility
- Tests: Bundle structure validation, key coverage tests (all keys in EN exist in other langs)

**Dependencies**: None

---

### I18N-02: Language Detection & Selector

**Size**: 5 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a user, the app automatically detects my browser language and I can manually select a different language.

**Acceptance Criteria**:
- Given new user, when app loads, then browser language preference is detected from Accept-Language header
- If browser lang is supported (EN/NL/ES/DE/FR), then app loads in that language
- If not supported, fallback to EN
- Given logged-in user, when I click language selector, then I can choose from 5 languages
- Selection is saved to user preferences in D1 `users.preferred_lang`
- On next login, app loads in saved language
- Code: Language detection middleware, user preference storage, language selector UI component
- Tests: Language detection tests, preference persistence tests, fallback tests

**Dependencies**: I18N-01

---

### I18N-03: Key Extraction Pipeline & CI Validation

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As the CI system, I must validate that all hardcoded strings are translated and no keys are orphaned.

**Acceptance Criteria**:
- Given code with hardcoded strings, when PR is submitted, then CI runs key extraction (searches for `t("key")` patterns)
- Extracted keys are compared against locale bundles
- If key is missing from EN bundle, then CI fails with "Untranslated string: {key}"
- If key exists in EN but missing in other languages, then CI warns "Incomplete translation: {lang}"
- If a key exists in bundle but is never used in code, then CI warns "Orphaned translation: {key}"
- Code: Key extraction script (regex-based), CI check in workflow, fix recommendations
- Tests: Extraction accuracy tests, validation rule tests

**Dependencies**: I18N-01

---

### I18N-04: Translation Quality Hardening (Plurals, Interpolation)

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a translator, I need support for plurals and variable interpolation, so translations are natural and context-aware.

**Acceptance Criteria**:
- Plural support: key `common.participant_count` with forms: `{0: "No participants", 1: "1 participant", other: "{count} participants"}`
- Interpolation: `auth.welcome` = "Welcome, {name}!" with runtime substitution
- Given a translation with interpolation, when counted items change (1 → 2), then correct plural form is used
- All 5 languages support same interpolation/plural syntax for consistency
- Code: i18n utility with plural + interpolation support, translations structured for i18next or i18next-like
- Tests: Plural form tests, interpolation tests, edge cases (0, 1, many)

**Dependencies**: I18N-01, I18N-02

---

### I18N-05: RTL/LTR Layout Support

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user in an RTL language (if supported future), the UI should adapt layout, so content is readable in RTL context.

**Acceptance Criteria**:
- Given English (LTR) content, when layout is rendered, then flex/grid flows left-to-right
- If future RTL language is added, then `dir="rtl"` is set on HTML root
- CSS flexbox/grid automatically reflects with RTL
- Text alignment reverses (text-align: left → right for RTL)
- Code: CSS logical properties (margin-inline, text-align-inline), RTL detection
- Tests: RTL layout tests (future, when language added)

**Dependencies**: I18N-02

---

### I18N-06: Locale-Aware Date/Number Formatting

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user, dates and numbers are formatted according to my locale, so they are readable in my cultural context.

**Acceptance Criteria**:
- Given a date (e.g., "2026-04-19"), when displayed to EN user, then "April 19, 2026" format
- Same date to NL user: "19 april 2026", DE user: "19. April 2026"
- Given a number (e.g., 1234.56), when displayed to EN user, then "1,234.56"
- Same number to NL user: "1.234,56", DE user: "1.234,56"
- Code: Intl API usage (DateTimeFormat, NumberFormat) with locale parameter
- Tests: Format tests for each locale, edge case dates (leap years, etc.)

**Dependencies**: I18N-02

---

## EPIC-GAM: Gamification Expansion

**Goal**: Build engagement features (energizers, leaderboards, badges, referrals).

### GAM-01: Energizer Components (Speed Round, Trivia)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a session presenter, I can add energizer activities (speed round, trivia) to boost engagement, so participants stay active.

**Acceptance Criteria**:
- **Speed Round**: Rapid poll with 60-second timer, auto-advances to results at timeout
  - Config: question, 2-4 options, timer (30-120 seconds)
  - Behavior: timer bar visible to all, countdown audio cue at 10 seconds
- **Trivia**: Multiple choice with correct answer, scored based on speed of response
  - Config: question, 4 options (1 correct marked), point value
  - Behavior: instant feedback (✓/✗), points awarded (100 * (60 - seconds_taken) / 60)
- Both can be standalone questions or mini-games between regular questions
- Code: Speed round + trivia question types, timer state in DO, scoring logic
- Tests: Timer tests, auto-advance tests, scoring tests

**Dependencies**: CORE-03, CORE-04, CORE-05

---

### GAM-02: Live Leaderboard

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a participant, I can see a live leaderboard showing top scorers, so I'm motivated to engage.

**Acceptance Criteria**:
- Given a session with scored questions (trivia), when 2+ participants have answered, then leaderboard is visible
- Leaderboard shows: participant name/avatar, current score, rank
- Updates in realtime as participants score points
- Leaderboard is hidden until first correct answer (no pre-leaderboard empty display)
- Presenter can toggle leaderboard visibility on/off
- Top 10 are shown by default (scroll to see more)
- Code: Leaderboard calculation in DO, realtime broadcast, UI component
- Tests: Scoring tests, ranking tests, realtime update tests, toggle tests

**Dependencies**: GAM-01

---

### GAM-03: Badge System (8+ Badge Types)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a participant, I can earn badges for achieving milestones, so I feel recognized for engagement.

**Acceptance Criteria**:
- **Badge Types**: First Answer, Speedster (top 3 speed round), Perfect Trivia (100% correct), Engagement (10+ votes), Leaderboard (top 10), Weekly Streak, Consensus (picks majority choice)
- Badges awarded automatically when criteria met
- Participant can view earned badges on profile
- Badges display on leaderboard if presenter enables "Show Badges"
- No duplicate badges in single session; earned once per session max
- Code: Badge model in D1, criteria evaluation logic, badge assignment on vote
- Tests: Badge criteria tests, duplicate prevention tests, display tests

**Dependencies**: GAM-01, GAM-02

---

### GAM-04: Referral Mechanics

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can generate shareable referral links to invite new users, earning credits for upgrades.

**Acceptance Criteria**:
- Given a team, when I click "Get Referral Link", then unique link is generated (format: `qesto.cc/ref?code={referral_code}`)
- Given a new user visiting referral link, when they sign up, then referrer team gets credit
- Credit value: Free user ref = $10 credit, Pro ref = $25 credit (applied to next invoice)
- Referrer can view referral history: email, date, signup status, credit earned
- Code: Referral link generation, tracking on signup, credit application on payment
- Tests: Link generation tests, referral tracking tests, credit application tests

**Dependencies**: AUTH-01, BILL-03

---

### GAM-05: Advanced Energizer Scenarios

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a session creator, I can build complex energizer sequences (battle royale, bracket competitions) for large-scale engagement.

**Acceptance Criteria**:
- **Battle Royale**: Multiple rounds, weakest performers eliminated each round, scoring multiplier per round
  - Config: # of rounds, elimination threshold (bottom %), scoring formula
- **Bracket Competition**: Head-to-head match-ups, single/double elimination
  - Config: 4/8/16 participants, match format, scoring per match
- Both require session size ≥ 4 participants
- Results displayed with winner(s) highlighted
- Code: Battle royale state machine, bracket generation, match scheduling
- Tests: Tournament logic tests, elimination tests, bracket generation tests

**Dependencies**: GAM-01, GAM-03

---

### GAM-06: Gamification Analytics

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a session owner, I can view engagement analytics (badges earned, leaderboard accuracy, energizer participation), so I understand what drives engagement.

**Acceptance Criteria**:
- Metrics: total badges earned, badge breakdown by type, leaderboard participation %, trivia accuracy %, speedster average time
- Charts: badge distribution (pie), engagement over time (line), accuracy by question type (bar)
- Admin dashboard aggregates across all sessions for platform insights
- CSV export of all metrics per session
- Code: Metrics calculation service, analytics routes, dashboard component
- Tests: Metric calculation tests, aggregation tests, export tests

**Dependencies**: GAM-01, GAM-02, GAM-03, ENT-04

---

## Sprint Allocation Summary

| Sprint | Focus | Epics | Target Date |
|---|---|---|---|
| **Sprint 1** | Foundation | CORE (1-3), AUTH (1-2, 5), BILL (1) | 2026-05-02 |
| **Sprint 2** | Realtime + Payments | CORE (4-7), BILL (2-4) | 2026-05-16 |
| **Sprint 3** | Enterprise + SSO | AUTH (3-4), ENT (1-5) | 2026-05-30 |
| **Sprint 4** | i18n + Engagement | CORE (8), I18N (1-3), GAM (1-3) | 2026-06-13 |
| **Sprint 5** | Hardening + Advanced | AUTH (6), BILL (5-6), ENT (6), I18N (4-6), GAM (4-6) | 2026-06-27 |

---

## Definition of Ready

- Problem statement is concrete (user, goal, context)
- Acceptance criteria written in Given/When/Then format
- Size estimated (5/8/13 pts)
- Security/privacy/i18n impact assessed
- Dependencies identified

---

## Definition of Done

- Code merged to main
- Tests pass (unit + integration)
- Observability events added (if applicable)
- Docs updated (if API changes)
- AC demonstrated in PR review

---

## Appendix: Migration Path

If migrating from old Sprint A/B/C structure:
- Old ID 1 (Hotspot refactor) → New CORE-01/02/04
- Old ID 31 (Template foundation) → Moved to future sprint (post-Sprint 5)
- All old IDs phased out; epic-based numbering is canonical

---

## 12) Website Design Wave — AI Visibility + Dashboard Insights (2026-04-19)

### Background

An external design review of the public website and dashboard rated Qesto 7.5/10. Strengths: minimalism, hierarchy, colour strategy, accessibility. Gaps: AI is invisible, dashboard feels transactional, typography reads system-default, and the primary CTA lacks polish. This wave translates the review into eight named items and introduces a design-token source-of-truth artefact.

**Spec:** `docs/spec/WEBSITE_DESIGN_SPEC.md` · **Tokens:** `docs/spec/design-tokens.json`

### Items

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| AI-VIS-01 | Landing AI narrative — subhead + 3-up feature strip on `/` | P1 | Frontend + Marketing + PO | +20% visitor→signup conversion on `/` | Copy sign-off; i18n keys in 5 locales |
| AI-VIS-02 | Inline AI suggestions in "+ New session" wizard (accept / edit / dismiss chips) | P1 | Frontend + Backend + AI | ≥30% acceptance rate on AI-suggested questions | Workers AI endpoint; AI-VIS-03 |
| AI-VIS-03 | `<AIBadge>` primitive (assisted / generated / analyzed variants) + sparkle icon mark | P1 | Frontend | 100% of AI surfaces carry badge + tooltip | DESIGN-TOK-01 |
| DX-INSIGHTS-01 | Dashboard **Insights** tab scaffold (tab + route + empty states) | P1 | Frontend + PO | ≥40% of hosts open Insights tab in first 7 days post-signup | Dashboard tab framework |
| DX-INSIGHTS-02 | Top-themes card + confidence chip + 30-day trend spark (team-scoped `useInsights`) | P1 | Frontend + Backend + AI | Themes rendered within 2s p95 on team with ≥3 closed sessions | DX-INSIGHTS-01; Workers AI summariser; Vectorize |
| DESIGN-TYP-01 | Typography refresh: DM Sans → Inter body; preload + Tailwind config update | P2 | Frontend | -20% visual inconsistency defects on top flows | DESIGN-TOK-01 | **✅ Shipped 2026-04-21** Inter @import in styles.css; woff2 preload in index.html; tailwind-theme.ts sans=Inter |
| DESIGN-POLISH-01 | Primary CTA hover state (scale 1.02 + `shadow.teal`, 120ms `motion.fast`) | P2 | Frontend | Hover state visible on Vote/Join/Landing CTAs; 0 a11y regressions | DESIGN-TOK-01 |
| DESIGN-POLISH-02 | Logo optical weight bump + sparkle mark | P2 | Frontend + Brand | Logo approved by stakeholders; used across all surfaces | Brand sign-off |
| DESIGN-TOK-01 | Design-token source of truth — `docs/spec/design-tokens.json` → generated `src/ui/tokens.ts` + Tailwind theme | P1 | Frontend + Architect | 0 drift between JSON tokens and runtime CSS; CI check green | Build pipeline + token generator |
| WIZ-AI-01 | Session wizard AI sub-flow — consent gate, grounding echo, `Generate now` + refine prompt, streaming skeleton, Workers AI wiring | P0 | Frontend + Backend + AI | ≥50% AI question acceptance rate (rows kept at step 5); ≥65% wizard completion rate | AI-VIS-03; Workers AI endpoint; DRAFT-API (Sprint 0 enabler) |
| WIZ-AI-02 | Per-question editor with type switcher (MC 3–5, Ranking 3–8, Wordcloud) + validation that gates `Next` | P0 | Frontend + Backend | 0 invalid sessions reach LIVE; `Next` disabled-click rate ≤8% per step | WIZ-AI-01 |
| WIZ-OVERVIEW-01 | Step 5 overview — read-only summary of 4 prior steps with pencil edit-jump that preserves state | P1 | Frontend + PO | +10% wizard completion rate vs. baseline; 0 state-loss bugs | WIZ-AI-02 |
| I18N-BUG-01 | Fix missing `step4.mode.fun_title` / `step4.mode.fun_desc` in `wizard.json` across EN/NL/DE/FR/ES (keys rendering raw in UI) | P0 | i18n + Frontend | 0 raw i18n keys visible; CI missing-key gate catches regressions | `scripts/i18n-check` (existing) |
| LAYOUT-GRID-01 | Responsive 12/8/4-column grid primitive + Tailwind config + 4px baseline lint rule | P0 | Frontend + Architect | 100% of new surfaces declare column span per breakpoint; 0 non-4-multiple vertical measurements in merged code | DESIGN-TOK-01 |
| LAYOUT-DENSITY-01 | Density tiers (Compact / Comfortable / Spacious) on list + table surfaces with per-workspace persistence | P1 | Frontend + PO | ≥3 list surfaces switchable without page-rhythm shift; host-level preference persisted in USERS_KV | LAYOUT-GRID-01 |
| LAYOUT-SKELETON-01 | Skeleton + empty + error state parity on every async surface (dashboard sessions/templates/teams, Insights, results, AI generate, decisions search, admin tables) | P0 | Frontend + Tester | 0 layout-shift regressions (CLS < 0.05 p95); every async surface has all 4 states with geometric parity | LAYOUT-GRID-01 | **✅ Shipped 2026-04-21** SkeletonLoader.tsx (InsightsTabSkeleton, WizardAIGenerationSkeleton, LaunchpadPreFlightSkeleton, SessionListSkeleton, ResultsSectionSkeleton); wired into Dashboard, Results, Launchpad pages |
| LAYOUT-A11Y-01 | Landmark regions, skip-link, focus order audit + WCAG 2.2 SC 2.4.11 (Focus Not Obscured) conformance on all sticky regions | P0 | Frontend + Security + Tester | 0 axe-core violations on top flows; keyboard-only traversal possible on every template | A11y suite |
| LAYOUT-MOTION-01 | Motion choreography tokens applied: page/modal entry, list stagger (40ms/20ms rules), spring on drag/chip accept; `prefers-reduced-motion` honoured globally | P1 | Frontend | 0 motion regressions with `prefers-reduced-motion: reduce`; stagger rendered on ≥5 list surfaces | LAYOUT-GRID-01 | **✅ Shipped 2026-04-21** CSS tokens + keyframes in styles.css; animate-page-enter on Home/Dashboard/Results/Present; animate-list-item + stagger on Dashboard session list; btn-motion on all primary CTAs; global prefers-reduced-motion override |
| LAUNCHPAD-01 | Session Launchpad (pre-live) — T6 template, left action rail (Share + Presenter remote + Open lobby primary + Back to questions), right content rail (identity + questions + danger zone), pre-flight strip, responsive rules | P0 | Frontend + Backend | ≥99.5% DRAFT→LIVE transition success from this page; median time-on-Launchpad 20–60s; Open lobby visible without scroll at every breakpoint | LAYOUT-GRID-01; wizard step 5 reconciliation (WIZ-OVERVIEW-01) |
| LAUNCHPAD-02 | Launchpad state preservation + inline editor: Back-to-questions returns to wizard step 2 with edits intact; `+ Add question` inline editor (single question, not full wizard); drag-to-reorder via `PUT /api/sessions/:id/questions/reorder` | P1 | Frontend + Backend | ≥15% of hosts add ≥1 question on Launchpad; 0 state-loss bugs on wizard-round-trip; reorder persists with 0 desync | LAUNCHPAD-01 |
| I18N-BUG-02 | Fix Dutch/English mixing on Launchpad (`Deelnamecode`, QR helper "Scan de QR-code of ga naar qesto.cc en voer de code in") — move hard-coded strings into `launchpad.json` namespace across 5 locales; extend CI i18n check to detect non-keyed literals | P0 | i18n + Frontend | 0 non-keyed literals detected in CI on launchpad components; 0 Dutch strings shown to non-NL user | `scripts/i18n-check` extension |

### Sprint allocation

- **Sprint A (mostly shipped; verification rolls into Sprint 20) — layout + token foundation:** ✅ DESIGN-TYP-01, ✅ LAYOUT-SKELETON-01, ✅ LAYOUT-MOTION-01 (shipped 2026-04-21). Sprint 20 verifies/settles **LAYOUT-GRID-01**, **LAYOUT-A11Y-01**, DESIGN-TOK-01, DX-INSIGHTS-01, **I18N-BUG-01**, and **I18N-BUG-02** via gate reliability work.
- **Sprint B (implementation complete except marketing narrative):** ✅ AI-VIS-02, ✅ AI-VIS-03, ✅ DX-INSIGHTS-02, ✅ **WIZ-AI-01**, ✅ **WIZ-AI-02**, ✅ **WIZ-OVERVIEW-01**, ✅ **LAUNCHPAD-01**, ✅ **LAYOUT-DENSITY-01**. AI-VIS-01 remains marketing/copy scope.
- **Sprint C (planned after Sprint 20 readiness):** DESIGN-POLISH-01, DESIGN-POLISH-02, **LAUNCHPAD-02**.

**Critical path note:** WIZ-OVERVIEW-01 and LAUNCHPAD-01 shipped in Sprint 19. Sprint 20 now verifies KPI and operational evidence before Launchpad polish expands the flow.

### KPIs (measured 30 days post-ship of the wave)

- +20% visitor-to-signup conversion on `/`.
- ≥40% of hosts open the Insights tab at least once in their first 7 days post-signup.
- ≥30% acceptance rate on AI-suggested questions in wizard.
- **≥65% wizard completion rate (open → `Start session`).**
- **Median time-to-start ≤90s (AI path) / ≤180s (Write-yourself path).**
- **0 invalid sessions reach LIVE (MC 3–5 / Ranking 3–8 rules enforced).**
- 0 drift between design-token JSON and runtime CSS (CI-enforced).
- **0 raw i18n keys visible across 5 locales.**
- **Layout review score ≥ 9.5/10 on next external design audit** (up from 7.5). Proxy KPIs below.
- **Cumulative Layout Shift p95 < 0.05** on top flows (Home, Dashboard, Wizard, Results).
- **100% of new surfaces declare column span per breakpoint** (enforced via review checklist §5.0.13).
- **0 axe-core a11y violations** on top flows; **0 WCAG 2.2 SC 2.4.11 violations** on sticky regions.
- **Every async surface has skeleton + empty + error** states at geometric parity (§5.0.8).
- **Session Launchpad DRAFT→LIVE success rate ≥99.5%**; `Open lobby` reachable within 4 tab stops of page top; 0 raw Dutch strings shown to non-NL users.

### Exit criteria

- All eight items shipped with instrumentation live (events in §7 of `WEBSITE_DESIGN_SPEC.md`).
- WCAG AA maintained on every affected surface (re-run a11y suite; update `docs/ACCESSIBILITY_GUIDE.md` if patterns change).
- i18n keys populated in EN/NL/DE/FR/ES for every new user-facing string.
- Design-token JSON is the source; `src/ui/tokens.ts` regenerated, no hand-edits.

### Open questions (resolve before Sprint C / next feature expansion)

- Does "AI analyzed" require on-device inference, or is Workers AI acceptable with explicit consent? (Security + AI strategy; current implementation uses Workers AI provenance/consent tracking)
- Plan-gating for Insights tab (free = 7d window, team = 30d + themes)? (PO; now part of Sprint 20 entitlement matrix)
- Dark-mode pass in this wave or deferred? (Frontend)

---

## OBS-01: Observability Instrumentation (WebSocket Capacity, AI Inference, API Errors)

**Size**: 5 pts | **Sprint**: 18 (mid-sprint P1 enabler) | **Priority**: P1 | **Status**: ✅ Completed 2026-04-24

**Story**: As an analytics operator, I need complete observability for realtime platform health, so I can measure engagement, performance bottlenecks, and error signals that block the north-star metric.

**Acceptance Criteria**:

**Event: ws.capacity_exceeded**
- Given a LIVE session at max participant capacity, when a new voter attempts to join, then `ws.capacity_exceeded` event fires to Analytics Engine
- Event payload includes: `timestamp`, `session_id`, `session_state` (LIVE), `max_capacity`, `current_participants`, `user_agent`
- Event is fired before the JOIN_DENIED response is sent to the client (success signal before the reject)
- Timestamp uses ISO 8601 format (UTC)
- Code: Event fired in SessionRoom DO `onConnect()` handler after capacity check fails
- Tests: Unit test verifies event payload structure; integration test with session at capacity + new joiner

**Event: ai.inference**
- Given any Workers AI inference call completes (e.g., question generation, theme extraction), when the call returns, then `ai.inference` event fires to Analytics Engine
- Event payload includes: `timestamp`, `model_id` (e.g., `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), `inference_duration_ms` (double), `input_tokens`, `output_tokens`, `inference_endpoint` (source route), `status` (success|failure)
- Duration is measured server-side in milliseconds with sub-millisecond precision
- If inference fails, `error_message` is included (first 200 chars only, no PII)
- Code: Wrapper in `functions/api/utils/ai.ts` that emits event after `c.env.AI.run()` completes
- Tests: Unit test verifies duration recording ≥1ms; mock AI call returns known duration; edge case: 0ms duration handled gracefully

**Event: error.api**
- Given any API route returns 5xx status, when the response is sent, then `error.api` event fires to Analytics Engine
- Event payload includes: `timestamp`, `http_status` (500-599), `route` (path pattern, e.g., `/api/sessions/:id`), `method` (GET|POST|PUT|DELETE), `error_message` (first 200 chars, no PII), `user_id` (if authenticated; null if not), `team_id` (if applicable; null if not), `latency_ms` (double)
- Every 5xx response generates exactly one event (no duplicates on retry)
- Latency includes request receive time through response send
- Code: Global error handler in Hono middleware (after all route handlers) emits event on 5xx
- Tests: Unit test verifies event fires on 500/502/503/504; mock error thrown in route handler confirms payload; edge case: error with no user context handled

**Definition of Done**:
- [ ] Code reviewed (min 1 backend-dev reviewer)
- [ ] Unit tests added (`tests/unit/observability/`) covering all three events + edge cases (missing fields, zero durations, 5xx variants)
- [ ] `npm test` green (all observability tests pass)
- [ ] `npm run typecheck` passes (no TypeScript errors)
- [ ] Acceptance criteria demonstrated: three events verified in Analytics Engine query (SELECT * FROM events WHERE event_name IN (...)) with correct payloads
- [ ] Event payloads conform to Analytics Engine schema (existing schema must accommodate the three new events; no schema migration needed if backward-compatible)
- [ ] Error state visible: all 5xx status codes are caught and instrumented (no silent failures)
- [ ] No PII leaked: error messages and user context sanitized (first 200 chars, no email/password/token)
- [ ] Latency impact: instrumentation adds <5ms to p95 request latency (measured in staging)

**Story Points**: 5 (mechanical instrumentation, no new features; three events, three separate call sites, existing event schema)

**In-Sprint Scope Change Analysis**:

Decision tree (from product-owner.md Wave 2):
1. **Is this a critical security/data loss bug?** No (observability enabler, not a bug fix)
2. **Is this a P0 defect (broken feature in production)?** No (feature works; analytics incomplete)
3. **Is this P1 (feature blockers, shipping delay)?** **YES — Analytics Engine is the north-star metric blocker**
   - Three events (ws.capacity_exceeded, ai.inference, error.api) are essential for measuring platform health
   - Backend-dev is implementing these now; must ship before analytics freeze for measurement baseline
   - Without these, north-star KPIs (sessions started per team per month) are incomplete
4. **Team capacity check**: Sprint 18 currently ~55 pts committed; estimate remaining capacity ~30 pts (typical 85–95% utilization rule). This story = 5 pts; well within buffer.
5. **WSJF score vs. sprint minimum**: This is a P1 enabler (high business value: platform observability). Current sprint minimum is ~5 pts. ACCEPT.

**Acceptance Decision**: **ACCEPT into Sprint 18** (2026-04-24, 15:22 UTC)

**Delivery Evidence**: 
- Commit `e7aa3ac` (2026-04-24 16:43 UTC): "Implement application event instrumentation for Analytics Engine" — writeEvent() helper + 3 critical events (signup, session.started, session.closed)
- Commit `a2bb6bc` (2026-04-24 17:22 UTC): "Short-term + medium-term Wave 2 activation: instrumentation + skill cold-starts" — remaining events (error.api, ai.inference, ws.capacity_exceeded)
- Tests: `npx vitest run tests/unit/` — all observability tests pass (verified via CI green)
- Analytics Engine fully instrumented for north-star metric baseline

**Descope Plan**: None required (within capacity buffer). If capacity reduces mid-sprint due to blockers, defer lower-priority items from Sprint 18 (e.g., deferred `DX-INSIGHTS-01` if DESIGN-TOK-01 slips >2 days per SPRINT_PLAN.md risk mitigation).

**Stakeholder Note**: This work unblocks analytics measurement. Backend-dev is already implementing; this story formalizes acceptance criteria and DoD to ensure events are production-ready before merge.

**Dependencies**: None (can run in parallel with other Sprint 18 items)

---

**See also**:
- `README.md` — documentation map (truth hierarchy, reading order)
- `SPRINT_PLAN.md` — reference five-sprint arc (v0.1→v0.5); not greenfield schedule
- `ARCHITECTURE.md` — system design + data model
- `ROADMAP_FULL.md` — release timeline + version targets
- `CLAUDE.md` — L1 project context + hard rules
- `spec/WEBSITE_DESIGN_SPEC.md` — design spec for website + dashboard
- `spec/design-tokens.json` — design-token source of truth
