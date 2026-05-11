# Qesto — Sprint Plan (5-Sprint Roadmap)

_Document contract: This file is a **reference sequencing model** (releases **v0.1.0 → v0.5.0**) for dependencies, sizing, and sprint mechanics. The **shipped product** is **v2.x** — see [`ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md) and [`SPEC.md`](../../specifications/product/SPEC_PRODUCT.md) for live capability status. For committed incremental work, use [`BACKLOG.md`](../backlog/BACKLOG_MASTER.md) (including §12) and [`ARCHIVED_SPRINTS.md`](../releases/ARCHIVED_SPRINTS.md). **Documentation map:** [`README.md`](./README.md)._

_Last updated: 2026-05-01 (UTC)_
_**Sprint 18 Plan Added**: 2026-04-23 — see Sprint 18 section below. Five-sprint reference arc remains pedagogical (v0.1→v0.5). Calendar truth: Sprint 17 completed 2026-04-22; Sprint 18 runs 2026-04-29 to 2026-05-13._
_**Sprint 20 Plan Added**: 2026-04-30 — Sprint 19 implementation completed early; Sprint 20 focuses on readiness, entitlement enforcement, observability, and measurement before the next feature expansion._
_**Next-five-sprint refresh**: 2026-05-01 — Sprint 20 to Sprint 24 now form the active calendar planning arc for v2.1 readiness and v2.2 foundation work._
_**Sprint 20 scope expansion**: 2026-05-01 — Sprint 19 shipped early; AUTHZ-ADR-01 pulled in from stretch to committed; Sprint A verification bundle added; total committed scope raised from 34 pts to 45 pts._
_**Sprint 20 build package**: 2026-05-04 — ENTITLEMENTS-02, durable Sprint 19 measurement, AUTHZ-ADR-01 proposal, and Sprint A verification gates are now implemented or ready for review._

---

## Overview

This plan details **five consecutive reference sprints** (example calendar anchors starting **2026-04-19**) that layer a teaching story onto an **already-shipped** baseline. Each sprint focuses on a coherent slice across one or more epics. The arc walks **auth + core session → realtime + payments → enterprise + SSO → i18n + gamification → hardening + advanced features** as a **pedagogical path**, not a claim that the product is pre-v1.

**Do not** read the dates below as “project start”; they illustrate a **dependency-ordered template** aligned to [`BACKLOG.md`](../backlog/BACKLOG_MASTER.md) story IDs.

---

## Sprint 1: Foundation (2026-04-19 to 2026-05-02)

**Goal**: Build auth + session CRUD foundation, unblock all downstream work.

**Epics**: EPIC-AUTH (partial), EPIC-CORE (partial), EPIC-BILLING (partial)

**Committed Items** (8 stories, ~43 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| AUTH-01: Magic Link Email | 8 | AUTH | Ready | Email delivery working, token generation verified |
| AUTH-02: JWT Session Mgmt | 5 | AUTH | Ready | JWT creation, validation, refresh tested |
| AUTH-05: Auth Middleware | 5 | AUTH | Ready | Protected routes return 401 without JWT |
| CORE-01: Session Creation | 8 | CORE | Ready | D1 `sessions` table, DRAFT state working |
| CORE-02: Session Lifecycle | 8 | CORE | Ready | State transitions (DRAFT→LIVE→CLOSED→ARCHIVED) |
| CORE-03: Question Types | 5 | CORE | Ready | Poll/ranking/consent/open types defined |
| BILL-01: Plan Definition | 5 | BILL | Ready | Free/Pro/Enterprise plans in D1 + wrangler.toml |

**Key Dependencies**:
- AUTH-01 → AUTH-02 (JWT needed for sessions)
- AUTH-02 → AUTH-05 (middleware needs JWT validation)
- CORE-01 → CORE-02 (lifecycle needs session records)
- BILL-01 is foundational (no deps)

**Definition of Done**:
- All routes tested (unit + integration)
- Middleware auth checks on all protected CORE/BILL routes
- No TypeScript errors, all tests green
- Observability: user login + session creation events logged
- API docs updated for new routes

**KPI Targets**:
- 0 authentication failures in happy path
- <100ms JWT validation latency
- 0 state transition errors

**Release**: v0.1.0 (Auth + Session Foundation)

**Risk Mitigation**:
- JWT secret management: use wrangler env secrets, never in code
- D1 schema: test migrations in local first
- Email delivery: mock Resend in tests, use real in staging

**Execution status (2026-05-05 refresh):**
- Sprint 1 scope is fully covered in the current v2.x codebase and was re-verified after auth/login scope changes.
- Verification evidence:
  - `npx vitest run tests/integration/auth-flow.test.ts`
  - `npx vitest run tests/integration/sessions-flow.test.ts`
  - `npx vitest run tests/integration/session-lifecycle.test.ts`
  - `npx vitest run tests/integration/plan-enforcement.test.ts`
- Combined verification run passed: 4 test files, 36 tests.

---

## Sprint 2: Realtime + Payments (2026-05-02 to 2026-05-16)

**Goal**: Activate live sessions with realtime voting, integrate Stripe for monetization.

**Epics**: EPIC-CORE (remaining), EPIC-BILLING (remaining)

**Committed Items** (7 stories, ~48 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| CORE-04: WebSocket DO | 13 | CORE | Ready | 100+ concurrent connections, <500ms p99 latency |
| CORE-05: Vote Submission | 8 | CORE | Ready | Votes recorded in D1, idempotency verified |
| CORE-06: Presenter Controls | 8 | CORE | Ready | Next/show results/hide broadcast to all |
| CORE-07: Participant Join | 8 | CORE | Ready | Join flow working, WebSocket upgrade verified |
| BILL-02: Stripe Checkout | 8 | BILL | Ready | Checkout session creation, success/cancel flows |
| BILL-03: Webhook Idempotency | 8 | BILL | Ready | Duplicate events ignored, all Stripe events processed |
| BILL-04: Plan Middleware | 5 | BILL | Ready | 403 on premium routes for Free users |

**Key Dependencies**:
- CORE-04 is blocking all other CORE items (DO is the realtime backbone)
- BILL-02 → BILL-03 (webhooks process checkout results)
- BILL-04 blocks both BILL-02 and BILL-03 (feature gating needed)

**Definition of Done**:
- WebSocket stress testing (concurrent connections, broadcast latency)
- Stripe integration tested with mock Stripe SDK
- Idempotency ledger tested (duplicate key handling)
- All votes persisted to D1
- Presenter actions broadcast within 100ms

**KPI Targets**:
- 0 WebSocket disconnections on hold (graceful reconnect on resume)
- 100% vote idempotency (no duplicates under concurrent load)
- 0 double-charges (webhook idempotency verified)
- <500ms e2e latency (vote submission to results update)

**Release**: v0.2.0 (Realtime Sessions + Stripe Foundation)

**Risk Mitigation**:
- DO state machine: test all transitions offline before deployment
- Stripe webhooks: use test mode, verify signature validation
- WebSocket: implement heartbeat + reconnect logic early
- Load testing: simulate 100+ participants before shipping

**Execution status (2026-05-05 refresh):**
- Sprint 2 scope is fully covered in the current v2.x codebase and re-verified as a regression contract.
- Verification evidence:
  - `npx vitest run tests/unit/session-room.test.ts`
  - `npx vitest run tests/stress/session-room-concurrent.test.ts`
  - `npx vitest run tests/integration/session-lifecycle.test.ts`
  - `npx vitest run tests/integration/close-results-flow.test.ts`
  - `npx vitest run tests/integration/plan-enforcement.test.ts`
  - `npx vitest run tests/unit/pricing-matrix.test.ts`
  - `npx vitest run tests/unit/plans-catalog-route.test.ts`
- Combined verification run passed: 7 test files, 64 tests.

---

## Sprint 3: Enterprise + SSO (2026-05-16 to 2026-05-30)

**Goal**: Add SAML auth, enterprise features (teams, roles, audit, multi-tenant).

**Epics**: EPIC-AUTH (SAML), EPIC-ENT (all)

**Committed Items** (6 stories, ~46 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| AUTH-03: SAML SSO | 8 | AUTH | Ready | SAML assertion validation + auto-account creation |
| AUTH-04: SAML Config | 5 | AUTH | Ready | Metadata fetch/parse, IdP config in D1 |
| ENT-01: Team Management | 8 | ENT | Ready | Create/invite/remove, role assignment |
| ENT-02: RBAC Model | 8 | ENT | Ready | 5 roles with permission matrix enforced |
| ENT-03: Audit Logging | 8 | ENT | Ready | All mutations logged, queryable by date/action/user |
| ENT-05: Multi-Tenant Isolation | 8 | ENT | Ready | Cross-team access blocked, data isolation verified |

**Key Dependencies**:
- AUTH-03 → AUTH-04 (SAML config enables SAML auth)
- ENT-02 is blocking all other ENT items (roles underpin all permissions)
- ENT-03 (audit) depends on all mutation routes (created in Sprints 1-2)
- ENT-05 (isolation) applies to all routes (global safeguard)

**Definition of Done**:
- SAML assertion validation tested with real IdP (or Keycloak mock)
- All routes return 403 on cross-team access
- Audit table queried by owner for full visibility
- Role permissions enforced on all endpoints
- Security review sign-off on SAML + multi-tenant

**KPI Targets**:
- 0 cross-tenant data leaks (security testing)
- <5% SAML auth failures (valid IdP assertions succeed)
- 100% audit coverage (all mutations logged)

**Release**: v0.3.0 (Enterprise + SAML)

**Risk Mitigation**:
- SAML: partner with IT team for IdP testing (Okta sandbox)
- Audit logging: ensure no PII in logs (hash PII fields)
- Role enforcement: add integration tests for each (Owner, Admin, Member, Presenter, Viewer)
- Multi-tenant: add data isolation tests on high-sensitivity routes (billing, audit)

**Execution status (2026-05-05 refresh):**
- Sprint 3 scope is fully covered in the current v2.x codebase and re-verified as a regression contract.
- Verification evidence:
  - `npx vitest run tests/unit/saml.test.ts`
  - `npx vitest run tests/integration/auth-hardening.test.ts`
  - `npx vitest run tests/integration/rbac-audit.test.ts`
  - `npx vitest run tests/integration/custom-rbac.test.ts`
  - `npx vitest run tests/integration/multi-tenant-isolation.test.ts`
  - `npx vitest run tests/integration/admin-dashboard.test.ts`
- Combined verification run passed: 6 test files, 56 tests.

---

## Sprint 4: i18n + Gamification Base (2026-05-30 to 2026-06-13)

**Goal**: Add multi-language support and base engagement features.

**Epics**: EPIC-I18N (partial), EPIC-GAM (base), EPIC-CORE (partial)

**Committed Items** (8 stories, ~54 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| I18N-01: Locale Bundles | 8 | I18N | Ready | 5 locales (EN/NL/ES/DE/FR), 8 namespaces |
| I18N-02: Language Detection | 5 | I18N | Ready | Browser lang detection, user selector working |
| I18N-03: CI Key Validation | 8 | I18N | Ready | CI fails on untranslated keys, warns on orphaned |
| CORE-08: Results Export | 5 | CORE | Ready | CSV export of votes, all questions included |
| GAM-01: Energizers | 8 | GAM | Ready | Speed round + trivia with scoring |
| GAM-02: Leaderboard | 8 | GAM | Ready | Live ranking, realtime updates via WebSocket |
| GAM-03: Badge System | 8 | GAM | Ready | 8+ badge types, automatic award criteria |

**Key Dependencies**:
- I18N-01 → I18N-02 → I18N-03 (bundles, then UI, then CI)
- GAM-01 → GAM-02 → GAM-03 (energizers, then leaderboard, then badges)
- CORE-08 (export) depends on CORE-05 (votes in D1)
- GAM items depend on DO (broadcast for realtime scoring)

**Definition of Done**:
- All UI text extracted and translated (EN source truth)
- CI enforces key coverage (pre-merge)
- Energizers tested with scoring logic
- Leaderboard broadcasts scores in realtime
- Badges awarded automatically on vote
- CSV export includes all columns, sample generated

**KPI Targets**:
- 100% key coverage (no untranslated strings)
- 0 missing translations (CI blocks PRs)
- <100ms leaderboard update latency
- Energizer engagement 20% higher than standard questions (measured in follow-up)

**Release**: v0.4.0 (i18n + Gamification Base)

**Risk Mitigation**:
- i18n: hire translator for all 5 languages (or use professional service like Lokalise)
- CI key extraction: test regex patterns against real codebase first
- Gamification: test scoring logic with edge cases (ties, speed, zero scores)
- Leaderboard: ensure WebSocket broadcasts scale (load test with 100+ participants)

**Execution status (2026-05-05 refresh):**
- Sprint 4 scope is fully covered in the current v2.x codebase and re-verified as a regression contract.
- Verification evidence:
  - `npx vitest run tests/unit/I18N03.test.ts`
  - `npx vitest run tests/integration/energizers.test.ts`
  - `npx vitest run tests/integration/badges.test.ts`
  - `npx vitest run tests/unit/session-room.test.ts`
  - `npx vitest run tests/integration/close-results-flow.test.ts`
- Combined verification run passed: 5 test files, 84 tests.

---

## Sprint 5: Hardening + Advanced Features (2026-06-13 to 2026-06-27)

**Goal**: Polish auth, billing, enterprise, i18n, gamification with advanced scenarios and quality hardening.

**Epics**: EPIC-AUTH (complete), EPIC-BILL (complete), EPIC-ENT (complete), EPIC-I18N (complete), EPIC-GAM (complete)

**Committed Items** (9 stories, ~58 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| AUTH-06: Token Refresh + Revocation | 5 | AUTH | Ready | Refresh route working, revocation tested |
| BILL-05: Subscription Management | 8 | BILL | Ready | Upgrade/downgrade/cancel flows, prorated charges |
| BILL-06: Billing Portal | 5 | BILL | Ready | Stripe portal redirect, invoice history view |
| ENT-04: Admin Dashboard | 8 | ENT | Ready | Metrics displayed, CSV export working |
| ENT-06: Role Delegation | 5 | ENT | Ready | Delegation grant/revoke, time-limited permissions |
| I18N-04: Plurals + Interpolation | 8 | I18N | Ready | Plural forms, variable substitution all languages |
| I18N-05: RTL Support | 5 | I18N | Ready | CSS logical props, RTL dir attribute (future-proofing) |
| I18N-06: Locale-Aware Formatting | 5 | I18N | Ready | Dates, numbers formatted per locale |
| GAM-04: Referral Mechanics | 5 | GAM | Ready | Link generation, credit tracking, application |
| GAM-05: Advanced Energizers | 8 | GAM | Ready | Battle royale + bracket tournaments |
| GAM-06: Gamification Analytics | 5 | GAM | Ready | Badge breakdown, engagement metrics, CSV export |

**Key Dependencies**:
- AUTH-06 (token revocation) stands alone
- BILL-05 → BILL-06 (subscription mgmt enables portal)
- ENT-04/06 depend on earlier ENT work (teams, roles, audit)
- I18N-04/05/06 depend on I18N-01/02/03
- GAM-05/06 depend on GAM-01/02/03

**Definition of Done**:
- All routes tested (happy path + error cases)
- Subscription changes reflected immediately in KV cache
- Plurals/interpolation tested in all 5 languages
- Advanced energizers tested with tournament logic
- Analytics queries optimized (indexed)
- Docs updated: API routes, data model, config

**Execution status (2026-05-05 refresh):**
- Implemented and verified in this pass:
  - **AUTH-06**: Added `/api/auth/refresh` and token revocation checks in `authMiddleware`; revoked session tokens are now blocked and refresh revokes the previous token.
  - **BILL-05/BILL-06 hardening**: Added `/api/billing/subscription` (upgrade/downgrade/cancel orchestration) and `/api/billing/invoices` (invoice history) alongside existing `/api/billing/portal`.
- Existing Sprint-5 scope already present before this pass and re-verified:
  - **ENT-04 / GAM-06** via `tests/integration/admin-dashboard.test.ts`
  - **GAM-05** via `tests/integration/energizers.test.ts`
  - **I18N-04/05/06** via `tests/unit/I18N03.test.ts`
- New verification evidence executed:
  - `npx vitest run tests/integration/auth-flow.test.ts`
  - `npx vitest run tests/integration/sprint5-auth-billing.test.ts`
  - `npx vitest run tests/unit/I18N03.test.ts`
  - `npx vitest run tests/integration/energizers.test.ts`
  - `npx vitest run tests/integration/badges.test.ts`
  - `npx vitest run tests/integration/admin-dashboard.test.ts`
- Combined verification run passed: 6 test files, 77 tests.

**KPI Targets**:
- 0 failed token refreshes
- 0 subscription state inconsistencies
- 100% plural/interpolation accuracy across languages
- <1s analytics query latency (p95)
- Referral conversion rate 10%+ (measured post-launch)

**Release**: v0.5.0 (Complete + Hardened Feature Set)

**Risk Mitigation**:
- Subscription logic: test all upgrade/downgrade paths (Free→Pro, Pro→Enterprise, downgrade edge cases)
- i18n: validate plural forms in context (e.g., 0, 1, 2+ participants)
- Gamification: test bracket logic with edge cases (odd # participants, ties)
- Load testing: admin dashboard with 10k+ metrics
- Security: audit token refresh flow for reuse attacks

---

## Release Timeline

| Release | Version | Sprint | Date | Focus |
|---|---|---|---|---|
| Foundation | v0.1.0 | 1 | 2026-05-02 | Auth + Session CRUD |
| Realtime | v0.2.0 | 2 | 2026-05-16 | WebSocket + Stripe |
| Enterprise | v0.3.0 | 3 | 2026-05-30 | SAML + RBAC + Audit |
| Engagement | v0.4.0 | 4 | 2026-06-13 | i18n + Gamification |
| Complete | v0.5.0 | 5 | 2026-06-27 | Hardening + Advanced |

---

# §Calendar Sprints (Actual Project: 2026-04-29+)

**Note**: The 5-sprint reference arc above (v0.1→v0.5) is a pedagogical teaching sequence **not** a literal greenfield schedule. The sections below document actual calendar sprints (17, 18, 19) on the shipped v2.0 baseline. Do not confuse the two "sprint" notions; see [`BACKLOG.md`](../backlog/BACKLOG_MASTER.md) for clarification.

---

## Sprint 18: Foundation + Design Tokens + i18n Hardening (2026-04-29 to 2026-05-13)

**Context**: Sprint 18 is the actual next calendar sprint (after Sprint 17, 2026-04-22). The 5-sprint arc above is pedagogical. Sprint 18 focuses on **hardening & unblocking** design wave Sprint B and enterprise features. **See `/root/.claude/plans/can-you-plan-sprint-keen-dream.md` for comprehensive planning details.**

**Goal**: Fix critical i18n defects (GDPR risk), establish design-token source-of-truth with CI validation, ship responsive grid + WCAG 2.2 a11y foundation.

**Epics**: EPIC-I18N (critical defects), EPIC-DESIGN (new), EPIC-ENT (UI completion), EPIC-AI (scaffold)

**Committed Items** (8 stories, ~55 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| **I18N-BUG-01**: Fix missing wizard keys (step4.mode.*) | 8 | I18N | Ready | All 5 locales have keys; 0 raw identifiers visible |
| **I18N-BUG-02**: Extract hardcoded Dutch strings from Launchpad | 5 | I18N | Ready | Launchpad fully i18n'd; CI check extended to detect non-keyed literals |
| **DESIGN-TOK-01**: Design-tokens.json → CI-generated tokens.ts + drift check | 8 | DESIGN | Ready | Token generator live; CI prevents drift; consumed by Tailwind |
| **LAYOUT-GRID-01**: Responsive 12/8/4-column grid primitive | 8 | DESIGN | Ready | Tailwind grid-cols-* configured; 4px baseline lint; 3 layout snapshots pass |
| **LAYOUT-A11Y-01**: WCAG 2.2 SC 2.4.11 conformance (landmarks, skip-link, focus) | 8 | DESIGN | Ready | 0 axe violations on top 6 flows; skip-link + landmarks shipped |
| **ENT-03 UI**: Audit-log viewer dashboard (backend exists) | 8 | ENT | Ready | Table shipped @ `/dashboard/admin/audit`; filters + export work; <2s load |
| **DX-INSIGHTS-01**: Dashboard Insights tab scaffold | 5 | AI | Ready | Tab visible; empty state renders; route bookmarkable |
| **I18N-03**: Key extraction CI validation | 5 | I18N | Ready | Detects missing/orphaned keys; blocks PR on untranslated strings |

**Total: 55 pts** | **Expected velocity**: 13–27 pts/week (achievable with team capacity).

**Key Dependencies**:
- I18N-BUG-01 → I18N-BUG-02 (extract keys first, then detect non-keyed literals)
- DESIGN-TOK-01 → LAYOUT-GRID-01 → LAYOUT-A11Y-01 (token foundation, then layouts, then a11y)
- ENT-03 UI runs parallel to LAYOUT-A11Y-01 (independent)
- I18N-03 runs async at sprint end (days 12–14)

**Critical Path**: I18N defects + DESIGN-TOK-01 are blockers for design wave Sprint B. If DESIGN-TOK-01 slips >2 days, defer ENT-03 UI + DX-INSIGHTS-01 to Sprint 19.

**KPI Targets**:
- 0 raw i18n keys visible across 5 locales
- 0 token drift (CI check passes)
- 0 axe-core violations on top flows
- Audit dashboard <2s load time
- Insights tab KPI primed for Sprint 19 measurement

**Risk Mitigation**:
- Token generator: architect pairing from day 1; snapshot test Tailwind theme
- i18n coverage: audit all 5 locales before I18N-BUG-02 starts; CI gate enforced
- A11y audit: run axe-core baseline by day 7; prioritize sticky regions if violations found
- Scope contingency: defer ENT-03 UI (8 pts) and DX-INSIGHTS-01 (5 pts) if critical path slips

**Definition of Done**:
- Code merged, CI passing (`npm test`, `tsc`, `check:i18n`, `check:design-tokens`)
- Tests: ≥80% coverage on new code
- Documentation: BACKLOG.md updated; design guide updated (grid, skip-link, token sourcing)
- KPI baseline: i18n coverage, token consistency, a11y compliance measured

---

## Sprint 19: AI Wizard + Launchpad (Implemented 2026-04-30, ahead of planned 2026-05-13 to 2026-05-27)

**Context**: Sprint 19 completes the core "create session" journey (wizard → overview → Launchpad) with integrated AI generation. It unblocks Website Design Wave Sprint B and establishes AI adoption metrics. **Design & consensus**: 2026-04-23 (Product Owner + Architect consensus). **Implementation completed 2026-04-30** (13 days ahead of planned window start; urgent feature prioritization per backlog review). **KPI measurement deferred post-ship; see §Implementation Evidence below.**

**Goal**: Ship AI-powered session wizard with measurable adoption (≥50% AI question acceptance); complete Launchpad pre-flight flow; establish design-token + layout foundation for downstream design wave.

**Epics**: EPIC-CORE (wizard completion), EPIC-AI (generation + badges), EPIC-DESIGN (density tiers)

**Committed Items** (7 stories, ~43 pts):

| Item | Size | Epic | Status | Exit Criteria |
|---|---|---|---|---|
| **WIZ-AI-01**: AI wizard sub-flow — consent gate, grounding echo, `Generate now` + refine, streaming skeleton | 8 | AI | ✅ Implemented 2026-04-30 | ≥50% AI question acceptance rate; ≥65% wizard completion rate; SSE streaming <1s TTFB |
| **WIZ-AI-02**: Per-question editor — type switcher (MC/Ranking/Wordcloud) + validation gating Next | 8 | CORE | ✅ Implemented 2026-04-30 | 0 invalid sessions reach LIVE; `Next` disabled-click rate ≤8% per step |
| **WIZ-OVERVIEW-01**: Step 5 overview — read-only summary + pencil edit-jump preserving state | 8 | CORE | ✅ Implemented 2026-04-30 | +10% wizard completion; 0 state-loss bugs on edit round-trip |
| **LAUNCHPAD-01**: Session Launchpad (pre-live) — T6 template, action rail, content rail, pre-flight strip | 8 | CORE | ✅ Implemented 2026-04-30 | ≥99.5% DRAFT→LIVE transition success; median time-on-Launchpad 20–60s; responsive at all breakpoints |
| **AI-VIS-03**: `<AIBadge>` primitive — assisted/generated/analyzed variants + sparkle icon + tooltip | 3 | DESIGN | ✅ Implemented 2026-04-30 | 100% of AI surfaces carry badge + accessible tooltip |
| **AI-VIS-02**: Inline AI suggestions in wizard — accept/edit/dismiss chips | 5 | AI | ✅ Implemented 2026-04-30 | ≥30% chip acceptance rate; streaming <2s p95 |
| **LAYOUT-DENSITY-01**: Density tiers (Compact/Comfortable/Spacious) on list + table surfaces | 3 | DESIGN | ✅ Implemented 2026-04-30 | ≥3 surfaces switchable without rhythm shift; pref persisted in USERS_KV |

**Conditional Stretch** (add only if Sprint 18 ships `insights_daily` precompute infrastructure):

| Item | Size | Condition |
|---|---|---|
| **DX-INSIGHTS-02**: Top-themes card + confidence chip + 30-day trend sparkline | 8 | ✅ Implemented 2026-04-30 after `insights_daily` precompute/read path landed |

**Key Dependencies**:
- WIZ-AI-01 → WIZ-AI-02 (schema contract is load-bearing)
- WIZ-AI-02 → WIZ-OVERVIEW-01 (step sequencing)
- WIZ-OVERVIEW-01 → LAUNCHPAD-01 (commits DRAFT, routes to Launchpad)
- DESIGN-TOK-01 (S18) → AI-VIS-03 (token consumption)
- DX-INSIGHTS-01 (S18) → DX-INSIGHTS-02 (conditional; requires precompute job)

**Critical Path — Week 1 (days 1–7)**:
1. WIZ-AI-01 + WIZ-AI-02 + AI-VIS-03 (establish AI streaming contract + schema invariants)
2. LAUNCHPAD-01 pre-flight wiring (depends on 1; unblocks DO `start()`)
3. WIZ-OVERVIEW-01, AI-VIS-02 land week 2 on stabilized schema

**Contingency** (drop in priority order if velocity < 28 pts/week by day 7):
1. LAYOUT-DENSITY-01 (3 pts) — pure polish, defer to S20
2. AI-VIS-02 (5 pts) — wizard ships without inline chips, add in S20

**KPI Targets**:
- ≥50% of new sessions use AI-generated questions
- ≥65% of users complete wizard (up from prior baseline)
- ≥30% acceptance rate on inline AI suggestions
- 0 invalid sessions reaching LIVE state
- Launchpad 99.5%+ DRAFT→LIVE success rate

**Sprint 18 prerequisite closeout evidence (landed before Sprint 19 implementation closeout)**:

_These were originally additions to Sprint 18 scope. They are retained here as traceability for the Sprint 19 implementation completed on 2026-04-30. See BACKLOG.md for detailed acceptance criteria._

**D1 Migrations**:
- `sessions.ai_generated` (INTEGER, 0/1 flag) — provenance for AIBadge
- `sessions.ai_consent_at` (INTEGER, epoch ms) — GDPR audit trail for AI generation
- `sessions.ai_grounding_hash` (TEXT) — deterministic hash of generation context for refine round-trips
- `questions.kind` widened to include `'wordcloud'` (if not present)
- `insights_daily` table (session_id, day, themes_json, confidence, n_votes) — **required only for DX-INSIGHTS-02 conditional**

**API Routes (DRAFT-API only, no DO involvement)**:
- `POST /api/sessions/:id/ai/generate` (streaming SSE, Workers AI) — returns chunked `QuestionDraft[]` skeleton + full JSON on close
- `POST /api/sessions/:id/ai/refine` (idempotent on `grounding_hash`) — re-uses prior grounding, avoids re-billing tokens
- `GET /api/sessions/:id/preflight` — returns invariant checks; single source of truth for DO entry-gate validation
- `GET /api/sessions/:id/insights/themes?window=30d` — returns `insights_daily` slice (conditional on precompute)

**KV Schema Updates** (no migration, just contract freeze):
- `SESSIONS_KV` DRAFT shape: add `aiMeta: { consentAt, grounding, model, promptVersion }`
- `USERS_KV` add `prefs.density: 'compact'|'comfortable'|'spacious'`

**ADRs (document before S19 kickoff)**:
- ADR-0xx: AI streaming transport (SSE vs chunked JSON) for wizard + inline suggestions
- ADR-0xx: Pre-flight contract — which invariant checks live in worker vs. DO `onStart`

**Risk Mitigation**:
- **AI streaming**: New surface (Pages Functions SSE) — budget 1 spike day in S18 to validate latency + client handling
- **KV rate limits**: Per-team token bucket in `ACTIONS_KV` (1 write/s/key ceiling) — monitor; consider DO-backed bucket if tier-1 team exceeds 1 gen/s
- **Pre-flight duplication**: If worker and DO each implement checks separately, they drift. ADR must mandate shared validator module
- **Streaming UX regression**: If skeleton + streaming do not ship, wizard adoption plummets — non-negotiable for this sprint
- **Schema invariants**: WIZ-AI-02 type-switcher must match DO expectations at LIVE transition — review contract review on days 2–3

**Deferred to Later Sprints** (both PO + Architect veto):
- **ENT-04** (RBAC depth): Cross-cuts every auth middleware; needs dedicated 2-sprint epic + authz ADR → **S20–S21**
- **GAM-01** (Energizer question type in LIVE): Requires extending DO `ClientMessage`/`ServerMessage` schema + protocol versioning ADR we lack → **S21+**

**Definition of Done**:
- Code merged, CI passing (`npm test`, `npm run typecheck`, `npm run check:i18n`)
- Tests: ≥80% coverage on new code (streaming SSE, type validation, pre-flight)
- Manual: SSE streaming <1s TTFB on 3G network simulation; wizard → Launchpad round-trip 0 state loss
- Observability: AI generation request/latency logged; token bucket contention alerted
- Docs: ARCHITECTURE.md + SPEC.md updated for `/ai/*` routes; wizard type enum documented
- KPI baseline: AI adoption (%) measured at S19 close

**Implementation closeout evidence (2026-04-30)**:
- `/api/sessions/:id/ai/generate` streams `ready`, `questions`, and `done` SSE events; `/api/sessions/:id/ai/refine` remains idempotent on grounding hash.
- Wizard persists AI provenance (`ai_generated`, `ai_consent_at`, `ai_grounding_hash`) before routing to Launchpad.
- Launchpad consumes backend `/preflight` as the launch gate and refreshes after edits, reorders, inline adds, and AI generation.
- Density tiers apply to Dashboard sessions, Insights, and Teams list surfaces and persist through `USERS_KV`.
- Focused verification: `npm run typecheck`; `npx vitest run tests/unit/sessions-new-routes.test.ts tests/unit/ai-wizard.test.ts tests/integration/user-preferences.test.ts`.

---

## Sprint 20: Readiness + Entitlement Enforcement + Measurement (2026-05-27 to 2026-06-10)

**Context**: Sprint 19 delivered the AI wizard and Launchpad implementation ahead of its planned calendar window. Sprint 20 deliberately avoids a broad new feature push so the team can convert that delivery into release confidence: entitlement coverage, operational evidence, stable local/CI gates, and KPI measurement.

**Goal**: Harden v2.1 by proving users receive only the capabilities their plan allows, measuring Sprint 19 adoption and reliability, and making quality gates trustworthy on both local Windows development and CI.

**Epics**: EPIC-BILLING (entitlement enforcement), EPIC-ENT (compliance readiness), EPIC-AI (measurement), EPIC-DESIGN (gate reliability), EPIC-QA (test/documentation hygiene)

**Committed Items** (8 stories + verification bundle, ~45 pts — expanded 2026-05-01):

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **ENTITLEMENTS-01**: Pricing claim → backend gate matrix | 8 | BILLING/ENT | ✅ Implemented 2026-05-01 | Every pricing claim maps to an owning route/service, entitlement flag, and expected allow/deny behaviour |
| **ENTITLEMENTS-02**: Contract tests for paid capabilities | 8 | BILLING/QA | ✅ Built 2026-05-04 | Negative tests cover enforced capabilities; non-implemented claims are classified in `PLAN_ENTITLEMENT_AUDIT.md` |
| **OBS-02**: Sprint 19 operational evidence | 5 | AI/OPS | ✅ Implemented 2026-05-01 | AI generation/refine latency, preflight failures, Launchpad DRAFT→LIVE success proxy, token bucket contention, WebSocket capacity, and 5xx errors are queryable or logged with trace IDs |
| **QA-DOCDRIFT-01**: Align docs with actual scripts and test counts | 3 | QA/DOCS | ✅ Implemented 2026-05-01 | Docs use `npm run typecheck`; stale `type-check` / `check:api` references are removed or backed by real scripts; test-count claims are refreshed |
| **DESIGN-GATE-01**: Stabilize token drift check locally and in CI | 5 | DESIGN/QA | ✅ Implemented 2026-05-01 | `npm run tokens:build` and `npm run check:tokens-drift` agree on Windows and CI; failures produce actionable path output |
| **S19-MEASURE-01**: KPI baseline report for AI wizard + Launchpad | 5 | AI/PRODUCT | ✅ Completed with durable events 2026-05-04 | Baseline captures AI usage, wizard completion, Launchpad success, AI suggestion acceptance, invalid LIVE attempts, and preflight failure rate when event denominators exist |
| **AUTHZ-ADR-01**: Custom RBAC authorization ADR *(pulled in from stretch — 2026-05-01)* | 3 | ENT/AUTH | Proposed for review 2026-05-04 | `docs/adr/ADR-0004-custom-rbac-authorization.md` defines custom role scopes, permission-to-route ownership, audit event semantics, migration direction, and contract test strategy |
| **Sprint A verification bundle** (LAYOUT-GRID-01, LAYOUT-A11Y-01, DESIGN-TOK-01, DX-INSIGHTS-01, I18N-BUG-01, I18N-BUG-02) | 8 | DESIGN/I18N/QA | Verification gate active | Run `check:tokens-drift`, `check:i18n`, axe-core a11y suite; confirm LAYOUT-GRID-01 column spans adopted on wizard/Launchpad/Insights surfaces; verify DX-INSIGHTS-01 graceful degradation without DX-INSIGHTS-02 data |

**Stretch / Do Not Commit Until Core Items Are Green**:

| Item | Size | Condition |
|---|---:|---|
| **DESIGN-POLISH-01**: Primary CTA hover/motion state | 3 | Start after Sprint A verification bundle closes; all tech deps satisfied |
| **DESIGN-POLISH-02**: Logo optical weight bump + sparkle mark | 3 | Conditional on brand sign-off by 2026-05-14; else defer to Sprint 23 |
| **LAUNCHPAD-02**: Inline Launchpad editor + reorder polish | 8 | Start only after S19-MEASURE-01 shows no launch reliability regression; do not start before S19-MEASURE-01 is complete |

**Explicitly Deferred**:
- **RBAC depth/custom roles implementation**: requires AUTHZ-ADR-01 first; target S21+.
- **GAM-01 / LIVE energizers**: requires Durable Object protocol/versioning ADR; target S21+.
- **AUTH-MICROSOFT-LOGIN-01**: Microsoft OAuth login is removed from sprint scope and must not be exposed on the login page until explicitly re-planned.
- **New broad product surfaces**: defer until entitlement and observability evidence are credible.

**Key Dependencies**:
- ENTITLEMENTS-01 → ENTITLEMENTS-02 (matrix before tests)
- OBS-02 → S19-MEASURE-01 (events/logs before KPI baseline)
- DESIGN-GATE-01 → any follow-on design polish that relies on generated tokens
- AUTHZ-ADR-01 → RBAC depth/custom roles

**KPI Targets**:
- 100% of pricing claims classified as enforced, intentionally ungated, or not yet implemented
- 0 known paid-feature routes without server-side allow/deny coverage
- Sprint 19 KPI baseline captured before planning further wizard/Launchpad scope
- Local and CI quality gates use the same command names and produce the same token-drift result
- No new P0/P1 regressions in wizard → Launchpad → Open lobby full-stack smoke testing

**Risk Mitigation**:
- Entitlement work: prefer contract tests over one-off route assertions so pricing changes cannot silently drift from enforcement.
- Observability: use route-pattern labels and sanitized messages; do not log email, tokens, prompts, or raw participant text.
- Gate reliability: fix Windows path handling before adding stricter token checks, so local developers trust failures.
- Scope: do not start RBAC implementation or energizer protocol work until the ADRs exist.

**Definition of Done**:
- Code merged, CI passing (`npm test`, `npm run typecheck`, `npm run check:i18n`, `npm run check:design-tokens`, `npm run check:tokens-drift`)
- Entitlement matrix committed and linked from `PLAN_ENTITLEMENT_AUDIT.md`
- Contract tests demonstrate at least one allow and one deny path for each enforced paid capability
- Sprint 19 KPI baseline documented with known measurement gaps called out
- Docs updated where command names, test counts, route contracts, or release status changed

---

## Next Five Calendar Sprint Arc (Actual Project: Sprint 20 to Sprint 24)

**Planning basis**: Agent-assisted product/engineering review on 2026-05-01. Sprint 20 is committed; Sprints 21–24 are sequenced intent and should be refined at each planning ceremony using completed evidence from the prior sprint.

| Sprint | Window | Release posture | Goal | Gate |
|---|---|---|---|---|
| **Sprint 20** | 2026-05-27 to 2026-06-10 | v2.1 readiness lock | Entitlement tests, operational evidence, Sprint 19 KPI baseline, trustworthy local/CI gates, **AUTHZ-ADR-01 in review** | No broad feature expansion until evidence exists; 45 pts committed (expanded 2026-05-01) |
| **Sprint 21** | 2026-06-10 to 2026-06-24 | v2.1 enterprise hardening | Backend custom-role matrix + assignment APIs, delegated team-management/auth permissions, compliance audit events | Built backend slice 2026-05-04; frontend role-management UI remains follow-up |
| **Sprint 22** | 2026-06-24 to 2026-07-08 | v2.1/v2.2 session creation polish | Built 2026-05-04: template catalogue requirement from SPEC.md: groups, overview confirmation, wizard seeding, functional coverage | No template card creates a session without overview confirmation |
| **Sprint 23** | 2026-07-08 to 2026-07-22 | v2.2 design/Launchpad polish | Built 2026-05-04: LAUNCHPAD-02 verified, CTA/logo polish, landing AI narrative sign-off | S19 KPI baseline healthy; token/i18n/a11y gates green |
| **Sprint 24** | 2026-07-22 to 2026-08-05 | v2.2 foundation | DO protocol ADR, LIVE energizer foundation, admin analytics maturity, backlog status reconciliation | Versioned DO message contract accepted before LIVE energizer rollout |

**Dependency chain**:
- ENTITLEMENTS-01 → ENTITLEMENTS-02 → AUTHZ-ADR-01 → RBAC depth/custom roles.
- OBS-02 → S19-MEASURE-01 → LAUNCHPAD-02 and Website Design Wave Sprint C.
- `SPEC.md` template requirement → TPL-CATALOG-01/02/03 → template-seeded wizard flow.
- DO-PROTOCOL-ADR-01 → GAM-01 LIVE energizers → GAM-02/GAM-03 depth.

---

## Sprint 21: Enterprise Authorization + Compliance UX (2026-06-10 to 2026-06-24)

**Context**: Sprint 21 follows the Sprint 20 readiness lock. It should only expand authorization after entitlement coverage is proven and measurement gaps are documented.

**Goal**: Establish a safe authorization model for custom roles and convert audit/admin evidence into usable compliance UX.

**Epics**: EPIC-ENT, EPIC-AUTH, EPIC-QA

**Committed Candidates** (refine after Sprint 20 closeout; AUTHZ-ADR-01 must be *accepted* before any item below lands):

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **AUTHZ-RBAC-01**: Custom role permission matrix + enforcement plan | 8 | ENT | ✅ Backend built 2026-05-04 | Matrix maps built-in/custom roles to team-management/auth permissions; allow/deny and plan-deny tests added |
| **AUTHZ-RBAC-02**: Admin role-management UX + delegated permissions | 8 | ENT/UX | Backend API built; frontend deferred | Owner/admin can create, edit, assign, revoke scoped roles through API with audit events |
| **ENT-COMPLIANCE-01**: Audit/admin compliance UX follow-through | 5 | ENT/OPS | Partial backend evidence built | Audit events cover role create/update/delete/assign/unassign and permission denials |

**Definition of Done**:
- ADR accepted before RBAC implementation lands.
- Contract tests include positive and negative paths for every new permission scope.
- Audit events exist for role create/edit/assign/revoke actions.
- Docs update `SPEC_BACKEND.md`/`SPEC_DATAMODEL.md` if route or schema contracts change.

---

## Sprint 22: Template Catalogue + Session Creation Polish (2026-06-24 to 2026-07-08)

**Context**: `SPEC.md` names the template library UX as the next functional requirement. Sprint 22 makes that path production-grade and keeps it integrated with the AI wizard rather than creating a parallel flow.

**Goal**: Let teams start from customer or Qesto templates, inspect fit before use, and land in editable wizard state with functional coverage.

**Epics**: EPIC-CORE, EPIC-TEMPLATES, EPIC-I18N, EPIC-QA

**Committed Candidates**:

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **TPL-CATALOG-01**: Customer vs Qesto template groups | 5 | TEMPLATES | ✅ Built 2026-05-04 | Dashboard Templates separates tenant-created templates from curated Qesto templates |
| **TPL-CATALOG-02**: Template overview confirmation flow | 8 | TEMPLATES/CORE | ✅ Built 2026-05-04 | Card opens overview with title, description, preview image, and explicit "Use template" CTA |
| **TPL-CATALOG-03**: Qesto starter-template coverage | 5 | TEMPLATES/CONTENT | ✅ Built 2026-05-04 | Minimum 3 Qesto templates per required topic; preferred 4+ for high-use topics |
| **TPL-WIZARD-01**: Template-seeded wizard customize step | 8 | CORE | ✅ Built 2026-05-04 | Selected template seeds wizard questions/settings and preserves editability before Launchpad |
| **TPL-QA-01**: Functional UI coverage for template catalogue | 3 | QA | ✅ Built 2026-05-04 | `tests/functional/ui/template-catalogue.test.ts` verifies topic IDs, confirmation guard, and copy alignment |

**Definition of Done**:
- No direct session creation from a template card.
- All new strings are keyed in EN/NL/DE/FR/ES.
- Template preview images have stable dimensions and accessible alt text.
- Wizard state survives template selection, editing, and back navigation.

---

## Sprint 23: Launchpad + Design Polish (2026-07-08 to 2026-07-22)

**Context**: Sprint 23 is Website Design Wave Sprint C in calendar form. It should start only after Sprint 19 KPI evidence shows the wizard → Launchpad path is reliable.

**Goal**: Improve Launchpad editability and complete visible design polish without regressing conversion, a11y, or i18n.

**Epics**: EPIC-CORE, EPIC-DESIGN, EPIC-I18N

**Committed Candidates**:

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **LAUNCHPAD-02**: Inline editor, reorder, and state-preserving back-to-questions | 8 | CORE | ✅ Built/verified 2026-05-04 | Hosts can add/reorder/edit one question from Launchpad; wizard round-trip has 0 state-loss bugs |
| **DESIGN-POLISH-01**: Primary CTA hover/motion polish | 3 | DESIGN | ✅ Built/verified 2026-05-04 | Vote/Join/Landing CTAs use tokenized motion and pass a11y regression checks |
| **DESIGN-POLISH-02**: Logo optical weight bump + sparkle mark | 3 | DESIGN/BRAND | ✅ Built/verified 2026-05-04 | Brand sign-off; mark used consistently across app and public surfaces |
| **AI-VIS-01**: Landing AI narrative + feature strip | 5 | MARKETING/I18N | ✅ Built 2026-05-04 | Copy approved, localized in 5 locales, and instrumented for visitor-to-signup conversion |

**Definition of Done**:
- S19-MEASURE-01 shows no launch reliability regression before rollout.
- `npm run check:i18n`, token drift checks, and a11y suite stay green.
- Launchpad preflight refreshes after add/edit/reorder operations.
- Metrics distinguish Launchpad inline edits from full wizard edits.

---

## Sprint 24: v2.2 Realtime Governance + Admin Hardening (started 2026-05-04; original window 2026-07-22 to 2026-08-05)

**Context**: Sprint 24 begins v2.2 depth work after Sprint 21-23 implementation packages were built early on 2026-05-04. The team should protect realtime stability by writing protocol governance before extending LIVE session messages, while closing the deferred admin/enterprise usability gaps.

**Goal**: Establish versioned Durable Object message contracts, mature admin analytics into usable reporting, and expose the Sprint 21 custom-role backend through Team Settings.

**Epics**: EPIC-GAM, EPIC-ENT, EPIC-OPS, EPIC-QA

**Committed Items**:

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **DO-PROTOCOL-ADR-01**: Durable Object protocol/versioning ADR | 3 | GAM/ARCH | ✅ Accepted 2026-05-04 | ADR defines message versioning, compatibility, fallback behavior, and test matrix |
| **AUTHZ-ROLE-UI-01**: Custom role-management UI | 8 | ENT/UX | Built 2026-05-04 | Team Settings lists, creates, edits, deletes, assigns, and unassigns custom roles |
| **ADMIN-ANALYTICS-01**: Admin reporting/export maturity | 5 | ENT/OPS | Built 2026-05-04 | Admin can export sanitized aggregate analytics CSV |
| **BACKLOG-HYGIENE-01**: Legacy backlog status reconciliation | 5 | DOCS/QA | In progress | Legacy v0.x stories are labeled shipped/regression contract/deferred; confusing stale status is removed |
| **S21-S23-VERIFY-01**: Early-build verification bundle | 5 | QA | In progress | Focused checks cover realtime protocol compatibility plus recently built template/Launchpad/admin surfaces |

**Stretch**:
- **GAM-LIVE-01**: LIVE energizer protocol foundation. Start only after `DO-PROTOCOL-ADR-01` and focused protocol tests are green. Foundation means feature-flagged message scaffolding only, not public gameplay rollout.

**Definition of Done**:
- No LIVE message schema change ships without protocol tests and fallback behavior.
- Admin analytics avoid PII and use route-pattern/event labels, not raw prompts or participant text.
- Backlog reconciliation keeps `ROADMAP_FULL.md`, `SPEC.md`, and `BACKLOG.md` aligned.

## Sprint 25: LIVE Energizer Protocol Foundation (started 2026-05-04)

**Context**: Sprint 25 follows the accepted Sprint 24 Durable Object protocol ADR. It is the first implementation slice of `GAM-LIVE-01`, kept behind a feature flag so existing LIVE voting remains the stable baseline.

**Goal**: Add versioned WebSocket scaffolding for LIVE energizers without public gameplay rollout.

**Committed Items**:

| Item | Size | Epic | Status | Exit Criteria |
|---|---:|---|---|---|
| **GAM-LIVE-01**: Presenter-only `energizer_activate` frame | 5 | GAM/REALTIME | Built 2026-05-04 | V1 client frame validates kind/title/id and rejects voter-triggered activation |
| **GAM-LIVE-FLAG-01**: Feature flag guard | 3 | GAM/OPS | Built 2026-05-04 | `LIVE_ENERGIZERS_ENABLED=true` is required before state mutation or broadcast |
| **GAM-LIVE-RECONNECT-01**: Reconnect snapshot support | 3 | GAM/REALTIME | Built 2026-05-04 | `init` includes active energizer state for reconnecting clients |
| **GAM-LIVE-QA-01**: Focused protocol tests | 3 | QA | Built 2026-05-04 | Unit tests cover flag-off, presenter allow, voter deny, broadcast, and reconnect |

**Definition of Done**:
- Existing vote, presenter advance/back, pause/resume, close, and reconnect tests stay green.
- No public gameplay surface depends on the new frame until staging WebSocket validation passes.
- `ROADMAP_FULL.md`, `BACKLOG.md`, and [`spec/sprints/SPRINT25_IMPLEMENTATION_SPEC.md`](../planning/sprints/SPRINT25_IMPLEMENTATION_SPEC.md) stay aligned.

## Sprint 26-32: v2.2 Live Engagement to Enterprise Release

**Context**: Sprint 24 accepted the Durable Object protocol/versioning ADR, and Sprint 25 added dark-launched LIVE energizer transport. Sprints 26-32 now sequence the remaining v2.2 engagement work from staging validation through release candidate.

**Arc Goal**: Turn LIVE energizer transport into staged gameplay, then harden scoring, badges, admin analytics, enterprise permissions, and rollout quality without regressing the core voting flow.

| Sprint | Goal | Committed Theme | Gate |
|---|---|---|---|
| **Sprint 26** | LIVE energizer activation readiness | Presenter controls, disabled/permission UX, activation state replay | Shipped in [`spec/sprints/SPRINT26_IMPLEMENTATION_SPEC.md`](../planning/sprints/SPRINT26_IMPLEMENTATION_SPEC.md) |
| **Sprint 27** | First playable LIVE energizer: Quick Finger | Participant answer UI, DO answer validation, score broadcast, reconnect-safe state | Shipped in [`spec/sprints/SPRINT27_IMPLEMENTATION_SPEC.md`](../planning/sprints/SPRINT27_IMPLEMENTATION_SPEC.md) |
| **Sprint 28** | Team Quiz LIVE loop | Quiz state machine, presenter progression, participant answer locking, reconnect tests | Shipped in `SPRINT28_IMPLEMENTATION_SPEC.md` |
| **Sprint 29** | Leaderboard + badge foundation | Aggregated scoring, live leaderboard broadcast, badge hooks, idempotency tests | Shipped in `SPRINT29_IMPLEMENTATION_SPEC.md` |
| **Sprint 30** | Admin engagement analytics maturity | Engagement funnel, CSV metrics, realtime health correlation, privacy review | No RC posture until dashboards answer support/admin questions |
| **Sprint 31** | Enterprise rollout hardening | Energizer activation permission gate, audit UX polish, staging checklist, enterprise regression | No broad rollout until permission-deny and audit paths are clear |
| **Sprint 32** | v2.2 release candidate | Full regression, spec/runbook closeout, feature-flag rollout, rollback plan | Release only after full-stack smoke and staging WebSocket validation |

**Detailed Plan**: [`SPRINT26_32_PLAN.md`](./SPRINT26_32_PLAN.md)

---

## Website Design Wave (Sprints A / B / C)

The Website Design Wave runs concurrently with (or immediately after) the 5-sprint feature arc above. It is governed by [`docs/spec/WEBSITE_DESIGN_SPEC.md`](../../specifications/product/WEBSITE_DESIGN_SPEC.md) and its machine-readable companion [`docs/spec/design-tokens.json``design-tokens.json` (not migrated). Full item list, KPIs, and exit criteria are in [`docs/BACKLOG.md §12`](../backlog/BACKLOG_MASTER.md).

| Sprint | Focus | Key items | Gate |
|---|---|---|---|
| **Sprint A** (mostly shipped / verify in S20) | Layout + token foundation — ✅ DESIGN-TYP-01, LAYOUT-SKELETON-01, LAYOUT-MOTION-01 shipped 2026-04-21 | Verify/close `LAYOUT-GRID-01`, `LAYOUT-A11Y-01`, `DESIGN-TOK-01`, `DX-INSIGHTS-01`, `I18N-BUG-01`, `I18N-BUG-02` | S20 gate reliability work must confirm token drift, i18n, and a11y checks |
| **Sprint B** (implementation complete except marketing narrative) | Narrative + wizard + launchpad + density | ✅ `AI-VIS-02`, ✅ `AI-VIS-03`, ✅ `DX-INSIGHTS-02`, ✅ `WIZ-AI-01`, ✅ `WIZ-AI-02`, ✅ `WIZ-OVERVIEW-01`, ✅ `LAUNCHPAD-01`, ✅ `LAYOUT-DENSITY-01`; `AI-VIS-01` remains marketing/copy scope | KPI measurement moves to Sprint 20 before further Launchpad expansion |
| **Sprint C** (planned after S20 readiness) | Polish | `DESIGN-POLISH-01`, `DESIGN-POLISH-02`, `LAUNCHPAD-02` | Brand sign-off on logo; 0 a11y regressions; S19 Launchpad KPI baseline acceptable |

**Critical path:** Sprint 20 verifies that design-token generation, drift checks, i18n checks, and a11y checks are trustworthy before Sprint C polish expands the surface area.

### Calendar Sprint → Design Wave Mapping

The design wave runs on its own cadence (Sprint A/B/C) overlaid on calendar sprints (18, 19, 20). Items are delivered across calendar sprints but organized by wave for design continuity.

**Wave Sprint A fulfillment** (Token foundation + layout primitives):
- ✅ `DESIGN-TYP-01`: Shipped 2026-04-21 (commit `ab5e2c1`) — typography refresh completed
- ✅ `DESIGN-TOK-01` (S18): Committed in SPRINT_PLAN.md §Sprint 18, delivered via `design-tokens.json` → Tailwind CI pipeline
- ✅ `LAYOUT-GRID-01` (S18): 12/8/4-column responsive grid primitive, tested on 3 breakpoints
- ✅ `LAYOUT-A11Y-01` (S18): WCAG 2.2 SC 2.4.11 (landmarks, skip-link, focus management) via `<SkipLink>` + `<Landmark>` components
- ✅ `AI-VIS-03` (S19): AIBadge primitive + sparkle icon (uses DESIGN-TOK-01 tokens; shipped 2026-04-30)
- ✅ `DX-INSIGHTS-01` (S18): Dashboard Insights tab scaffold; empty states ready for DX-INSIGHTS-02
- ✅ `I18N-BUG-01`, `I18N-BUG-02` (S18): Dutch string extraction, wizard key fixes

**Wave Sprint B fulfillment** (Narrative + wizard + density):
- ✅ `WIZ-AI-01`, `WIZ-AI-02`, `WIZ-OVERVIEW-01` (S19): AI-assisted session wizard, per-question editor, overview step
- ✅ `LAUNCHPAD-01` (S19): Launchpad pre-live template with action/content rails
- ✅ `AI-VIS-01` (S19): Narrative on landing page (HTML, copy, 3-up feature strip) — **pending copy sign-off**
- ✅ `AI-VIS-02` (S19): Inline AI suggestions (accept/edit/dismiss chips in wizard)
- ✅ `DX-INSIGHTS-02` (S19 conditional stretch): Top-themes card + confidence chip (depends on `insights_daily` precompute)
- ✅ `LAYOUT-DENSITY-01` (S19): Compact/comfortable/spacious density tiers on Dashboard sessions, Insights, Teams
- 🔄 `DESIGN-TYP-01` (S19): Typography applied to new wizard + Launchpad surfaces
- 🔄 `LAYOUT-MOTION-01` (S19): Micro-interactions on wizard transitions + Launchpad entry

**Wave Sprint C** (Polish — planned S20+):
- ⏳ `DESIGN-POLISH-01`: Primary CTA hover state (scale + shadow, motion.fast token)
- ⏳ `DESIGN-POLISH-02`: Logo optical weight bump + sparkle mark
- ⏳ `LAUNCHPAD-02`: Launchpad refinements post-KPI analysis

---

## Cross-Sprint Themes

### Quality Gates (All Sprints)
- `npm test` must pass (unit + integration)
- `npm run typecheck` must pass (no TS errors)
- Manual testing on 2 browsers (Chrome + Safari)
- 0 P0 bugs at sprint end

### Observability (Ongoing)
- Structured logging for all routes (request/response, latency)
- Metrics: latency, error rates, concurrent connections
- Alerts: >500ms latency, >5% error rate, DO crashes

### Docs (Sprint Completion)
- README sections for new features
- API route docs (endpoint, auth, params, response)
- Data model updates (D1 schema changes)

### Security (Ongoing)
- Every route reviewed for injection, auth, data exposure
- Secrets never in code (env vars only)
- No PII in logs or metrics

---

## Sprint Retrospective Template

**End of each sprint, discuss**:
1. **Velocity**: Points completed vs. committed (adjust estimates if needed)
2. **Blockers**: Any unresolved technical issues to carry forward
3. **Improvements**: One thing to improve next sprint
4. **Quality**: Any regressions or bugs found late?
5. **Team feedback**: Pace sustainable? Scope realistic?

---

## Appendix: Definition of Ready / Done

### Definition of Ready
- Story has clear acceptance criteria (Given/When/Then)
- Size estimated (5/8/13 pts)
- Security/privacy/a11y impact assessed
- Linked to backlog item (CORE-01, AUTH-01, etc.)
- Dependencies identified + sequenced

### Definition of Done
- Code merged to main
- Tests pass (unit + integration, >80% coverage)
- Observability events added (logs, metrics)
- Docs updated (API, data model, if applicable)
- Acceptance criteria demonstrated in PR review
- No regressions in related features

---

## Notes for Future Sprints (Sprint 6+)

Once v0.5.0 is shipped:
- Monitor KPI targets (auth success rate, engagement, churn)
- Gather user feedback on UX (onboarding, feature discovery)
- Plan feature sprints around highest-value user requests
- Possible epics: advanced templates, AI insights, mobile app, API integrations
