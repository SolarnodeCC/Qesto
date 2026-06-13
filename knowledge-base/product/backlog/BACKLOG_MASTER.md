---
id: BACKLOG
type: planning
domain: product
category: backlog
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - backlog
  - priorities
  - features
  - technical-debt
relates_to:
  - ROADMAP_FULL
  - SPRINT_PLAN_MASTER
---

# Qesto — Product Backlog (Epic-Based)

_Hub: [Documentation map](./README.md)._

_Last updated: 2026-06-19 (UTC) — **Sprint 90 shipped: v6.0 GA.** Platform version → 6.0.0 (`V60-GA-RELEASE-01`); v6.0 certification bundle + ADR-0053 (`PLATFORM-CERTIFICATION-V6-01`); v5.x deprecation policy + `/api/platform/v5-sunset` (`V5X-SUNSET-NOTICE-01`, additive, no break); annual DR drill RTO ≤ 2h at GA cadence (`DR-DRILL-ANNUAL-V6-01`); PEN5-E2 resolved-by-ratification (ADR-0050 Amendment 1); bounded WCAG AAA held. Closes the S81–S90 expansion arc. See [`SPRINT90_EXECUTION.md`](../releases/SPRINT90_EXECUTION.md). Next: S91 opens the v6.x→v7.0 net-new horizon (REACTIONS + PULSE; ADR-0054/0055/0057). Prior: 2026-06-13 — Sprint 89 shipped: v6.0-rc cut (EMBED Pentest #5 gate closed; CAPTIONS GA WER sign-off; WCAG AAA re-attest; ADR-0052 FedRAMP full-ATO + sovereign; SOC 2 annual; DR drill; platform → 6.0.0-rc.1, see [`SPRINT89_EXECUTION.md`](../releases/SPRINT89_EXECUTION.md)); 2026-06-11 — Sprint 85–99 9-day-cadence re-plan toward v7.0 (S91–S99 net-new registry: E91–E98, 66 stories); 2026-06-01 — Sprint 81–90 master plan_
_Sprint 17 Completion Sync: 2026-04-22_
_Sprint 18 Active (2026-04-29 to 2026-05-13) — see SPRINT_PLAN.md §Sprint 18_
_Sprint 19 Implementation Complete: 2026-04-30 (implemented ahead of planned 2026-05-13 to 2026-05-27 window; see SPRINT_PLAN.md §Sprint 19 for closeout evidence)_
_Sprint 20 Built (2026-05-04) — readiness, entitlement enforcement, observability, Sprint 19 KPI measurement, and AUTHZ-ADR-01 review package; see SPRINT_PLAN.md §Sprint 20_
_Website Design Wave added: 2026-04-19 — see §12_
_**Sprint 20 scope expansion**: 2026-05-01 — Sprint 19 shipped early; AUTHZ-ADR-01 pulled in as committed (was stretch); Sprint A verification bundle added; total committed scope raised from 34 to 45 pts. See SPRINT_PLAN.md §Sprint 20 for updated table._
_**Planning context**: Repository ships v2.x; backlog items are regression contracts + hardening work. Agent review completed 2026-05-01; Sprint 19 implementation is complete; Sprint 20 starts the next five-calendar-sprint plan._

## Overview

This backlog holds **durable user stories** with acceptance criteria (Given / When / Then), grouped under six epics. Items are prioritised with WSJF-style weighting and mapped to a **reference five-sprint sequence** in [`SPRINT_PLAN.md`](../planning/SPRINT_PLAN_MASTER.md) for dependency ordering and onboarding.

**Shipped baseline:** The repository already ships **v2.x** capabilities summarised in [`ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md) and [`SPEC.md`](../../specifications/product/SPEC_PRODUCT.md). Many stories describe behaviour that is **already implemented**; they remain as **regression contracts**, refinement targets, and narrative for new contributors.

**Planning truth:** Use [`ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md) for release-level status. Use this file for **incremental committed work** (including §12 Website Design Wave) and story-level acceptance criteria. Use [`ARCHIVED_SPRINTS.md`](../releases/ARCHIVED_SPRINTS.md) for historical sprint summaries. For technical build truth, start at [`spec/INDEX.md`](../../specifications/SPEC_INDEX.md) (code wins until specs are updated deliberately).

**Sprint field on stories:** The **Sprint: 1–5** metadata on each story refers to the **reference arc** in [`SPRINT_PLAN.md`](../planning/SPRINT_PLAN_MASTER.md), not to the calendar sprint counter in [`ARCHIVED_SPRINTS.md`](../releases/ARCHIVED_SPRINTS.md). Treat those numbers as **ordering and pedagogy**, not “we are still in Sprint 1.”

### Market Pulse Integration (Week of May 19, 2026)

**Workflow:** [`MARKET_PULSE_TO_BACKLOG_WORKFLOW.md`](../MARKET_PULSE_TO_BACKLOG_WORKFLOW.md)  
**Integration log:** [`research/MARKET_PULSE_INTEGRATION_2026-05-19.md`](../research/MARKET_PULSE_INTEGRATION_2026-05-19.md)

| Change | Stories | Rationale |
|--------|---------|-----------|
| **P0 boost** | `ANON-DEPTH-01` (was P1) | Vevox owns anonymous HR segment; 60+ review mentions; Mentimeter trust erosion |
| **New story** | `SCALE-PROOF-01` (P1, S32) | Poll Everywhere 700-cap churn; market needs load-test + GTM proof for 10k+ edge scale |
| **Tagged, no sprint move** | `GDPR-TRUST-PAGE-01`, `ENT-RESIDENCY-01`, `GDPR-BADGE-01`, `ADR-0011`, `AI-SENTIMENT-01` | Compliance + AI sentiment validated; engineering sequence unchanged (DPIA/ADR gates) |

---

## Sprint 19 Closeout + Sprint 20 Planning

**Status**: Implementation completed on 2026-04-30, ahead of the planned calendar window. KPI measurement remains post-ship. See [`SPRINT_PLAN.md` §Sprint 19](../planning/SPRINT_PLAN_MASTER.md) for full detail and closeout evidence.

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

**Delivery Confirmation**: All items landed in commit 2452e67 (2026-04-30) and subsequent bug-fix commits. See [`SPRINT_PLAN.md` §Sprint 19](../planning/SPRINT_PLAN_MASTER.md) for detailed prerequisites and implementation evidence.

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

See [`SPRINT_PLAN.md` §Sprint 20](../planning/SPRINT_PLAN_MASTER.md) for detailed acceptance criteria, dependencies, KPIs, and Definition of Done.

---

## Next Five Calendar Sprints (Sprint 20 to Sprint 24)

> **⚠️ RECONCILIATION NOTE (2026-05-30): This forward-looking section is historical.**
> A code-vs-backlog audit on 2026-05-30 confirmed the codebase has shipped **through Sprint 80 (v5.0 GA)** plus the post-S80 **Townhall** epic. Every sprint registry below (S20–S34 "Active Backlog Additions", the S30–34, S35–39, S60–70 and S71–80 registries) is **delivered**. These tables are retained as an as-built record, not as open work.
>
> **The only forward-looking / uncommitted feature list is [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md)** (status: *proposed*). See **[§Current Frontier & Next Epic](#current-frontier--next-epic)** at the end of this section for the true next epic.
>
> **Verified-shipped Sprint 31 items** (file evidence): ADR-0010 (`adr/ADR-0010-zero-knowledge-mode.md`, accepted), ANON-DEPTH-01 (`Anonymity` type + `SessionWizard` selector + `JoinPage` trust badge + DO enforcement in `SessionRoom.ts`), I18N-SPRINT31-01 (`zero_knowledge`/`trust_badge` keys in all 5 `wizard`+`join` locales), CB-01/CB-02 (`CircuitBreakers` wired in `email.ts`/`billing.ts`/`ai/session-context.ts`/`oauth.ts`), INT-PROVIDER-01 (`integrations/token-store.ts` + `token-crypto.ts`), GDPR-TRUST-PAGE-01 (`/trust/gdpr` route), ADR-0007-AMEND + COMPLIANCE-02 (`check:compliance-claims`).
> **Genuine residual gaps:** MARKET-RESEARCH-VEVOX-01 (no Vevox profile in `COMPETITOR_PROFILES.md`) and TOWNHALL-12 (Workers-AI profanity screening — `Todo`).

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
| ADMIN-ENGAGE-01 | Admin engagement analytics maturity | P1 | ✅ Shipped (v2.2 RC branch) | Energizer funnel and exportable CSV metrics shipped in `AdminAnalyticsTab.tsx` — no Sprint 30 action required |
| ADMIN-OPS-02 | Realtime health correlation dashboard | P1 | Sprint 30 | Admin can compare energizer activity with reconnects, capacity, and errors via time-series view |
| PRIVACY-GAM-01 | Engagement analytics privacy review | P0 | Sprint 30 | Tests confirm no PII in analytics/export payloads |
| RES-PII-01 | PII call site replacement + CI grep gate (ADR-0009) | P0 | Sprint 30 | ~24 raw `console.error(err)` → `safeLogContext()`; CI blocks new violations; `safeLogContext()` already in `lib/log.ts` |
| RES-TIMEOUT-01 | Workers AI AbortController (25s) for ai-insights.ts | P0 | Sprint 30 | `ai-insights.ts:140` and `:244` wrapped; timeout fires gracefully |
| RES-D1-01 | admin middleware D1 safe fallback | P0 | Sprint 30 | `middleware/admin.ts` D1 failure → deny (not 500) |
| RES-RETRY-01 | Shared `invokeAIWithRetry()` for insights route | P1 | Sprint 30 | Insights route uses same retry wrapper as wizard |
| RES-ERR-01 | Verify `sanitizeError()` wiring completeness | P0 | Sprint 30 | `app.ts:101` verified; no raw `err.message` reaches client in any route |
| OBS-VOTE-01 | `vote.submitted` AE event in SessionRoom | P0 | Sprint 30 | Event with `durationMs`, `teamId`, `plan` emitted from DO vote branch; required for Sprint 32 PERF-PROOF-01 |
| OBS-ENERGIZER-FIX-01 | Add `teamId`+`plan` to `emitEnergizerMetric()` | P1 | Sprint 30 | All energizer AE events gain plan-segmentation fields |
| AUTHZ-GAM-01 | Enterprise permission gate for energizer activation | P0 | Sprint 31 | Custom roles can allow/deny energizer activation with audit evidence |
| AUDIT-GAM-01 | Audit UX polish for realtime actions | P1 | Sprint 31 | Audit viewer distinguishes activation, answer-window changes, completion, and denials |
| DEPLOY-GAM-01 | Staging migration/flag checklist | P0 | Sprint 31 | Checklist covers D1/KV compatibility, flag state, rollback, WebSocket smoke |
| QA-ENT-02 | Enterprise permission regression bundle | P0 | Sprint 31 | Owner/admin/member/custom-role allow/deny paths cover session + energizer |
| ADR-0010 | Zero-knowledge anonymity mode ADR | P0 | ✅ Shipped (verified 2026-05-30) | ✅ Accepted in `adr/ADR-0010-zero-knowledge-mode.md` (2026-05-22). ADR defines voter dedup without PII, session config, UI indicators, DO protocol impact; required before ANON-DEPTH-01; **MARKET-RESEARCH:PRIVACY** — Vevox segment leadership, Mentimeter trust gap (pulse 2026-05-19) |
| CB-01 | Wire CircuitBreaker into Stripe + Resend (ADR-0007) | P0 | ✅ Shipped (verified 2026-05-30) | ✅ `CircuitBreakers.resend` in `lib/email.ts:21`; `routes/billing.ts` wrapped; state machine in `lib/resilience/circuit-breaker.ts`. `billing.ts:36/59` and `email.ts:22` wrapped; state machine wired in `createApp()`; CIRCUIT_BREAKER_KV provisioned in production |
| CB-02 | Wire CircuitBreaker for Workers AI + JWKS (ADR-0007) | P0 | ✅ Shipped (verified 2026-05-30) | ✅ `CircuitBreakers.ai` in `lib/ai/session-context.ts:90` + `lib/ai-insights.ts:209`; JWKS path in `lib/oauth.ts`. Workers AI 10s/3-failure OPEN; JWKS 5s/3-failure OPEN; graceful free-plan fallback |
| INT-PROVIDER-01 | Integration provider library with AES-GCM encryption (ADR-0008) | P0 | ✅ Shipped (verified 2026-05-30) | ✅ `lib/integrations/token-store.ts` + `token-crypto.ts` (AES-GCM) + `http-client.ts`; Slack/Teams/Zoom/Notion/Salesforce providers present. `EncryptedTokenStore` uses AES-GCM with `OAUTH_TOKEN_MEK`; `IntegrationHttpClient` timeout bug fixed (`http-client.ts:80`); typed interface; INTEGRATIONS_KV provisioned in production |
| ANON-DEPTH-01 | Zero-knowledge mode session config + trust indicator | P0 | ✅ Shipped (verified 2026-05-30) | ✅ `Anonymity` type incl. `zero_knowledge` (`types.ts:144`); `SessionWizard` selector; `JoinPage.tsx:606` trust badge; DO enforcement (`SessionRoom.ts:1059,1371` — no display names, sentiment/coaching disabled). Anonymity level selector; participant trust badge; i18n; gate: ADR-0010 accepted + MARKET-RESEARCH-VEVOX-01 complete; **MARKET-RESEARCH:PRIVACY** — 60+ monthly anonymous-feedback mentions; Vevox #1 on G2/Capterra/Trustpilot (pulse 2026-05-19) |
| GDPR-TRUST-PAGE-01 | GDPR compliance trust page (marketing artifact, no new engineering) | P1 | ✅ Shipped (verified 2026-05-30) | ✅ `src/pages/GdprTrustPage.tsx` at route `/trust/gdpr` (`App.tsx:118`). Static documentation page covering Qesto's GDPR architecture, EU data residency evidence (Cloudflare edge), sub-processor list draft, and anonymity guarantees; linked from pricing and landing pages; **MARKET-RESEARCH:COMPLIANCE** — Mentimeter US residency churn; ship before Sprint 34 `GDPR-BADGE-01` |
| ADR-0007-AMEND | ADR-0007 amendment: clarify CircuitBreaker.INTEGRATIONS scope | P0 | ✅ Shipped (verified 2026-05-30) | ✅ Accepted in `adr/ADR-0007-amend-integrations-scope.md` (2026-05-22). Amendment accepted before CB-01 wiring; defines which integration call sites (Stripe, Resend, Workers AI, JWKS) are in scope and which state machine parameters apply to each |
| DEVOPS-CB-KV-01 | Production KV namespace provisioning for resilience + integrations | P0 | Sprint 31 | `wrangler kv namespace create CIRCUIT_BREAKER_KV` (prod); `wrangler kv namespace create INTEGRATIONS_KV` (prod); `wrangler pages secret put OAUTH_TOKEN_MEK` (prod + staging); must be done before CB-01/CB-02/INT-PROVIDER-01 merge |
| MARKET-RESEARCH-VEVOX-01 | Vevox deep-dive competitive feature audit | P1 | Sprint 31 | COMPETITOR_PROFILES.md has no Vevox profile; market research task (not engineering) to document Vevox's anonymous Q&A moderation, anonymous live discussion, and employee voice analytics features; **hard gate** before ANON-DEPTH-01 merge; **MARKET-RESEARCH:PRIVACY** (pulse 2026-05-19) |
| SCALE-PROOF-01 | Enterprise participant scaling evidence + GTM claims | P1 | Sprint 32 | Documented load test for 10,000+ concurrent voters; plan quota matrix vs Poll Everywhere (700 cap); pricing/competitor comparison copy passes `check:compliance-claims`; **MARKET-RESEARCH:SCALING** — enterprise scaling + sovereignty high signal (pulse 2026-05-19) |
| I18N-SPRINT31-01 | i18n strings for zero-knowledge mode (ANON-DEPTH-01) in 5 locales | P1 | ✅ Shipped (verified 2026-05-30) | ✅ `zero_knowledge` in all 5 `wizard.json` + `trust_badge` in all 5 `join.json` (EN/NL/DE/FR/ES). All UI strings for anonymity level selector (none/standard/zero-knowledge), participant trust badge, and GDPR trust page in EN/NL/DE/FR/ES; CI `check:i18n` passes; no raw keys visible to users |
| RC-DOCS-01 | Spec + runbook closeout for v2.2 | P0 | Sprint 32 | `SPEC_REALTIME`, `SPEC_BACKEND`, `SPEC_FRONTEND`, roadmap, backlog, and release notes updated to reflect all shipped v2.2 behavior |
| RC-ROLLOUT-01 | Feature-flag rollout plan for LIVE energizers | P0 | Sprint 32 | Rollout steps, cohorts, metrics watched, rollback trigger, and rollback owner defined; staging WebSocket smoke passes with flag on and off |
| RC-OBS-01 | Release health dashboard checklist for v2.2 | P0 | Sprint 32 | Admin surfaces answer: active sessions, reconnects, errors, energizer activation rate, energizer participation, energizer completion |
| ZOOM-01 | Zoom: session results integration | P2 | Sprint 33 stretch / Sprint 34 | OAuth2 Zoom authorization; session close posts summary to Zoom chat or webhook; token encrypted. **Market research flag (WIN_LOSS_ANALYSIS):** Zoom is the #2 loss reason for event organizers and a stated loss reason for trainers; event-organizer GTM motion must be deferred until this ships |
| EXPORT-PDF-01 | PDF signed session summary export | P1 | Sprint 33 stretch / Sprint 34 | `GET /api/sessions/:id/export.pdf` returns signed PDF with full results; plan-gated; R2 staging for signed blob; extends EXPORT-RICH-01-A |
| DEVOPS-INT-SECRETS-01 | Integration OAuth secrets provisioning + webhook retry decision | P0 | Sprint 33 | `wrangler pages secret put SLACK_CLIENT_ID/SECRET` (prod + staging); `wrangler pages secret put TEAMS_CLIENT_ID/SECRET` (prod + staging); decision documented: webhook retry uses DO alarm pattern (preferred) vs. `*/5` cron — must be made before WEBHOOK-01 implementation starts |
| OBS-WS-VOTER-01 | `ws.voter_joined` call site in SessionRoom | P1 | Sprint 33 | `ws.voter_joined` event emitted from `SessionRoom.onConnect()` when participant successfully joins (not only on capacity rejection); `ws.voter_disconnected` emitted from `webSocketClose`; enables participant count and reconnect rate measurement in AE rather than relying solely on ephemeral METRICS_KV |
| OBS-INTEGRATION-01 | Integration funnel AE events: `integration.connected` + `export.initiated` | P1 | Sprint 33 | `integration.connected` event with `blob6=integration_type` (slack/teams/generic), `teamId`, `plan` on each successful OAuth completion; `export.initiated` with `blob6=format`, `teamId`, `plan` on each export request; `export.completed` with `durationMs`; required to measure whether integrations and exports drive retention or plan upgrades |
| I18N-SPRINT33-01 | i18n strings for integrations sprint (Slack, Teams, webhook admin) in 5 locales | P1 | Sprint 33 | OAuth consent copy for Slack and Teams; webhook CRUD admin UI strings; event filter selector labels; delivery log status messages — all in EN/NL/DE/FR/ES; CI `check:i18n` passes |
| I18N-SPRINT34-01 | i18n strings for compliance + AI sprint in 5 locales | P1 | Sprint 34 | AI sentiment mood signal labels (positive/neutral/concerning); AI recap provenance disclosure text; GDPR compliance badge copy; DPA download link text; zero-knowledge proof page — all in EN/NL/DE/FR/ES; CI `check:i18n` passes |
| CODE-SPLIT-01 | Split sessions.routes.ts (81KB) into subrouters | P1 | Sprint 32 | DRAFT/LIVE/lifecycle routes in separate files; zero test regressions; no behavior change |
| EXPORT-RICH-01-A | Structured JSON + enhanced CSV export (partial EXPORT-RICH-01) | P1 | Sprint 32 | `export.json` route; CSV with question text + labels + timing; plan-gated; security controls |
| PERF-PROOF-01 | Production latency benchmark evidence | P1 | Sprint 32 | AQL on `qesto_metrics` produces p50/p95/p99 from `vote.submitted` events (requires OBS-VOTE-01 30d data) |
| MKT-PROMISE-01 | Launch-safe marketing promise audit and copy correction | P0 | ✅ Implemented 2026-05-05 | Public pages avoid unsupported compliance, export, integration, latency, and AI provenance claims |
| SLACK-01 | Slack: session results push notification | P1 | Sprint 33 | Host connects Slack via OAuth2; session close triggers channel summary; token encrypted; i18n consent copy |
| SLACK-02 | Slack: settings UI + OAuth management + event filtering | P1 | Sprint 33 | Team Settings shows Slack connection; event filter selector; disconnect flow |
| TEAMS-01 | Microsoft Teams: session results adaptive card | P1 | Sprint 33 | OAuth2 Teams authorization; session close sends adaptive card; token encrypted |
| WEBHOOK-01 | Generic webhook + HMAC-SHA256 + SSRF controls + retry + delivery log | P0 | Sprint 33 | CRUD; SSRF controls (allowlist, RFC1918 block, domain confirmation); DO alarm retry; `webhook.delivery_attempted` AE event; admin delivery log |
| AI-CONTEXT-01 | `SessionAIContext` schema + `aiPipeline()` + `aiOverride()` helpers | P1 | Sprint 33 | Foundation schema for all Sprint 34 AI features; typed; plan-aware model selection |
| ADR-0011 | Live sentiment inference ADR + DPIA scope | P0 | Sprint 33 | Model: `distilbert-sst-2-int8`; aggregate-only (k≥5); disabled in ZK sessions; DPIA documented; required before Sprint 34 AI-SENTIMENT-01; **MARKET-RESEARCH:AI-ENGAGEMENT** — emotionally-aware CX trend (pulse 2026-05-19) |
| ENT-RESIDENCY-01 | EU data residency: routing evidence + DPA template | P0 | Sprint 34 | Documentation + contractual deliverable (D1 location hint irreversible); routing evidence; DPA template; ops runbook; **MARKET-RESEARCH:COMPLIANCE** — competitive moat vs Mentimeter/Slido cloud egress; do not defer without PO sign-off |
| COMPLIANCE-01 | SOC 2 evidence framework + sub-processor registry | P1 | Sprint 34 | `/knowledge-base/security/SOC2_EVIDENCE.md`; control inventory; sub-processor list; gaps with sprint assignments |
| COMPLIANCE-02 | DPA/SCC template + compliance CI claim gate | P0 | ✅ Shipped (verified 2026-05-30) | ✅ `check:compliance-claims` script in `package.json`; `security/DPA_SCC_TEMPLATE.md`. `npm run check:compliance-claims`; CI rejects marketing PRs adding compliance claims without matching evidence file; DPA/SCC template published |
| RES-DO-01 | DO WebSocket resilience: outer try/catch + `do.storage_fault` AE | P0 | Sprint 30 | `webSocketMessage` catches storage/handler faults; client receives `internal` error; no silent WS close |
| SEC-CSV-01 | CSV formula-injection escape in client + server exports | P0 | Sprint 30 | `lib/csv.ts` guards `=+-@` prefixes; Results + `export.csv` use shared helper |
| GAM-STAGING-SMOKE-01 | Cloudflare staging WebSocket smoke for LIVE energizers | P0 | Sprint 32 gate | Checklist: `knowledge-base/operations/GAM_STAGING_SMOKE_CHECKLIST.md`; blocks RC rollout |
| AI-RECAP-PROV-01 | AI recap provenance: edit history + evidence links + export metadata | P1 | Sprint 34 | Recap shows model/timestamp/edit flag; export JSON includes provenance block; extends AI-CONTEXT-01 |
| AI-SENTIMENT-01 | Real-time session sentiment via Workers AI | P1 | Sprint 34 | `distilbert-sst-2-int8`; aggregate mood signal (k≥5); English-only; ZK-disabled; no individual attribution; gate: ADR-0011 + DPIA complete; **MARKET-RESEARCH:AI-ENGAGEMENT** — privacy-first alternative to cloud-dependent sentiment APIs (pulse 2026-05-19) |
| ANON-DEPTH-02 | Zero-knowledge trust documentation + Vevox competitive proof | P1 | Sprint 34 | KB technical proof doc; sales comparison vs. Vevox; gate: ANON-DEPTH-01 merged; **MARKET-RESEARCH:PRIVACY** |
| GDPR-BADGE-01 | GDPR compliance badge + deletion automation test | P1 | Sprint 34 | Evidence doc; deletion test; `gdpr.deletion_requested`/`gdpr.deletion_completed` AE events; data-subject runbook; **MARKET-RESEARCH:COMPLIANCE** — follows `GDPR-TRUST-PAGE-01` marketing surface |
| EXPORT-RICH-01 | Rich export formats (full: JSON, PDF, DOCX, Notion-ready) | P1 | Sprint 33 stretch / Sprint 34 stretch | Complete export suite; EXPORT-RICH-01-A (Sprint 32) + EXPORT-PDF-01 (Sprint 33+) are milestones toward this |
| ENT-COMPLIANCE-01 | Enterprise compliance evidence packet (SOC 2, pen-test, DPA, sub-processors) | P0 | Sprint 33-34 (partial) | COMPLIANCE-01 + COMPLIANCE-02 in Sprint 34; COMPLIANCE-03 (Type I audit, 13 pts) in Sprint 35+ |
| COMPLIANCE-03 | SOC 2 Type I full audit work | P1 | Sprint 35+ (13 pts) | Full Type I audit engagement; requires COMPLIANCE-01 framework complete |
| AI-COACHING-01 | Post-session facilitator coaching suggestions | P2 | Sprint 34 stretch / Sprint 35+ | Vectorize gate: ≥100 closed-session embeddings in staging required before starting |

**Dependencies and gates**:
- ENTITLEMENTS-02 must be green before Sprint 21 expands role enforcement.
- OBS-02 must land before S19-MEASURE-01 can produce credible KPI baseline.
- AUTHZ-ADR-01 blocks RBAC depth/custom roles implementation.
- DO-PROTOCOL-ADR-01 blocks GAM-01 in LIVE sessions.
- Sprint 26 activation readiness now unblocks Sprint 27 participant gameplay.
- Leaderboard and badge primitives now unblock admin engagement analytics.
- Token/i18n/a11y gates must stay green before Sprint 23 design polish expands affected surfaces.
- **OBS-VOTE-01 (Sprint 30) must ship ≥30 days before Sprint 32 PERF-PROOF-01 to accumulate meaningful latency data.**
- **ADR-0010 must be accepted before ANON-DEPTH-01 implementation starts (Sprint 31).**
- **INT-PROVIDER-01 (Sprint 31) must be merged before any integration provider (SLACK-01, TEAMS-01, WEBHOOK-01) can start in Sprint 33.**
- **ADR-0011 + DPIA must be completed in Sprint 33 before AI-SENTIMENT-01 implementation starts in Sprint 34.**
- **ANON-DEPTH-01 (Sprint 31/32) must be merged before ANON-DEPTH-02 (Sprint 34).**
- **AI-CONTEXT-01 (Sprint 33) is required by AI-RECAP-PROV-01 and AI-SENTIMENT-01 in Sprint 34.**
- **COMPLIANCE-02 CI gate must be in place before any marketing copy adds EU residency or compliance claims (target Sprint 31; MVP script shipped 2026-05-22).**
- **CIRCUIT_BREAKER_KV, INTEGRATIONS_KV, and OAUTH_TOKEN_MEK must be provisioned in production (DevOps) before Sprint 31 circuit-breaker and encryption stories merge.**

---

## Current Frontier & Next Epic

**As-built position (audited 2026-05-30):** All committed roadmap arcs are delivered — v2.x → **v5.0 GA (Sprint 80)** — including the post-S80 **Townhall** epic (`session_mode='townhall'`, ADR-0044). The forward sprint registries above are an as-built record, not open work.

**The only uncommitted feature list is [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md)** — 11 proposed new-business epics, status *proposed / for PO review*. Build status of its ranked set:

| # | Epic | Status |
|---|------|--------|
| 1 | TOWNHALL | ✅ Shipped (ADR-0044; residual TOWNHALL-12 profanity screening) |
| 2 | COPILOT — Live AI facilitator co-pilot | 🟡 Largely covered by shipped `AI-COPILOT-MULTITURN-01` (S76) + `AI-COPILOT-EDGE-01` (S77); confirm parity vs. epic pitch |
| 3 | **INSIGHTS+ — Cross-session intelligence** | 🟢 **Promoted → [EPIC-INSIGHTS+](#epic-insights-cross-session-intelligence)** (groomed 2026-05-30; 11 stories / ~95 pts; gate ADR-0045) |
| 4 | STAGE — Hybrid event suite | ⬜ Not started (no event/agenda orchestration layer) |
| 5 | RETRO — Agile retrospectives | ⬜ Not started (no `retro` session mode) |
| 6 | IDEATE — Brainstorm & prioritization | ⬜ Not started (no idea-board) |
| 7–10, ★ | DELIBERATE / REACTIONS / CAPTIONS / EMBED / CANVAS | ⬜ Not started |

**→ Active arc: Sprints 81–85** — [`SPRINT81_85_PLAN.md`](../planning/SPRINT81_85_PLAN.md) (2026-06-01). Parallel tracks: **INSIGHTS+** (cross-session intelligence, S81–S85), **COPILOT finish** (S82–S83), **native mobile + marketplace** (S81–S83 → **v5.1 GA** S84), **STAGE/RETRO foundation** (S85). Gate: ADR-0045 accepted by end of S81.

| Sprint | Window | Release | Goal |
|--------|--------|---------|------|
| **S81** | 2026-06-02 → 2026-06-15 | Beta | Native mobile beta + INSIGHTS foundation + Pentest #4 open |
| **S82** | 2026-06-16 → 2026-06-29 | Mobile GA | Store release + marketplace billing + INSIGHTS Tier-1 pipeline |
| **S83** | 2026-06-30 → 2026-07-13 | **v5.1 RC** | Paid listings + INSIGHTS clustering + COPILOT residuals complete |
| **S84** | 2026-07-14 → 2026-07-27 | **v5.1 GA** | TOWNHALL 50k proof + INSIGHTS dashboard + agent marketplace prep |
| **S85** | 2026-07-28 → 2026-08-10 | v5.1.1 / S86 prep | STAGE + RETRO/IDEATE foundation + INSIGHTS export completion |

**→ Next arc: Sprints 85–88 (five epics)** — [`NEXT_5_EPICS_PLAN.md`](../planning/NEXT_5_EPICS_PLAN.md) (2026-06-05). Sequences **STAGE → RETRO → IDEATE → DELIBERATE → EMBED** (competitive epics #4–7 + #10); v5.2 GA at S86, v6.0-rc at S88. Gates: ADR-0048 (S85), ADR-0049 (S86), ADR-0050 (S87).

---

## Epic Catalog

Summary of epic posture versus the **v2.x shipped baseline** (see [`ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md)). This table is **not** a greenfield completion percentage.

| Epic | Status | Focus | Notes |
|---|---|---|---|
| **EPIC-CORE** | Shipped (baseline) | Session lifecycle, realtime voting, presenter controls | Core v2.0 platform live; stories remain AC / hardening references |
| **EPIC-BILLING** | Shipped (baseline) | Stripe, plan middleware, subscriptions | Follow-on items may still use BILL-* IDs |
| **EPIC-AUTH** | Shipped (baseline) | Magic link, SAML SSO, JWT | Advanced token / edge cases may remain in backlog |
| **EPIC-ENT** | In progress | Audit, RBAC depth, admin, multi-tenant | Enterprise / compliance completion per roadmap |
| **EPIC-I18N** | In progress | Locales, key validation, translation QA | Bundles shipped; CI and QA hardening ongoing |
| **EPIC-GAM** | In progress | Energizers, leaderboard, badges, referrals | Base gamification live; depth and analytics queued |
| **EPIC-TOWNHALL** | ✅ Shipped (verified 2026-05-30) | Moderated anonymous Q&A at scale | Competitive epic #1 (ADR-0044); `session_mode='townhall'` live; TOWNHALL-01–11/13/14 Landed. Residual: TOWNHALL-12 (Workers-AI profanity, `Todo`), TOWNHALL-05 5k load-test + group/ungroup console UI deferred |
| **EPIC-INSIGHTS+** | **Committed (S81–S85)** | Cross-session intelligence (themes, trends, recurring topics, facilitator scorecard) | Competitive epic #3; sequenced in [`SPRINT81_85_PLAN.md`](../planning/SPRINT81_85_PLAN.md); 11 stories / ~95 pts; gate ADR-0045 |

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

## EPIC-TOWNHALL: Moderated Anonymous Q&A at Scale

**Goal**: Turn Qesto from a presenter-driven poll tool into an audience-driven Q&A platform for all-hands / town halls / AMAs. Competitive epic #1 (see [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md)). Architecture: [`ADR-0044`](../../adr/ADR-0044-townhall-qa-board.md).

**Locked decisions**: dedicated `session_mode='townhall'`; host-configurable pre/post moderation; Team-tier only (`townhallQA`). MVP = TOWNHALL-01–10; 11–14 are polish + hardening. Ships behind `REALTIME_TOWNHALL_ENABLED` until back-compat tests pass (ADR-0005).

| ID | Story | Size | Status |
|---|---|---|---|
| TOWNHALL-01 | Migration `0046` + schema: `session_mode+=townhall`, `townhall_moderation` col, `townhall_questions` table, `zero_knowledge` CHECK | 5 | **Landed** |
| TOWNHALL-02 | Types + Zod + `townhall_board` feature + `townhallQA` entitlement + `session:moderate` permission | 5 | **Landed** |
| TOWNHALL-03 | Strategy module `session-room-townhall.ts` — board state machine, grouping (upvoter-set union), dedupe | 8 | **Landed** |
| TOWNHALL-04 | DO core: branch `SessionRoom` on `mode=townhall`; submit/upvote/moderate handlers; `session:moderate` guard | 13 | **Landed** |
| TOWNHALL-05 | DO delta broadcast: snapshot on init/request_state; coalesced upvotes; pre/post tag-targeting; `th:rev` | 13 | Partial — eager deltas + tag-targeting + rev landed; alarm-coalescing + 5k load-test pending |
| TOWNHALL-06 | REST `routes/townhall/*`: config (draft), questions fallback, export, DELETE; entitlement + audit; start re-check | 8 | **Landed** — config + export (CSV/JSON) + GDPR DELETE + start→DO wiring; non-WS live fallback deferred |
| TOWNHALL-07 | `useTownhallSession` hook: reducer, delta apply, rev-gap resync, optimistic upvote | 8 | **Landed** |
| TOWNHALL-08 | `TownhallPresent` moderation console: tabbed queue, approve/dismiss/answer/spotlight, aria-live | 13 | **Landed** (group/ungroup UI deferred) |
| TOWNHALL-09 | `TownhallJoin` (submit + display-name toggle + upvote) + shared `TownhallQuestionCard` | 8 | **Landed** |
| TOWNHALL-10 | `TownhallDisplay` big-screen: sorted approved + spotlight highlight | 5 | **Landed** |
| TOWNHALL-11 | Export CSV/JSON + persist-on-close + checkpoint alarm + GDPR delete | 8 | **Landed** (checkpoint alarm deferred; DO storage durable + persist-on-close cover RPO) |
| TOWNHALL-12 | Workers-AI profanity screening (async, per-session toggle, non-blocking ack) | 8 | Todo |
| TOWNHALL-13 | i18n namespace `townhall` × EN/NL/ES/DE/FR | 3 | **Landed** — all 5 locales translated (28 keys, parity test green) |
| TOWNHALL-14 | Hardening: submit token bucket, dedupe/spam, abuse + a11y + back-compat tests | 8 | **Landed** — back-compat matrix (non-townhall rejection, request_state resync), rate-limit/dedupe/group-flow DO tests; a11y in components. Group/ungroup *console UI* (parent-picker) deferred |

**Epic acceptance**: Team host configures pre/post in draft (non-team 403); anonymous-default submit + upvote (no double-upvote); pre-mod audience sees approved-only, post-mod sees all-but-dismissed; console actions reflect on audience+display within one debounce; reconnect resyncs board with no loss/dupes; steady-state is deltas only; close persists + export correct; GDPR delete purges DO+D1; existing poll/energizer flows unchanged.

---

## EPIC-INSIGHTS+: Cross-Session Intelligence

**Goal**: Lift analytics above the single session into a longitudinal **Voice-of-Customer / L&D intelligence** product — theme clustering across all of a team's sessions, engagement trend lines, recurring-topic detection, and a per-facilitator scorecard. Competitive epic #3 (see [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md)). Highest-ranked **un-built** epic in the 🟢 near-term cluster (Value 4 / Change 3); an ARPU + retention lever that sells to research, CX and L&D buyers.

**Status**: **Committed S81–S85** (2026-06-01). See [`SPRINT81_85_PLAN.md`](../planning/SPRINT81_85_PLAN.md). Sprint allocation: INSIGHTS-00/01-spike S81 → INSIGHTS-01/02 S82 → INSIGHTS-03/04 S83 → INSIGHTS-05/06/08 S84 → INSIGHTS-07/09/10 + I18N S85.

**Reuses (effort-honest)**: `DECISIONS_VECTORIZE` (768d cosine — no new index), the `lib/ai-insights.ts` distillation pipeline + `routes/ai-insights/*`, the existing `useInsights` hook + `InsightThemeCard` (today derives team themes client-side — this epic moves aggregation server-side and adds trends/recurrence/scorecard), `AdminAnalyticsTab` export plumbing, and the `worker/` scheduled handler for rollup jobs.

**Net-new**: a cross-session aggregation store (D1 + KV cache), recurring-topic clustering, longitudinal trend + scorecard APIs, and the dashboard surfaces that render them.

**Locked/proposed decisions** (ratify in ADR-0045):
- New D1 tables `session_insights` (per closed session: distilled themes, embedding ref, engagement metrics) and `team_insight_rollup` (materialized team aggregates); **reuse** `DECISIONS_VECTORIZE`, no new vector index.
- **Zero-knowledge sessions are hard-excluded** from every cross-session store and aggregate (consistent with ADR-0010 + ADR-0011); a **k-anonymity floor** (k≥3 sessions, k≥5 respondents) gates any surfaced signal.
- Aggregation is **async** — on session close + a scheduled `worker/` rollup; **zero added latency on the close path**.
- **Workers AI only** for clustering/distillation (hard rule #1); no third-party egress.
- Plan-gated behind a new `crossSessionInsights` entitlement (Team tier+); free/starter see an upsell empty-state.

| ID | Story | Size | Pri | Status |
|---|---|---:|---|---|
| INSIGHTS-00 | **ADR-0045** — cross-session intelligence architecture: aggregation store, embedding reuse, ZK exclusion, k-anonymity floor, plan gating, async rollup model. Gate for INSIGHTS-02+ | 3 | P0 | ✅ Drafted — [`adr/ADR-0045-cross-session-intelligence.md`](../../adr/ADR-0045-cross-session-intelligence.md) (proposed) |
| INSIGHTS-01 | D1 migration `0047`: **reuse** `insights_daily` (+ `team_id`, `embedding_ref`) per ADR-0045; add `team_insight_rollup(team_id, kind, window, payload_json, computed_at)`; repository layer; ZK-excluded backfill | 8 | P0 | ✅ Shipped (S82) — migration `0047` + `schema.sql`; repository `lib/team-insights.ts` (`upsertInsightsDaily`, `upsertTeamInsightRollup`, `patchInsightsDailyTeamId`) |
| INSIGHTS-02 | Tier-1 pipeline: extend `precomputeInsights()` on close — distil themes (reuse `ai-insights`), upsert embedding via `insights-vectorize.ts` with `team_id` metadata, write `insights_daily`; **idempotent**; **ZK guard** skips `zero_knowledge`; emits `insight.aggregated` | 13 | P0 | ✅ Shipped (S82) — `routes/sessions/shared.ts:precomputeInsights` writes `insights_daily` (idempotent on `session_id,day`), upserts vector w/ `team_id`+`closed_at` metadata, ZK write-boundary guard, emits `insight.aggregated`; `tests/unit/team-insights.test.ts` |
| INSIGHTS-03 | Recurring-topic detection: Vectorize semantic clustering across a team's session embeddings → recurring themes with frequency + first/last-seen; k-anonymity floor enforced | 13 | P1 | ✅ Shipped (S85) — `lib/team-insights-recurring.ts` (`clusterRecurringThemes`, k≥3 floor); `tests/unit/team-insights-recurring.test.ts` |
| INSIGHTS-04 | Longitudinal trend API `GET /api/teams/:id/insights/trends` (30/90/180d windows): engagement + theme trend lines; plan-gated; KV-cached; AE event | 8 | P1 | ✅ Shipped (S85) — `routes/team-insights.ts` (`/insights/trends`, KV-cached, `insight.trends_viewed`) |
| INSIGHTS-05 | Facilitator scorecard API + model: per-facilitator sessions-run, avg participation, response rate, theme diversity, mood trend (non-ZK only); team-scoped | 8 | P1 | ✅ Shipped (S85) — `lib/team-insights-scorecard.ts` (ZK-excluded source rows); `routes/team-insights.ts:/insights/scorecard` |
| INSIGHTS-06 | Frontend: extend Dashboard **Insights** tab → cross-session view — trend lines, recurring-topic list, facilitator scorecard; reuse `useInsights`/`InsightThemeCard`; loading/empty/plan-gated states; WCAG 2.1 AA | 13 | P1 | ✅ Shipped (S85) — `src/pages/dashboard/InsightsSection.tsx`, `src/components/insights/TeamInsightsPanel.tsx` (plan-gated empty-state) |
| INSIGHTS-07 | Export: cross-session intelligence report (JSON + enhanced CSV; PDF stretch) extending `EXPORT-RICH`; plan-gated; CSV formula-injection safe (`lib/csv.ts`) | 8 | P1 | ✅ Shipped (S85) — `lib/team-insights-export.ts` + `routes/team-insights.ts:/insights/export`; `lib/csv.ts:escapeCsvCell`; `tests/unit/team-insights-export.test.ts` |
| INSIGHTS-08 | Observability: `insight.aggregated`, `insight.trends_viewed`, `insight.scorecard_viewed` AE events with `teamId`+`plan`; adoption funnel (KPI: ≥40% of eligible teams open the cross-session view in 14 days) | 5 | P1 | ✅ Shipped (S85) — events in `lib/observability.ts`; emitted from `routes/team-insights.ts` + `routes/sessions/shared.ts` |
| INSIGHTS-09 | Privacy/ZK guardrails + tests: ZK sessions excluded from all stores/aggregates; k-anonymity floor; no PII in rollups; privacy review + regression bundle | 8 | P0 | ✅ Shipped (S85) — ZK write-boundary guard (`routes/sessions/shared.ts:precomputeInsights`); k≥3 sessions / k≥5 respondents floors; `tests/integration/insights-entitlement-contract.test.ts` |
| INSIGHTS-10 | Plan gating + entitlement: `crossSessionInsights` (Team tier+); upsell empty-state for lower tiers; entitlement contract tests | 5 | P0 | ✅ Shipped (S85) — `crossSessionInsights` in `types.ts` (Team `true`); all `/insights/*` routes `requireFeature`-gated; `tests/integration/insights-entitlement-contract.test.ts` |
| I18N-INSIGHTS-01 | i18n strings — trend labels, recurring topics, scorecard, export — in EN/NL/DE/FR/ES; `check:i18n` green | 3 | P1 | ✅ Shipped (S85) — `public/locales/{en,nl,de,fr,es}/insights.json` (`crossSession.*`, scorecard, export keys) |

**Total**: ~95 pts (≈ two sprints at the reference 40–50 pts/sprint cadence).

**Epic acceptance**: A Team-tier facilitator opens the Insights tab and sees, across all their team's **non-ZK** closed sessions, (a) recurring themes with frequency + trend, (b) engagement trend lines over a selectable window, and (c) a per-facilitator scorecard — all rendered within 2s p95 for a team with ≥3 closed sessions; zero-knowledge sessions never contribute to any aggregate; no signal surfaces below the k-anonymity floor; lower-tier teams see an upsell empty-state (no data leak); export produces a structured report; aggregation adds no latency to session close; all AI inference stays on Workers AI; existing single-session insights are unchanged.

**Dependencies/gates**:
- **ADR-0045 (INSIGHTS-00) must be accepted before INSIGHTS-02+ implementation starts.**
- Reuses the ADR-0011 sentiment foundation for the scorecard mood-trend metric (non-ZK sessions only).
- Triage COMPETITIVE_EPICS #2 COPILOT before final prioritization (may already be satisfied by shipped AI-copilot work).

---

## EPIC-COPILOT: Live AI Facilitator Co-pilot

**Goal**: A presenter-side AI panel **during a LIVE session** that reads the room and acts — suggests the next follow-up question, flags disengagement/confusion, and drafts an on-the-fly poll from a one-line intent, all without leaving the run screen. Competitive epic #2 (see [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md)). Wedge against Mentimeter's "AI facilitator coaching"; native-AI moat (Workers AI only, no transcript egress).

**Status**: **~70% shipped**; residuals **committed S82–S83** (COPILOT-04/07/08/10). Gate: ADR-0046 ✅ accepted.

**Audit finding (2026-05-30) — what already exists vs. the gap**: S71/S76/S77 shipped a **post-session, standalone multi-turn chat API**, *not* the live copilot. Concretely:
- ✅ Shipped: context-bundle endpoint `GET /api/agent/copilot/sessions/:id`, multi-turn chat `POST .../turn` (`routes/copilot-context.ts`), edge-status stub `GET .../edge/status`, plan gating (team/starter), and the ADR-0011 **sentiment** foundation — `SessionRoom.ts:1094` broadcasts `sentiment_signal` to `role:presenter` sockets, rendered as a mood badge in `Present.tsx`.
- ❌ Not built: the chat endpoint **doesn't even receive session context** (it passes only chat history to the model — `copilot-context.ts:116`); **no live room-read**, **no structured suggestions**, **no disengagement flag**, **no poll drafting**, **no presenter panel UI**, **no wiring to the live loop**. `ADR-0039` (referenced by `AI-COPILOT-EDGE-01`) was never written.

**Reuses (effort-honest)**: the existing `/api/agent/copilot` surface (`app.ts:289`) + `copilot-context.ts`/`copilot-multturn.ts`; `generateQuestions()` (`lib/ai-wizard.ts:363`) for poll drafting; the `sentiment_signal` broadcast + `Present.tsx` mood badge; the existing LIVE `add_question` `ClientMessage` WS path for injecting an accepted poll.

**Net-new**: an aggregate **live-context snapshot** from the DO, a **structured suggestion/action protocol**, disengagement derivation, and the **presenter copilot panel UI**.

**Locked/proposed decisions** (ratify in ADR-0046):
- **Inference stays in the stateless Pages Function, not inside the DO.** The DO exposes an **aggregate live snapshot** (current question, tallies, response count, latest sentiment mood); the copilot route reads it and runs Workers AI off the hot path. Rejects the epic's literal "inference loop wired into the DO" (would block the single-threaded DO).
- **Presenter-triggered + debounced pull**, not continuous push on every vote (cost/noise control).
- **Structured action protocol**: copilot returns typed actions `{ kind: 'followup_question' | 'poll_draft' | 'disengagement_alert' | 'pacing', ... }`; `poll_draft` payload reuses `generateQuestions()`.
- **Accept → inject via the existing `add_question` WS message** — no new DO protocol version (ADR-0005).
- **Aggregate-only to the model** (tallies, counts, mood) — never raw per-voter responses; in **zero-knowledge** sessions sentiment is off (ADR-0010/0011) so disengagement falls back to participation metrics; no PII to AI (ADR-0009).
- **Plan-gated** behind a `liveCopilot` `featuresUnlocked` key (keep team/starter parity with the existing `/turn` gate).

| ID | Story | Size | Pri | Status |
|---|---|---:|---|---|
| COPILOT-00 | **ADR-0046** — live facilitator copilot: DO aggregate-snapshot vs. in-DO inference, structured action protocol, accept→`add_question` reuse, privacy/ZK, plan gate. Gate for COPILOT-02+ | 3 | P0 | ✅ Accepted — [`adr/ADR-0046-live-facilitator-copilot.md`](../../adr/ADR-0046-live-facilitator-copilot.md) (2026-05-30) |
| COPILOT-01 | Live-context snapshot: DO exposes an aggregate read (`current question`, tallies, response count, latest `sentiment_signal` mood); extend `buildCopilotContext` to carry it; ZK-safe (aggregate-only) | 13 | P0 | ✅ Shipped — DO `/copilot/snapshot` (`SessionRoom.ts`, ZK-guarded) + `lib/copilot-live-context.ts` + `GET .../live-context` route; `tests/unit/copilot-live-context.test.ts` |
| COPILOT-02 | Structured suggestion engine: extend the copilot turn/suggest endpoint to emit typed actions grounded in the live snapshot (reuse `ai-wizard` prompt patterns); Workers AI only | 13 | P0 | ✅ Shipped — `lib/copilot-suggest.ts` (Zod action protocol + grounded prompt + deterministic fallback) + `POST .../suggest` route (CB-wrapped, ZK-safe via live context); panel Suggestions section + `useCopilot.fetchSuggestions`; `tests/unit/copilot-suggest.test.ts` (11) |
| COPILOT-03 | On-the-fly poll draft: `POST /api/agent/copilot/sessions/:id/draft-poll` from a one-line intent, reusing `generateQuestions()`; returns a draft question schema; plan-gated | 8 | P0 | ✅ Shipped — `lib/copilot-draft-poll.ts` + route in `routes/copilot-context.ts`; AI circuit-breaker + graceful fallback; owner-checked; `tests/unit/copilot-draft-poll.test.ts` |
| COPILOT-04 | Disengagement/confusion detection: derive from sentiment `concerning` (k≥5) + response-rate / vote-latency drop off the DO snapshot; emit `disengagement_alert`; no per-participant tracking | 8 | P1 | ✅ Shipped (S82) — `lib/copilot-suggest.ts:detectDisengagement` (k≥5 mood gate + participation drop-off; ZK falls back to participation), wired into prompt + fallback + suggest route; `tests/unit/copilot-suggest.test.ts` |
| COPILOT-05 | Presenter copilot panel UI in `Present.tsx`: live suggestions + mood, accept/dismiss, draft-poll input; presenter-only; debounced refresh; WCAG 2.1 AA | 13 | P0 | ✅ Shipped — `components/CopilotPanel.tsx` + `hooks/useCopilot.ts` (15s debounced poll), mounted presenter+live in `Present.tsx`; i18n keys in 5 locales (covers I18N-COPILOT-01) |
| COPILOT-06 | Accept→inject: wire an accepted `poll_draft` into the LIVE session via the `add_question` `ClientMessage` (no new DO protocol); optimistic UI + confirm | 8 | P1 | ✅ Shipped — **added** `add_question` as an additive v1 message (didn't exist; ADR-0005-permitted, ADR-0046 updated): Zod variant in `validators.ts`, `SessionRoom.handleAddQuestion` (presenter-guarded, appends to `K_QUESTIONS` + best-effort D1), `useLiveSession.sendAddQuestion`, panel "Add to session" + optimistic confirm; tests in `validators.test.ts` |
| COPILOT-07 | Observability: `copilot.suggestion_emitted`, `copilot.suggestion_accepted`, `copilot.poll_drafted` AE events with `teamId`+`plan`; adoption funnel (KPI: ≥35% of eligible LIVE sessions open the panel) | 5 | P1 | Todo |
| COPILOT-08 | Privacy/ZK guardrails + tests: aggregate-only to AI; ZK disengagement falls back to participation; no PII in prompts or AE; privacy review + regression bundle | 8 | P0 | Todo |
| COPILOT-09 | Plan gating + entitlement: `liveCopilot` `featuresUnlocked` key (team/starter); lower tiers get an upsell affordance; contract tests | 5 | P0 | ✅ Shipped — `liveCopilot` in `PLAN_QUOTAS` (`types.ts`) + frontend mirrors; copilot routes gate via `featureAllowed(...,'liveCopilot')`; panel shows upsell on 403 |
| COPILOT-10 | Integration tests: live vote → `sentiment_signal` → copilot suggestion → presenter display → accept → `add_question` injected | 8 | P1 | Todo |
| I18N-COPILOT-01 | i18n strings — suggestion labels, action kinds, disengagement copy, draft-poll UI — in EN/NL/DE/FR/ES; `check:i18n` green | 3 | P1 | 🟡 Mostly done — panel strings shipped in all 5 locales (COPILOT-05); remaining: COPILOT-02/04 suggestion/disengagement copy |

**Total**: ~95 pts (≈ two sprints at the reference 40–50 pts/sprint cadence).

**Epic acceptance**: During a LIVE session a presenter opens the copilot panel and, grounded in the live room state, sees (a) a suggested next follow-up question, (b) a disengagement/confusion flag when sentiment is `concerning` or participation drops, and (c) can type a one-line intent and get a drafted poll they accept into the running session — all without leaving the run screen; only aggregate signals reach the model; zero-knowledge sessions surface no per-response content and no sentiment-derived flag; the panel is plan-gated; AI inference stays on Workers AI and off the DO hot path; existing poll/energizer/voting flows and the post-session chat API are unchanged.

**Dependencies/gates**:
- **ADR-0046 (COPILOT-00) must be accepted before COPILOT-02+ implementation starts.**
- Builds on the ADR-0011 sentiment foundation (shipped) and the existing `/api/agent/copilot` surface.
- COPILOT-06 reuses the existing LIVE `add_question` WS path (ADR-0005) — no protocol bump.

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

## Sprint 30–34 Story Registry (added 2026-05-20)

_Added per roadmap update covering Sprints 30–34 (v2.2 hardening → v2.3 integrations + compliance + AI depth)._

### EPIC-RES — Resilience

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| RES-PII-01 | PII sanitization: `safeLogContext()` + CI gate (ADR-0009) | 8 | P0 | S30 | ✅ Delivered |
| RES-TIMEOUT-01 | Workers AI AbortController (25s) for ai-insights.ts | 5 | P0 | S30 | ✅ Pre-existing |
| RES-D1-01 | Admin middleware D1 try/catch with safe 403 fallback | 3 | P0 | S30 | ✅ Delivered |
| RES-RETRY-01 | Shared `invokeAIWithRetry()` for insights route | 3 | P1 | S30 | ✅ Pre-existing |
| RES-ERR-01 | Wire `sanitizeError()` into `app.onError` globally | 3 | P0 | S30 | ✅ Pre-existing |
| CB-01 | Circuit breaker: Stripe + Resend (ADR-0007) | 8 | P0 | S31 | Planned |
| CB-02 | Circuit breaker: Workers AI + JWKS (ADR-0007) | 5 | P0 | S31 | Planned |

### EPIC-INT — Integrations

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| INT-PROVIDER-01 | Integration provider library (ADR-0008) | 8 | P0 | S31 | Planned |
| SLACK-01 | Slack: session results push notification | 8 | P1 | S32 | Planned |
| SLACK-02 | Slack: settings UI + OAuth management | 8 | P1 | S33 | Planned |
| TEAMS-01 | Microsoft Teams: session results adaptive card | 8 | P1 | S33 | Planned |
| WEBHOOK-01 | Generic webhook + HMAC signing + retry + admin log | 8 | P0 | S33 | Planned |
| ZOOM-01 | Zoom integration (stretch S33 or S34) | 8 | P2 | S34 | Stretch |

### EPIC-EXPORT — Exports

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| EXPORT-RICH-01-A | Structured JSON + enhanced CSV with metadata | 8 | P1 | S32 | Planned |
| EXPORT-PDF-01 | PDF signed session summary | 8 | P1 | S33 | Planned |

### EPIC-ENT — Enterprise

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| ANON-DEPTH-01 | Zero-knowledge mode session config + trust badge | 5 | P0 | S31 | Planned |
| SCALE-PROOF-01 | Enterprise participant scaling evidence + GTM claims | 8 | P1 | S32 | Planned |
| ANON-DEPTH-02 | Trust documentation + Vevox competitive proof | 5 | P1 | S34 | Planned |
| ENT-RESIDENCY-01 | EU routing evidence + DPA template | 8 | P0 | S34 | Planned |
| COMPLIANCE-01 | SOC 2 evidence framework + sub-processor registry | 5 | P1 | S33 | Planned |
| COMPLIANCE-02 | DPA/SCC template + compliance claim CI gate | 5 | P0 | S34 | Planned |
| GDPR-BADGE-01 | GDPR badge + deletion test + runbook | 5 | P1 | S34 | Planned |

### EPIC-AI — AI Depth

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| AI-RECAP-PROV-01 | AI recap provenance (edit history, model, timestamp, export) | 8 | P1 | S34 | Planned |
| AI-SENTIMENT-01 | Real-time session sentiment tracking (per-question mood signal) | 8 | P1 | S34 | Planned; MARKET-RESEARCH:AI-ENGAGEMENT |
| AI-COACHING-01 | Post-session facilitator coaching suggestions (stretch S34) | 5 | P2 | S34+ | Stretch |

### EPIC-DX — Developer Experience

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| CODE-SPLIT-01 | Split sessions.routes.ts (81 KB) into subrouters | 5 | P1 | S33 | Planned |
| PERF-PROOF-01 | Cloudflare latency benchmark data capture | 3 | P1 | S32 | Planned |
| ARCH-HONO-01 | Fix sub-app mount paths: energizers/gamification/ai-insights/help mount at `/api` root but own scoped prefixes; moving each to its actual prefix (e.g. `/api/sessions` for energizers) scopes their `app.use('*', authMiddleware)` wildcard correctly and eliminates ordering sensitivity in `app.ts` | 5 | P1 | S33 | Planned |
| ARCH-HONO-02 | Centralize auth policy in `app.ts`: replace distributed `app.use('*', authMiddleware)` inside sub-apps with explicit path-pattern registrations (`app.use('/api/sessions/*', authMiddleware)` etc.) — single source of truth for which routes are public vs protected; discovered via Growth Engine `/api/gallery` 401 incident (2026-05-22) | 8 | P2 | S34 | Planned |

### EPIC-OBS — Observability (Sprint 30 delivery)

| ID | Item | Pts | Pri | Sprint | Status |
|---|---|---:|---|---|---|
| OBS-VOTE-01 | ws.vote_submitted AE event with sessionId, teamId, plan, latency | 5 | P1 | S30 | ✅ Delivered |
| PRIVACY-GAM-01 | 21 privacy tests: energizer AE events + export payloads contain no PII | 3 | P0 | S30 | ✅ Delivered |
| ADMIN-OPS-02 | Hourly health correlation table: energizer activity vs WS errors/reconnects | 5 | P1 | S30 | ✅ Delivered |
| RES-DO-01 | DO WS outer try/catch + `do.storage_fault` event | 3 | P0 | S30 | ✅ Delivered |
| SEC-CSV-01 | CSV formula-injection guard (`lib/csv.ts`) | 2 | P0 | S30 | ✅ Delivered |
| COMPLIANCE-02 | Compliance claim CI gate (`check:compliance-claims`) | 5 | P0 | S31 | ✅ MVP script; DPA template pending |
| ADR-0012 | Route → Service → Repository boundaries | 3 | P0 | S32 | Proposed — `knowledge-base/adr/ADR-0012-route-service-repository.md` |

### Sprint 35–39 Story Registry (added 2026-05-22)

| ID | Item | Pts | Pri | Sprint |
|---|---|---:|---|---|
| COMPLIANCE-03 | SOC 2 Type I audit engagement | 13 | P0 | S35 |
| ZOOM-01 | Zoom integration | 8 | P1 | S35 |
| EXPORT-PDF-01 | PDF/HTML signed session export | 8 | P1 | S35 |
| GAM-06 | Gamification analytics dashboard | 5 | P1 | S35 |
| ADR-0013 | Energizer strategy pattern ADR | 3 | P0 | S35 |
| BRAND-01 | Custom branding: logo + primary color | 8 | P1 | S36 |
| BRAND-02 | Branded participant join + session header | 8 | P1 | S36 |
| BRAND-03 | Branded exports + email templates | 5 | P1 | S36 |
| ADR-0016 | White-label scoping ADR | 3 | P0 | S36 |
| SEC-RATELIMIT-01 | Rate-limit fail-closed on KV failure | 3 | P0 | S36 |
| MOBILE-01 | PWA install + offline join cache | 5 | P1 | S37 |
| MOBILE-02 | Touch-optimized participant UI | 8 | P1 | S37 |
| MOBILE-03 | Presenter mobile controls | 8 | P1 | S37 |
| SF-01 | Salesforce session results push | 8 | P1 | S37 |
| SF-02 | Salesforce settings + field mapping | 8 | P1 | S37 |
| ADR-0015 | Mobile client contract ADR | 3 | P0 | S37 |
| SEC-WS-CAP-01 | Per-IP WebSocket connect cap | 2 | P1 | S37 |
| LDAP-01 | LDAP/AD directory sync | 13 | P1 | S38 |
| LDAP-02 | LDAP group → team role mapping | 8 | P1 | S38 |
| INT-WEBHOOK-02 | Workday + BambooHR webhook templates | 8 | P2 | S38 |
| ADR-0019 | LDAP/Salesforce sync model ADR | 3 | P0 | S38 |
| GAM-05 | Battle royale + bracket tournaments | 8 | P1 | S39 |
| GAM-05-QA | Tournament idempotency tests | 5 | P0 | S39 |
| AI-COACHING-01 | Post-session facilitator coaching | 5 | P1 | S39 |
| AI-COACHING-02 | Coaching UI in Insights | 5 | P1 | S39 |
| ADR-0017 | Tournament state machines ADR | 3 | P0 | S39 |
| ADR-0018 | KB RAG activation (ADR-040) | 3 | P0 | S39 |
| KB-RAG-01 | Agent grounding via DECISIONS_VECTORIZE | 8 | P2 | S39 |
| RC-V24-01 | v2.4 regression + release notes | 5 | P0 | S39 |

**Horizon plan:** [`SPRINT30_39_PLAN.md`](../planning/SPRINT30_39_PLAN.md)

---

### Sprint 60–70 — Post-v3.0 Platform Arc (added 2026-05-25)

**Master plan (all agents, 120–150 pts/sprint):** [`SPRINT60_70_PLAN.md`](../planning/SPRINT60_70_PLAN.md) — v3.1 (S60–62) → v3.2 (S63–66) → v4.0 (S67–70).

**Role deep-dives:** [`SPRINT60_70_INFRA_PLAN.md`](../planning/SPRINT60_70_INFRA_PLAN.md) (DEVOPS pool ~1,434 pts — **~25–35 pts committed per sprint**, not full catalog), [`QA_COMMITMENT_SPRINTS_60_70.md`](./QA_COMMITMENT_SPRINTS_60_70.md), [`I18N_SPRINT_60_70_PLAN.md`](../planning/I18N_SPRINT_60_70_PLAN.md), [`2026-05-25_sprint60-70-obs-analytics-proposals.md`](../../operations/monitoring/2026-05-25_sprint60-70-obs-analytics-proposals.md).

#### Sprint 60–70 Story Registry — Infrastructure Scale-Out (DEVOPS backlog pool)

_Added per DevOps planning horizon covering Sprints 60–70 (v3.1-infra → v3.4-infra): multi-region prod rollout, D1 sharding, SLO dashboards, staging parity, chaos drills, partner env isolation. **Groom ~25–35 pts/sprint from this pool per [`SPRINT60_70_PLAN.md`](../planning/SPRINT60_70_PLAN.md).**

**Infra detail:** [`SPRINT60_70_INFRA_PLAN.md`](../planning/SPRINT60_70_INFRA_PLAN.md)

#### EPIC-INFRA — Multi-Region (MR)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-MR-01 | Activate MULTI_REGION_ENABLED prod + health probe expansion | 5 | P0 | S60 | Planned |
| DEVOPS-MR-02 | EU D1 read replica binding + resolveReadRegion() routing | 13 | P0 | S60 | Planned |
| DEVOPS-MR-03 | Multi-region canary rollout + MULTI_REGION_REPLICA_PCT var | 8 | P0 | S60 | Planned |
| DEVOPS-MR-04 | Regional read path AE events (colo_id, read_region, durationMs) | 8 | P0 | S60 | Planned |
| DEVOPS-MR-05 | APAC D1 read replica binding + colo routing extension | 13 | P1 | S63 | Planned |
| DEVOPS-MR-06 | EU read failover runbook | 5 | P0 | S60 | Planned |
| DEVOPS-MR-07 | Cross-region session consistency check (EU lag measurement) | 8 | P1 | S61 | Planned |
| DEVOPS-MR-08 | /api/admin/multi-region/status endpoint | 8 | P0 | S61 | Planned |
| DEVOPS-MR-09 | Write-path audit: enforce US-primary for all mutations | 13 | P0 | S62 | Planned |
| DEVOPS-MR-10 | Multi-region read skew detection + Slack alerting | 8 | P1 | S63 | Planned |

#### EPIC-INFRA — D1 Sharding (DB)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-DB-01 | D1 sharding ADR review + wrangler.toml binding schema design | 8 | P0 | S60 | Planned |
| DEVOPS-DB-02 | D1 shard 0 + shard 1 bindings (prod + staging) | 13 | P0 | S61 | Planned |
| DEVOPS-DB-03 | Hash-based shard router service (lib/db/shard-router.ts) | 13 | P0 | S61 | Planned |
| DEVOPS-DB-04 | Shard health probes in /api/admin/health | 8 | P0 | S61 | Planned |
| DEVOPS-DB-05 | Cross-shard admin aggregation queries | 13 | P1 | S63 | Planned |
| DEVOPS-DB-06 | Tenant-to-shard assignment + migration toolkit | 13 | P0 | S65 | Planned |
| DEVOPS-DB-07 | Per-shard R2 backup cron | 8 | P1 | S61 | Planned |
| DEVOPS-DB-08 | Per-shard AE events + SLO dashboard entry | 8 | P1 | S63 | Planned |
| DEVOPS-DB-09 | Shard 2 (APAC) binding + routing extension | 13 | P1 | S64 | Planned |
| DEVOPS-DB-10 | D1 shard forward-fix protocol | 8 | P1 | S61 | Planned |

#### EPIC-INFRA — SLO Dashboards (SLO)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-SLO-01 | SLO dashboard v1: vote latency P50/P95/P99 | 8 | P0 | S60 | Planned |
| DEVOPS-SLO-02 | API availability SLO + 28-day error budget | 8 | P0 | S60 | Planned |
| DEVOPS-SLO-03 | D1 query latency SLO (P95 ≤ 50ms) | 5 | P1 | S60 | Planned |
| DEVOPS-SLO-04 | WebSocket connect latency SLO (P95 ≤ 200ms) | 5 | P1 | S60 | Planned |
| DEVOPS-SLO-05 | SLO alerting: Slack when error budget ≥80% consumed | 8 | P0 | S61 | Planned |
| DEVOPS-SLO-06 | Per-region SLO breakdown (EU vs US vs APAC) | 8 | P1 | S62 | Planned |
| DEVOPS-SLO-07 | SLO v2: composite multi-service SLO | 8 | P1 | S62 | Planned |
| DEVOPS-SLO-08 | SLO burn rate alerts (1h + 6h multi-window) | 5 | P0 | S61 | Planned |
| DEVOPS-SLO-09 | SLO documentation + on-call response thresholds | 8 | P1 | S60 | Planned |
| DEVOPS-SLO-10 | Monthly SLO report automation (cron → Slack + R2) | 5 | P2 | S63 | Planned |

#### EPIC-INFRA — Staging Parity (STG)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-STG-01 | Staging multi-region flag + EU D1 binding parity | 5 | P0 | S60 | Planned |
| DEVOPS-STG-02 | Staging D1 shard bindings (shard 0 + 1) | 8 | P0 | S61 | Planned |
| DEVOPS-STG-03 | Staging partner namespace isolation | 8 | P1 | S63 | Planned |
| DEVOPS-STG-04 | Staging chaos injection flag support | 8 | P1 | S62 | Planned |
| DEVOPS-STG-05 | wrangler.toml staging/prod drift CI gate | 5 | P0 | S60 | Planned |
| DEVOPS-STG-06 | Automated staging → prod promotion pipeline | 8 | P1 | S62 | Planned |
| DEVOPS-STG-07 | Staging full multi-region parity (EU + US replicas) | 13 | P1 | S63 | Planned |
| DEVOPS-STG-08 | Staging seed data pipeline (anonymized snapshot) | 5 | P2 | S64 | Planned |
| DEVOPS-STG-09 | Staging SLO dashboard (relaxed targets) | 8 | P1 | S64 | Planned |

#### EPIC-INFRA — Chaos Engineering (CHX)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-CHX-01 | Chaos library v1: D1 latency injection (withChaosD1) | 13 | P0 | S62 | Planned |
| DEVOPS-CHX-02 | Chaos drill: KV timeout simulation (CHAOS_KV_FAIL_RATE) | 8 | P1 | S62 | Planned |
| DEVOPS-CHX-03 | Chaos drill: DO restart under load | 8 | P1 | S62 | Planned |
| DEVOPS-CHX-04 | Chaos drill: multi-region read failover (EU kill → US fallback) | 13 | P0 | S63 | Planned |
| DEVOPS-CHX-05 | Chaos drill runbook template + evidence format | 5 | P0 | S61 | Planned |
| DEVOPS-CHX-06 | Chaos drill CI gate (monthly cron + Slack) | 5 | P1 | S64 | Planned |
| DEVOPS-CHX-07 | Chaos drill: Stripe circuit breaker trip + recovery | 8 | P1 | S62 | Planned |
| DEVOPS-CHX-08 | Chaos drill: AI inference timeout simulation | 8 | P1 | S64 | Planned |
| DEVOPS-CHX-09 | Chaos drill: D1 shard failure (one shard down) | 8 | P1 | S65 | Planned |

#### EPIC-INFRA — Partner Env Isolation (PRT)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-PRT-01 | Partner D1 provisioning runbook + wrangler.toml template | 13 | P0 | S63 | Planned |
| DEVOPS-PRT-02 | Partner KV namespace isolation pattern | 8 | P1 | S63 | Planned |
| DEVOPS-PRT-03 | Partner routing middleware (X-Partner-Org → binding) | 13 | P0 | S64 | Planned |
| DEVOPS-PRT-04 | Partner secret management (per-partner JWT_SECRET) | 8 | P0 | S64 | Planned |
| DEVOPS-PRT-05 | Partner onboarding runbook (provision → deploy → smoke) | 5 | P0 | S63 | Planned |
| DEVOPS-PRT-06 | Partner observability (partner_id AE dimension) | 8 | P1 | S63 | Planned |
| DEVOPS-PRT-07 | Partner staging sandbox (demo env) | 13 | P1 | S64 | Planned |
| DEVOPS-PRT-08 | Partner SLO tracking (per-org breakdown) | 8 | P1 | S65 | Planned |
| DEVOPS-PRT-09 | Partner backup isolation (per-partner R2 prefix) | 8 | P1 | S65 | Planned |
| DEVOPS-PRT-10 | Partner decommission runbook | 5 | P2 | S66 | Planned |

#### EPIC-INFRA — CI/CD (CI)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-CI-01 | Vitest shard split (--shard=N/4, CI parallelism) | 5 | P1 | S60 | Planned |
| DEVOPS-CI-02 | Production deploy canary gate (CF traffic split) | 8 | P0 | S61 | Planned |
| DEVOPS-CI-03 | Multi-region deploy pipeline (US → EU → APAC staged) | 8 | P1 | S62 | Planned |
| DEVOPS-CI-04 | Commit SHA injection fix (COMMIT_SHA from git rev-parse) | 5 | P0 | S60 | Planned |
| DEVOPS-CI-05 | Blue/green deploy for Pages Functions | 8 | P1 | S62 | Planned |
| DEVOPS-CI-06 | Post-deploy automated smoke tests + rollback trigger | 5 | P0 | S61 | Planned |

#### EPIC-INFRA — Observability (OBS)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-OBS-01 | x-trace-id propagation to R2 log tail + AE events | 8 | P0 | S60 | Planned |
| DEVOPS-OBS-02 | CF AE real-time infra health AQL dashboard library | 8 | P1 | S61 | Planned |
| DEVOPS-OBS-03 | Per-region latency heatmap (colo-level AE grouping) | 8 | P1 | S62 | Planned |
| DEVOPS-OBS-04 | AQL on-call emergency query playbook | 5 | P1 | S60 | Planned |
| DEVOPS-OBS-05 | Partner-scoped observability (partner_id on all AE events) | 8 | P1 | S63 | Planned |

#### EPIC-INFRA — Security/Secrets (SEC)

| ID | Item | Pts | Pri | Sprint | Status |
|----|------|-----|-----|--------|--------|
| DEVOPS-SEC-01 | Secret rotation automation (quarterly reminder + wrangler script) | 8 | P1 | S62 | Planned |
| DEVOPS-SEC-02 | R2 cross-region backup EU replication | 8 | P0 | S60 | Planned |
| DEVOPS-SEC-03 | OAUTH_TOKEN_MEK rotation procedure + staging test | 5 | P0 | S61 | Planned |
| DEVOPS-SEC-04 | Secrets-in-vars CI audit check | 5 | P0 | S60 | Planned |

#### Sprint Summary Table

| Sprint | Pts | Theme |
|--------|-----|-------|
| S60 | 130 | Multi-region prod activation + SLO foundation + CI baseline |
| S61 | 135 | D1 shard bindings v1 + canary deploy gate + SLO alerting |
| S62 | 128 | Chaos library v1 + SLO v2 + blue-green deploy + write-path audit |
| S63 | 136 | APAC replica + cross-shard queries + partner env design |
| S64 | 130 | Partner env isolation v1 + D1 shard 3 + chaos CI gate |
| S65 | 134 | D1 write sharding + tenant migration + partner SLO/backup |
| S66 | 125 | Partner decommission + multi-region write routing + chaos shard |
| S67 | 130 | SLO automation + error budget + staging full parity |
| S68 | 128 | Partner secret hardening + infra health dashboard v2 |
| S69 | 130 | Global deploy pipeline + APAC failover + chaos monthly gate |
| S70 | 128 | Infra hardening + runbook finalization + v3.4-infra release |
| **Total** | **1,434** | |

**Dependencies and gates:**
- ADR-0023 (D1 write sharding) must be accepted by architect before DEVOPS-DB-01 implementation starts.
- ADR-0024 (partner env isolation) must be accepted before DEVOPS-PRT-01 through PRT-10.
- DEVOPS-DB-03 (shard router) must land in S61 before any S62+ route migration to shards.
- DEVOPS-CHX-01 chaos library must be in staging before any chaos drill (CHX-02 through CHX-09).
- `MULTI_REGION_REPLICA_PCT` must reach 100% before DEVOPS-MR-09 write-path audit can be treated as complete.
- Per SPRINT60_70_INFRA_PLAN.md: multi-region D1 sharding was explicitly out-of-scope for S30–S39 (SPRINT30_39_PLAN.md line 199); S60 is the correct activation window.

---

### Sprint 60–70 Story Registry — Frontend v3.0 (added 2026-05-25)

_Added per frontend agent review of S41 PWA specs, S36 white-label APIs, admin analytics maturity, and MARKET PULSE trust/scale signals (May 19, 2026)._

**Full plan:** [`SPRINT60_70_FRONTEND_PROPOSAL.md`](../planning/SPRINT60_70_FRONTEND_PROPOSAL.md) — **1,424 pts total, 120–150 pts/sprint, 3–4 parallel frontend engineers**

**New i18n namespaces (EN first; NL/DE/FR/ES completed in S69):**
`mobile.json` (~180 keys), `branding.json` (~70 keys), `partner.json` (~145 keys), `trust.json` (~60 keys), `developer.json` (~65 keys), `compliance.json` (~80 keys)

**New ADR required:** ADR-0020 (PWA Push Notification Architecture) — must be accepted before S68.

#### Sprint Summary Table (Frontend S60–S70)

| Sprint | Pts | Theme | Release |
|--------|-----|-------|---------|
| S60 | 128 | Mobile PWA v3: app shell, offline UX, install flow, push scaffold | v3.0-alpha |
| S61 | 132 | White-label v3: brand configurator, live preview, custom domain, email | v3.0-alpha |
| S62 | 134 | Admin analytics v3: time-series dashboard, funnel, plan signals, export center | v3.0-alpha |
| S63 | 123 | Trust badges + scale proof: GDPR/ZK/SOC2 badge system, 10k proof page | v3.0-alpha |
| S64 | 125 | Mobile presenter controls v3 + partner portal foundation + sandbox UI | v3.0-beta |
| S65 | 132 | Developer portal: API key management, webhook event log, API docs frame | v3.0-beta |
| S66 | 139 | Enterprise compliance dashboard: SOC2 tracker, GDPR timeline, DPA, forensic | v3.0-beta |
| S67 | 128 | Partner integration configurator: OAuth app, field mapping, test events, LDAP | v3.0-beta |
| S68 | 126 | PWA push inbox, notification preferences, background sync UX | v3.0 |
| S69 | 123 | i18n completeness (6 ns × 5 locales) + full WCAG 2.1 AA audit sweep | v3.0 |
| S70 | 134 | Release polish: motion, empty states, E2E QA, marketing surfaces, release notes | v3.0 🚀 |
| **Total** | **1,424** | | |

**Key gates:**
- BRAND-01/02/03 APIs (✅ S36) unblock BRAND3-CONF-01 (S61)
- MOBILE-PWA-02 SW v2 (✅ S41) unblocks PWA3-SW-01, PWA3-PUSH-* (S60)
- ANON-DEPTH-01 ZK API (planned S31) unblocks TRUST3-ZK-* (S63)
- AI-COACHING-MATURITY-01 (✅ S42) unblocks ENT3-COACHING-UX-01 (S66)
- AUDIT-EXPORT-FORENSIC-01 (✅ S42) unblocks ENT3-FORENSIC-01 UI (S66)
- ADR-0020 (push architecture, new) must be accepted before S68

---

### Sprint 71–80 — Post-v4.0 Platform Maturity Arc (added 2026-05-27)

**Master plan (all agents, 120–150 pts/sprint):** [`SPRINT71_80_PLAN.md`](../planning/SPRINT71_80_PLAN.md) — v4.1 (S71–S73) → v4.2 (S74–S76) → v5.0-rc (S77–S79) → v5.0 GA (S80).

**Role deep-dives:** [`SPRINT71_80_INFRA_PLAN.md`](../planning/SPRINT71_80_INFRA_PLAN.md) (312 pts DevOps committed across S71–S80, ~28–35 pts/sprint), [`QA_COMMITMENT_SPRINTS_71_80.md`](./QA_COMMITMENT_SPRINTS_71_80.md), [`I18N_SPRINT_71_80_PLAN.md`](../planning/I18N_SPRINT_71_80_PLAN.md), [`MARKETING_SPRINTS_71_80.md`](../marketing/MARKETING_SPRINTS_71_80.md), [`SPRINT71_80_FRONTEND_PROPOSAL.md`](../planning/SPRINT71_80_FRONTEND_PROPOSAL.md).

**Ten epics:** E71 Experience GA · E72 Event & Integrator · E73 Engagement Reliability · E74 Enterprise Identity · E75 Scale & Sovereignty · E76 Intelligent Facilitation · E77 Platform Isolation · E78 Trust & Forensics · E79 Realtime & Gov Cloud · E80 Platform Certification.

#### Sprint 71–80 — Agent consensus story registry (product)

| ID | Item | Pts | Pri | Sprint | Notes |
|----|------|-----|-----|--------|-------|
| `DARK-MODE-GA-01` | Full dark mode token layer + core surfaces | 13 | P0 | S71–S72 | Deferred from S60–S70 frontend |
| `ZOOM-EMBED-01` | Zoom in-meeting embed + sync | 21 | P0 | S72 | Market pulse — event GTM |
| `SCALE-PROOF-100K-01` | 100k voter load evidence doc | 21 | P0 | S75 | Replaces 10k marketing cap |
| `RESIDENCY-ENFORCE-01` | EU-only tenant pinning enforce | 13 | P0 | S75 | ADR-0036 dependency |
| `AI-COPILOT-MULTITURN-01` | Multi-turn facilitator copilot GA | 21 | P0 | S76 | Workers AI only |
| `AI-COPILOT-EDGE-01` | Edge-native copilot inference path | 21 | P0 | S77 | ADR-0039 |
| `AUDIT-API-QUERY-01` | Forensic audit query API | 21 | P0 | S78 | Enterprise forensics |
| `REALTIME-V3-PROTOCOL-01` | Delta broadcast wire format | 21 | P0 | S79 | ADR-0038 |
| `FEDRAMP-INITIAL-ATO-01` | FedRAMP Moderate control mapping (path) | 21 | P1 | S79 | Docs only; no full ATO |
| `PLATFORM-CERTIFICATION-01` | v5.0 GA certification bundle | 16 | P0 | S80 | SOC2 Type II + DR evidence |
| `SEC-PEN3-01` | Pentest #3 engagement | 13 | P0 | S71–S72 | Security track |
| `SEC-CMK-01` | Customer-managed keys envelope | 13 | P0 | S78 | ADR-0041 |
| `SEC-BREACH-01` | GDPR Art. 33 breach automation | 13 | P0 | S79 | |
| `TENANT-COST-01` | Per-tenant cost attribution model | 13 | P0 | S74 | ADR cost metering |
| `WEBHOOK-DELIVERY-SLA-01` | Webhook 99.95% delivery SLA | 13 | P0 | S78 | Partner ecosystem |
| `FE-DEV2-OAS-01` | Developer portal v2 OpenAPI explorer | 13 | P0 | S73 | |
| `LOAD-FRAMEWORK-71` | k6 load harness + 50k path | 8 | P0 | S71 | QA/DevOps |
| `ANON-DEPTH-04` | Anonymous mode depth (Vevox parity) | 8 | P1 | S75 | Market pulse |

**AI stories AI-401–AI-440:** Groomed in [`SPRINT71_80_PLAN.md`](../planning/SPRINT71_80_PLAN.md) per-sprint tables (copilot schema S71 → L4 maturity closeout S80).

**Hard gate:** ADR-0035 (SessionRoom DO split) and ADR-0036 (MR write GA) must **not** land in the same sprint.

---

### Sprint 81–90 — Post-v5.0 Platform Expansion Arc (added 2026-06-01)

**Master plan (all agents, 120–150 pts/sprint):** [`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) — v5.1 (S81–S83) → v5.2 (S84–S86) → v6.0-rc (S87–S89) → v6.0 GA (S90).

**Role deep-dives:** [`SPRINT81_90_INFRA_PLAN.md`](../planning/SPRINT81_90_INFRA_PLAN.md), [`QA_COMMITMENT_SPRINTS_81_90.md`](./QA_COMMITMENT_SPRINTS_81_90.md), [`I18N_SPRINT_81_90_PLAN.md`](../planning/I18N_SPRINT_81_90_PLAN.md), [`MARKETING_SPRINTS_81_90.md`](../marketing/MARKETING_SPRINTS_81_90.md), [`SPRINT81_90_FRONTEND_PROPOSAL.md`](../planning/SPRINT81_90_FRONTEND_PROPOSAL.md), [`SPRINT81_90_BACKEND_PROPOSAL.md`](../planning/SPRINT81_90_BACKEND_PROPOSAL.md), [`SPRINT81_90_ARCH_NOTES.md`](../planning/SPRINT81_90_ARCH_NOTES.md), [`SPRINT81_90_SECURITY_PLAN.md`](../planning/SPRINT81_90_SECURITY_PLAN.md), [`SPRINT81_90_AI_PLAN.md`](../planning/SPRINT81_90_AI_PLAN.md), [`SPRINT81_90_ANALYTICS_PLAN.md`](../planning/SPRINT81_90_ANALYTICS_PLAN.md), [`MARKET_VALIDATION_S81_90.md`](../research/MARKET_VALIDATION_S81_90.md).

**Ten epics:** E81 Native Mobile GA · E82 Marketplace Economy · E83 Agentic Facilitation · E84 Town Hall & Hybrid Events · E85 Continuous Collaboration · E86 Verifiable Governance · E87 Embeddable Platform · E88 Adaptive Experience & AAA · E89 Gov Cloud & Full ATO · E90 Platform v6.0 Certification.

#### Sprint 81–90 — Agent consensus story registry (product)

| ID | Item | Pts | Pri | Sprint | Notes |
|----|------|-----|-----|--------|-------|
| `NATIVE-SHELL-01` | Capacitor iOS/Android shell + native push | 13 | P0 | S81 | ADR-0044; deferred from S81+ |
| `NATIVE-GA-01` | iOS/Android app store release | 13 | P0 | S82 | TestFlight + Play internal GA |
| `MARKETPLACE-CONNECT-01` | Stripe Connect payout + revenue share | 13 | P0 | S82 | 🟡 Foundation shipped (S82) — `routes/marketplace-connect.ts` (account link + verification poll + payout stub), `lib/stripe-connect.ts`, `lib/marketplace-billing.ts`, migration `0049 partner_payment_accounts` (MARKETPLACE-BILLING-SPIKE-02). Needs live Stripe Connect secret + paid-listing UX (MARKETPLACE-PAID-LISTING-01, S83) |
| `MARKETPLACE-PAID-LISTING-01` | Paid plugin/template listings + KYC | 13 | P0 | S83 | Marketplace economy GA |
| `AGENT-RUNTIME-01` | AgentRunDO + agent runtime GA | 21 | P0 | S83 | ADR-0046; autonomous facilitation |
| `AGENT-MARKETPLACE-01` | Agent marketplace + safety eval | 21 | P0 | S84 | Deferred from S81+ |
| `TOWNHALL-QUEUE-01` | Moderated anonymous Q&A at scale | 21 | P0 | S84 | COMPETITIVE_EPICS E84; ADR-0047 |
| `STAGE-SUITE-01` | Hybrid-event engagement suite | 13 | P1 | S85 | ✅ Shipped (S85) — `routes/{stage-sessions,event-suite,event-presenter,event-agenda}.ts`, `lib/event-*.ts`; `workspace.kind='event'`. COMPETITIVE_EPICS E84 foundation |
| `RETRO-WORKSPACE-01` | RETRO recurring workspace GA | 21 | P0 | S85 | ✅ Shipped (S85) — ADR-0048 **accepted**; `workspaces`/`workspace_trend`/session-linkage schema, `routes/team-workspaces.ts` (CRUD + instances + history + trends + refresh), `lib/workspace-{trends,instances,actions,rbac}.ts`, **Tier-2 trend cron** in `worker/index.ts`. COMPETITIVE_EPICS E85 |
| `IDEATE-BOARD-01` | IDEATE brainstorm + prioritization | 13 | P1 | S85–S86 | ✅ Shipped (S86) — backend (S85) `routes/ideate-sessions.ts`, `lib/session-room-ideate*.ts`, `lib/ideate-cluster.ts`; **FE board (S86, FE-IDEATE-BOARD-01)** `src/ui/IdeateFacilitatorBoard.tsx` (dot-vote + cluster + ranking, WCAG AA), `src/pages/IdeateBoardPage.tsx` (route `/sessions/:id/ideate/board`, SessionRoom WS). COMPETITIVE_EPICS E85 |
| `DELIBERATE-RECEIPT-01` | Cryptographic governance receipt + tally | 21 | P0 | S86 | ✅ Foundation shipped (S86) — ADR-0049 **accepted**; `lib/deliberate-crypto.ts` (coercion-resistant SHA-256 commitments + Merkle tally), `routes/deliberate-sessions.ts` (config/cast/verify/tally), migration `0054_deliberate_ballots` (append-only anonymous ledger), `verifiableVoting` entitlement (Team). Tests: `deliberate-crypto`, `deliberate-config-route`. LIVE board + re-tally tooling = `DELIBERATE-GA-01`/`DELIBERATE-RETALLY-01` (S87). COMPETITIVE_EPICS E86 |
| `DELIBERATE-GA-01` | DELIBERATE governance GA + LIVE board | 21 | P0 | S87 | ✅ Shipped (S87) — `routes/deliberate-sessions.ts` (extended LIVE handlers), `lib/session-room-deliberate-handler.ts` (vote submission + ledger append + Merkle update + forensics alert), `src/pages/DeliberateLiveBoard.tsx` (WCAG AA presenter/participant views), `src/ui/DeliberateResultsOverlay.tsx` (Merkle tally + re-tally export). Voter coercion-resistance via UNIQUE(`session_id`, `voter_hash`). Tests: `deliberate-sessions.test.ts`, `session-room-deliberate-handler.test.ts`. |
| `DELIBERATE-RETALLY-01` | Independent observer re-tally + public tally endpoint | 13 | P1 | S87 | ✅ Shipped (S87) — `/api/sessions/:id/deliberate/tally` now **public** (no auth); returns commitments + Merkle root + vote count. `lib/deliberate-ledger.ts` recomputation. Browser-based verifier: `public/deliberate-tally-verify.html` (offline re-tally). Resolves S86 M-3 follow-up (ADR-0049 §5 guarantee). |
| `FE-EMBED-PLAYGROUND-01` | Embed config console + SDK preview | 13 | P1 | S87 | ✅ Shipped (S87) — `src/pages/EmbedPlayground.tsx` (session + origin allowlist + token generation), `src/components/EmbedPreview.tsx` (live tally preview), `public/embed/qesto-embed.js` (SDK init, postMessage, 180 lines). Routes: `/embed/playground` + `/embed/preview`. Realtime preview with iFrame postMessage connection. |
| `SEC-EMBED-ORIGIN-01` | EMBED security review (OWASP + STRIDE) | — | P0 | S87 | ✅ Shipped (S87) — `security/SEC_EMBED_ORIGIN_01_REVIEW.md` (CLEAR-WITH-FOLLOWUPS). Headline guarantee: de-anon **structurally closed** (aggregate-only read plane, no per-participant field). Token security sound (HMAC timing-safe, TTL clamped, origin-pinned, revocation override). Three Medium findings carried to S88 (SEC-PEN5-01): M-1 rate limit, M-2 tenancy semantics, M-3 handshake session-pin. No Critical/High blocks EMBED GA. |
| `SEC-PEN5-PREP-01` | Pentest #5 scope + threat model (governance + embed + agent) | — | P0 | S87 | ✅ Shipped (S87) — `security/SEC_PEN5_PREP.md` (1200+ lines). Three surfaces: DELIBERATE (6 threats), EMBED (9 threats), agent (7 threats). Open items: M-1/M-2 DELIBERATE (S88), M-1/M-2/M-3 EMBED (S88). Pentest runs S87–S89; crit/high = 0 gate for v6.0 RC. |
| `CONTRACT-EMBED-SDK-01` | Contract tests for EMBED SDK (QA) | 8 | P0 | S87 | ✅ Shipped (S87) — `tests/unit/embed-routes.test.ts` (47 cases): token lifecycle, origin enforcement, handshake de-anon, CORS/CSRF, read-plane aggregate proofs. All green. |
| `MKTG-87-01` | EMBED positioning + marketing content | 14 | P0 | S87 | ✅ Shipped (S87) — `knowledge-base/marketing/EMBED_ICP_AND_POSITIONING.md` (developer ICP, moat), `EMBED_HUB_CONTENT.md` (guide + success stories). `/solutions/embed` landing, integration templates, onboarding flowchart. |
| `AI-461` | Copilot live context (aggregate-only, k-anonymity) | 8 | P1 | S87 | ✅ Shipped (S87) — `lib/copilot-live-context.ts` (mood aggregate, k≥5 gate, ZK suppression). No per-voter fields. Prompt system fence: `<<<UNTRUSTED_SESSION_DATA>>>`. Tests: `tests/eval/copilot-live-context.eval.test.ts` (8 cases). |
| `AI-462` / `AI-463` / `AI-464` | Copilot source attribution + audit provenance | — | P1 | S87 | ✅ Shipped (S87) — `lib/copilot-suggest.ts` (AI-462 `source` field, AI-463 `promptVersion`, AI-464 audit trail). Enables "AI-generated" disclosure + prompt history. |
| `I18N` | Deliberate + EMBED i18n (5 locales) | — | P1 | S87 | ✅ Shipped (S87) — `public/locales/{nl,de,es,fr}/deliberate.json` (commitment language, verification, tally). EMBED playground labels (5 locales). All `ci:check-missing-keys` green. |
| `EMBED-SDK-01` | Engagement SDK + widget API | 21 | P0 | S87 | ✅ **DONE (S87)** — ADR-0050 **accepted**; `routes/embed.ts` (mint plane: token creation + origin allowlist), `routes/embed-widget-v1.ts` (read plane: aggregate-only), `middleware/widget-token.ts` + `lib/embed-token.ts` (HMAC auth + origin binding), `repositories/embedWidgetRepository.ts` (all aggregate accessors), migration `0055_embed_widgets` (devops prerequisite). Tests: `tests/unit/embed-routes.test.ts` (CONTRACT-EMBED-SDK-01, 47 cases). COMPETITIVE_EPICS E87 |
| `EMBED-WIDGET-API-01` | Public read plane (handshake + state + results) | 13 | P0 | S87 | ✅ **DONE (S87)** — `routes/embed-widget-v1.ts` aggregate-only endpoints; origin-bound token middleware; zero PII in response. Sandbox verified in `SEC_EMBED_ORIGIN_01_REVIEW.md`. |
| `DELIBERATE-GA-01` | Governance GA + LIVE board | 21 | P0 | S87 | ✅ **DONE (S87)** — `lib/session-room-deliberate-handler.ts` (WS routing), `src/pages/DeliberateLiveBoard.tsx` (WCAG AA), coercion-resistant voting, UNIQUE voter constraint, forensics alert on tamper. |
| `DELIBERATE-RETALLY-01` | Public re-tally + observer verify | 13 | P1 | S87 | ✅ **DONE (S87)** — `/api/sessions/:id/tally` public; `lib/deliberate-ledger.ts` recomputation; browser verifier `public/deliberate-tally-verify.html`. Resolves S86 M-3. |
| `FE-EMBED-PLAYGROUND-01` | Config console + SDK preview | 13 | P1 | S87 | ✅ **DONE (S87)** — `src/pages/EmbedPlayground.tsx`, `public/embed/qesto-embed.js` (SDK), realtime iframe preview. Routes `/embed/playground` + `/embed/preview`. |
| `SEC-EMBED-ORIGIN-01` | Security audit (OWASP + STRIDE) | — | P0 | S87 | ✅ **DONE (S87)** — `security/SEC_EMBED_ORIGIN_01_REVIEW.md` CLEAR-WITH-FOLLOWUPS; de-anon structurally closed; M-1/M-2/M-3 Medium findings carried to S88. |
| `SEC-PEN5-PREP-01` | Pentest #5 prep (gov + embed + agent) | — | P0 | S87 | ✅ **DONE (S87)** — `security/PENTEST_5_PREP.md` (scope, threat models, test checklist). Prep complete; pentest runs S87–S89. |
| `CONTRACT-EMBED-SDK-01` | Contract tests (QA) | 8 | P0 | S87 | ✅ **DONE (S87)** — `tests/unit/embed-routes.test.ts` (47 cases, all green). Token lifecycle, de-anon, IDOR, CORS/CSRF proofs. |
| `MKTG-87-01` | EMBED positioning + content | 14 | P0 | S87 | ✅ **DONE (S87)** — `EMBED_ICP_AND_POSITIONING.md`, `EMBED_HUB_CONTENT.md`. `/solutions/embed` landing, integration guide, sales brief. |
| `AI-461` | Copilot live context (k-anonymity) | 8 | P1 | S87 | ✅ **DONE (S87)** — `lib/copilot-live-context.ts`, k≥5 mood gate, ZK suppression. Tests: 8 eval cases. |
| `AI-462` / `AI-463` / `AI-464` | Source + version + audit provenance | — | P1 | S87 | ✅ **DONE (S87)** — `lib/copilot-suggest.ts` extended (source field, promptVersion, audit trail). Enables "AI-generated" disclosure. |
| `ADR-0050` | Embeddable SDK auth + origin sandboxing | — | P0 | S87 | ✅ **DONE (S87)** — `adr/ADR-0050-*.md` (1800+ lines) accepted. Origin-bound tokens, aggregate-only read, no per-participant field leak by construction. |
| `CANVAS-THEME-01` | Theme system + adaptive dataviz | 13 | P1 | S88 | ✅ **DONE (S88)** — `CanvasThemeProvider` + `useCanvasTheme` + `CanvasThemePicker`; built-in themes (default/dark/high-contrast/brand-neutral) as CSS-var token sets (`styles/canvas-themes.css`), persisted, applied at Display/Present roots. High-contrast = AAA 7:1. COMPETITIVE_EPICS E88 |
| `CANVAS-ADAPTIVE-VIZ-01` | Adaptive results visualization | 13 | P0 | S88 | ✅ **DONE (S88)** — `src/components/AdaptiveVizResults.tsx`; viz adapts to option count/kind/distribution, inherits theme tokens, reduced-motion + responsive. Tests: `adaptive-viz-selection.test.ts`. |
| `CAPTIONS-PIPELINE-01` | Live captions/translation (Workers AI) | 21 | P0 | S88 | ✅ **DONE (S88)** — ADR-0051 **accepted**; `lib/ai/captions-ai.ts` (Whisper ASR + M2M100 MT, circuit-broken, Zod-validated), `lib/captions-config.ts` (5-locale matrix, WER bar 0.25, fan-out bound), `lib/captions-pipeline.ts`, `lib/session-room-captions-handler.ts`, `routes/captions.ts`. No audio/transcript persisted (test-asserted). `caption_segment` WS + `liveCaptions` FeatureKey. WER sign-off/GA = S89. COMPETITIVE_EPICS E88 |
| `FE-CAPTIONS-OVERLAY-01` | Captions overlay UI (AAA) | 13 | P1 | S88 | ✅ **DONE (S88)** — `CaptionsOverlay` (scrim → ~12.7:1 over any theme, partial→final merge, resizable, `aria-live`), `CaptionsLocalePicker`, presenter start/stop toggle (plan-gated). Tests: `captions-overlay.test.ts` (24). |
| `AI-465`–`AI-470` | Captions ASR+MT quality evals | 24 | P1 | S88 | ✅ **DONE (S88)** — `tests/eval/captions-quality.eval.test.ts` (16) + ASR/MT golden fixtures; WER≤0.25 gate; enabled-pair map asserted against the bar. New eval baseline (REV-10). |
| `FE-AAA-GA-01` | WCAG AAA core flows | 13 | P0 | S88–S89 | ✅ **DONE (S88, core flows)** — join→vote→results + presenter present brought to AAA (1.4.6 7:1, 2.4.8/2.4.9, 1.4.8 resizable, focus visibility, `aria-live`). Scope in `AAA_CONFORMANCE_S88.md` (core AAA, broader AA). Re-attest new captions/canvas UIs at S89. |
| `MKTG-88-01` | Accessibility + multilingual positioning | 14 | P1 | S88 | ✅ **DONE (S88)** — `ACCESSIBILITY_MULTILINGUAL_POSITIONING.md` + `CAPTIONS_LAUNCH_BRIEF.md`; claims flagged `check:compliance-claims`; WCAG scope bounded. |
| `I18N-CAPTIONS-01` | Canvas + captions i18n (5 locales) | 13 | P1 | S88 | ✅ **DONE (S88)** — `{nl,de,es,fr}/canvas.json` (14 keys) + `{nl,de,es,fr}/captions.json` (16 keys), key-parity verified. |
| `ADR-0051` | Live captions/translation pipeline | — | P0 | S88 | ✅ **DONE (S88)** — `adr/ADR-0051-live-captions-translation-pipeline.md` accepted. Workers AI only, no audio/transcript egress, `caption_segment` contract, 5-locale WER-gated matrix. |
| `FEDRAMP-ATO-FULL-01` | FedRAMP Moderate full ATO path | 21 | P1 | S89 | ADR-0052; gov segment |
| `SOVEREIGN-TIER-01` | Sovereign data-plane tenant tier | 13 | P1 | S89 | Deferred from S81+ |
| `PLATFORM-CERTIFICATION-V6-01` | v6.0 GA certification bundle | 16 | P0 | S90 | DR evidence + compliance sign-off |
| `SEC-PEN4-01` | Pentest #4 (mobile + marketplace) | 13 | P0 | S81–S83 | Security track |
| `SEC-PEN5-01` | Pentest #5 (governance + embed + agent) | 13 | P0 | S87–S89 | ✅ **RUN (S88)** — `security/SEC_PEN5_01_RESULTS.md`: DELIBERATE CLEAR, EMBED FINDINGS, agent CLEAR; **overall crit/high = 0 (no v6.0 RC blocker)**. 3 Med / 6 Low carried; EMBED read-plane rate-limit must close by S89. Security track |
| `SEC-AGENT-EVAL-01` | Agent safety evaluation suite | 13 | P0 | S84 | Blocks agent marketplace public |

**AI stories AI-441–AI-480:** Groomed per-sprint in [`SPRINT81_90_AI_PLAN.md`](../planning/SPRINT81_90_AI_PLAN.md) (agent runtime schema S81 → agent maturity L4 closeout S90).

**Hard gate:** ADR-0046 (agent runtime GA) and ADR-0049 (verifiable-vote crypto) must **not** land in the same sprint — both high-risk trust surfaces; split Pentest #4/#5 scope.

---

### Sprint 91–99 — Net-new horizon toward v7.0 (9-day cadence; added 2026-06-11)

**Master plan:** [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) — re-bases the arc onto a **9-working-day** cadence (capacity retained 120–150 pts/sprint), carries S85–S90 (v6.0) re-spaced, and adds the net-new S91–S99 horizon. Story breakdown: [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md) (66 stories). Architecture: [`SPRINT85_99_ARCH_NOTES.md`](../planning/SPRINT85_99_ARCH_NOTES.md) (ADR-0054→0063). Market validation: [`MARKET_VALIDATION_S85_99.md`](../research/MARKET_VALIDATION_S85_99.md).

**Release map:** v6.1 GA (S92) → v6.2 GA (S95) → v7.0-rc (S97) → **v7.0 GA (S99)** — the "Engagement Intelligence Network."

**Eight net-new epics:** E91 REACTIONS GA · E92 PULSE · E93 COPILOT GA · E94 LEARN · E95 SOVEREIGN+ · E96 CONNECT · E97 STUDIO · E98 XR (beta).

#### Sprint 91–99 — Story registry (product; ~575 pts / 66 stories)

| Epic | Anchor stories (P0 unless noted) | Pts | Sprints | ADR | Release |
|------|----------------------------------|----:|---------|-----|---------|
| **E91 REACTIONS GA** | `REACTIONS-00`, `-CHANNEL-01`, `-TYPE-01`, `-BUDGET-01`, `-ABUSE-01`, `FE-REACTIONS-RENDER-01`, `QA-REACTIONS-LOAD-01`; `-ZEROK-01` (P1) | 68 | S91–S92 | ADR-0055 | v6.1 |
| **E92 PULSE** | `PULSE-00`, `-STORE-01`, `-LONGITUDINAL-01`, `-RETENTION-01`, `-AUDIT-01`, `SEC-PULSE-ISOLATION-01`; `-KANON-01`/`-AI-NARRATION-01`/`FE-PULSE-DASHBOARD-01` (P1) | 91 | S91–S93 | ADR-0057 | v6.2 |
| **E93 COPILOT GA** | `COPILOT-00`, `-RUNTIME-01`, `-TOOLS-01`, `-CHECKPOINT-01`, `SEC-COPILOT-SANDBOX-01`; `-CONTEXT-01`/`FE-COPILOT-PANEL-01` (P1) | 67 | S92–S93 | ADR-0056 | v6.1 |
| **E94 LEARN** | `LEARN-00` (EMBED gate), `-LTI-01`, `-GRADE-01`, `-SCORING-01`; `-TEMPLATES-01`/`FE-LEARN-INSTRUCTOR-01` (P1) | 61 | S93–S95 | ADR-0058 | v6.2 |
| **E95 SOVEREIGN+** | `SOVEREIGN-00`, `-REGIONS-01`, `-AUDIT-API-01`, `-EXCLUSION-01`, `SEC-SOVEREIGN-ISOLATION-01`; `-POSTURE-01` (P1) | 68 | S93–S95 | ADR-0052↑ / 0062 | v6.2 |
| **E96 CONNECT** | `CONNECT-00`, `-INVITE-01`, `-JOIN-01`, `-ZEROK-01`, `-ISOLATION-01`, `-SOVEREIGN-01`, `QA-CONNECT-SCALE-01`; `-AUDIT-01`/`FE-CONNECT-JOIN-UI-01` (P1) | 92 | S95–S97 | ADR-0059 / 0062 | v7.0-rc |
| **E97 STUDIO** | `STUDIO-00`, `-COPILOT-01`, `-THEME-01`, `SEC-STUDIO-PROMPT-01`; `-LIBRARY-01`/`-SUGGEST-01`/`FE-STUDIO-AUTHORING-01` (P1) | 81 | S96–S98 | ADR-0060 | v7.0 |
| **E98 XR (beta)** | `XR-00` (spike + kill-criterion, P0); `-SPATIAL-01`/`-AVATAR-01`/`-FALLBACK-01`/`FE-XR-LAUNCHER-01` (P1) | 47 | S98–S99 | [SLOT] | v7.0 beta |

Each epic carries a parallel `I18N-*-01` line (5 locales) and is grounded in reuse of the existing question engine, `DECISIONS_VECTORIZE`, anonymity modes, EMBED SDK, CANVAS, AgentRunDO, AUDIT-API, and `planMiddleware`. Full per-story acceptance signals in [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md).

**Do-not-co-land (hard gates):** ADR-0056 (agentic L2) ✗ ADR-0057 (analytics aggregation); ADR-0059 (egress) ✗ ADR-0060 (AI narration); ADR-0061 (agentic L3) ✗ any data-egress/analytics-AI GA; ADR-0062 (scale proof) ✗ ADR-0063 (v7.0 cert).

**Checkpoints:** (1) EMBED ≥10 live embeds before S93 LEARN commit, else defer LEARN to S96. (2) ADR-0057 accepted before S92 ends. (3) Pentest #6 (federation + autonomy + aggregation + egress) closed by S97. (4) XR kill-criterion: <1 design-partner by S98 week 2 → pivot to v7.1. (5) Sovereign tenants hard-excluded from CONNECT federation (D1 constraint).

#### Acceptance criteria — 5 critical new stories (S81–S90)

**NATIVE-GA-01: iOS/Android app store release (S82, 13 pts)**
- **Given** the Capacitor iOS build passes App Store Connect validation, **when** the host submits for TestFlight external testing, **then** testers download within 24h, the app reports version ≥ 5.1.0, the offline voter shell works without internet (quiz cached), and native push arrives ≤ 2s of question broadcast.
- **Given** the Android build passes Play Console validation, **when** published to the internal track, **then** the signature matches the production cert and offline responses sync on reconnect.
- **Given** localized store copy (EN/NL/ES/DE/FR), **when** listings go live per region, **then** screenshots/description render in the correct language with the WCAG AAA accessibility statement visible.
- **DoD:** ADR-0044 accepted; native push verified on physical devices; offline session recorded; ASO targets met (MKTG-82-01); no critical/high Pentest #4 findings.

**MARKETPLACE-CONNECT-01: Stripe Connect payout + revenue share (S82, 13 pts)**
- **Given** a CREATOR/MARKETPLACE_PARTNER, **when** they submit KYC, **then** Stripe Connect onboarding verifies identity and account → VERIFIED within 24h with a weekly payout schedule.
- **Given** a USD 50 listing at 70/30 split, **when** purchased, **then** the creator sees USD 35 pending, Qesto receives USD 15 within 24h, and the creator is paid on the next Friday.
- **Given** a creator with ≥1 paid template, **when** they open Marketplace Earnings, **then** the dashboard shows YTD earnings, transaction history, and the next-payout countdown.
- **DoD:** ADR-0045 accepted; legal/finance KYC + 1099 review; Stripe test-mode transfers verified; idempotent append-only ledger; earnings load ≤ 800ms.

**AGENT-RUNTIME-01: AgentRunDO + agent runtime GA (S83, 21 pts)**
- **Given** a DRAFT session, **when** the host enables the agent facilitator, **then** an AgentRunDO is reserved on publish with a read-only system-prompt preview.
- **Given** a LIVE session with the agent enabled, **when** a participant submits an open question, **then** the agent responds via `@cf/meta/llama-3.3-70b-instruct-fp8-fast` within 3s, tagged `[AI-Generated]`.
- **Given** a prompt-injection attempt, **when** the agent processes it, **then** it refuses, logs `AUDIT-AGENT-RESPONSE-UNSAFE`, and takes no out-of-sandbox action.
- **DoD:** ADR-0046 accepted; `SEC-AGENT-EVAL-01` green; ≥100 concurrent-agent stress test; response P99 ≤ 5s; all agent actions queryable via AUDIT-API; Pentest #4 clearance (no code-exec via prompt).

**TOWNHALL-QUEUE-01: Moderated anonymous Q&A at scale (S84, 21 pts)**
- **Given** a TOWNHALL session with anonymous questions + AI moderation, **when** initialized, **then** a ModQueueDO drives an upvote-ranked queue and participants see an identity-redacted input.
- **Given** 5k participants and 500 questions, **when** participants upvote, **then** the queue ranks deterministically (upvotes desc, submission time asc) at P99 ≤ 200ms with duplicate suppression.
- **Given** a sensitive question, **when** AI pre-screen flags it, **then** it routes to a human moderator and does not appear publicly until approved.
- **Given** an authored question, **when** broadcast, **then** no email/name appears publicly (only e.g. "Anonymous from Sales"); the author ID exists only in the audit log for GDPR escalation.
- **DoD:** ADR-0047 accepted; 5k-voter load proof; zero anonymity leakage in broadcast; Pentest #4 de-anonymization clearance; TOWNHALL-SCALE-PROOF-50K-01 evidence (S85).

**DELIBERATE-RECEIPT-01: Cryptographic governance receipt + tally (S86, 21 pts)**
- **Given** a vote cast in a DELIBERATE session, **when** submitted, **then** the voter receives a receipt (ballot-nonce, SHA-256 commitment, session fingerprint, own choice, verify QR) downloadable as PDF + JSON.
- **Given** a receipt, **when** the voter calls the verify endpoint, **then** the ledger commitment re-derives to the receipt hash and the vote appears in the final tally — even after the voter deletes their account.
- **Given** a closed session of 500 votes, **when** an observer downloads tally + commitment ledger, **then** they can locally recompute the Merkle root and confirm vote count = commitment count.
- **Given** a tampered commitment, **when** verification runs, **then** it fails with "commitment mismatch" and raises a forensics alert.
- **DoD:** ADR-0049 accepted; independent cryptography review; receipt renders on mobile (PDF+JSON); verify endpoint ≥1000 concurrent; receipt reveals no other-vote info (coercion-resistant); Pentest #5 forgery/replay clearance; DELIBERATE-RETALLY-01 evidence (S87).

---

**See also**:
- `README.md` — documentation map (truth hierarchy, reading order)
- `SPRINT_PLAN.md` — reference five-sprint arc (v0.1→v0.5); not greenfield schedule
- `ARCHITECTURE.md` — system design + data model
- `ROADMAP_FULL.md` — release timeline + version targets
- `SPRINT30_39_PLAN.md` — ten-sprint horizon S30–S39
- `CLAUDE.md` — L1 project context + hard rules
- `spec/WEBSITE_DESIGN_SPEC.md` — design spec for website + dashboard
- `SPRINT33_34_PLAN.md` — Sprint 33–34 detailed plan (v2.3 integrations + compliance + AI depth)
- `SPRINT60_70_PLAN.md` — master eleven-sprint plan S60–S70 (3× capacity, all agents)
- `SPRINT60_70_INFRA_PLAN.md` — DEVOPS story pool S60–S70 (multi-region, D1 sharding, SLO, chaos, partner env)
- `SPRINT60_70_FRONTEND_PROPOSAL.md` — eleven-sprint frontend horizon S60–S70 (mobile PWA v3, white-label UI, admin analytics v3, trust/scale proof, partner portal, developer portal, compliance dashboard) — **1,424 pts, 120–150 pts/sprint**
- `SPRINT71_80_PLAN.md` — master ten-sprint plan S71–S80 (3× capacity, all agents)
- `SPRINT71_80_INFRA_PLAN.md` — DevOps committed work S71–S80 (MR write GA, 50k/100k load, DR automation, SLO paging, v5 infra)
- `SPRINT71_80_FRONTEND_PROPOSAL.md` — ten-sprint frontend horizon S71–S80 (dark mode GA, Zoom, dev portal v2, federation UI, scale/trust, copilot UX, audit surfaces)
- `SPRINT81_85_PLAN.md` — **committed next five sprints S81–S85** (INSIGHTS+ + v5.1 GA; 2026-06-01)
- `SPRINT81_90_PLAN.md` — master ten-sprint plan S81–S90 (3× capacity, all agents): native mobile GA, marketplace economy, agentic facilitation, new-business epics (town hall, events, retro, ideate, governance, embed, captions), gov cloud → v6.0 GA
- `SPRINT81_90_INFRA_PLAN.md` · `SPRINT81_90_FRONTEND_PROPOSAL.md` · `SPRINT81_90_BACKEND_PROPOSAL.md` · `SPRINT81_90_ARCH_NOTES.md` · `SPRINT81_90_SECURITY_PLAN.md` · `SPRINT81_90_AI_PLAN.md` · `SPRINT81_90_ANALYTICS_PLAN.md` — role deep-dives S81–S90
- `QA_COMMITMENT_SPRINTS_81_90.md` · `MARKETING_SPRINTS_81_90.md` · `I18N_SPRINT_81_90_PLAN.md` · `research/MARKET_VALIDATION_S81_90.md` — QA / marketing / i18n / market-validation S81–S90
- `SPRINT85_99_PLAN.md` — **9-day-cadence re-plan S85–S99 toward v7.0 GA** (carries v6.0 S85–S90 re-spaced + 8 net-new epics E91–E98; 2026-06-11)
- `SPRINT85_99_ARCH_NOTES.md` · `SPRINT91_99_STORIES.md` · `research/MARKET_VALIDATION_S85_99.md` — architecture (ADR-0054→0063) / 66-story breakdown / market validation S85–S99
- `spec/design-tokens.json` — design-token source of truth
