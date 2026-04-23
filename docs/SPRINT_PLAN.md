# Qesto — Sprint Plan (5-Sprint Roadmap)

_Document contract: This file is a **reference sequencing model** (releases **v0.1.0 → v0.5.0**) for dependencies, sizing, and sprint mechanics. The **shipped product** is **v2.x** — see [`ROADMAP_FULL.md`](./ROADMAP_FULL.md) and [`SPEC.md`](./SPEC.md) for live capability status. For committed incremental work, use [`BACKLOG.md`](./BACKLOG.md) (including §12) and [`ARCHIVED_SPRINTS.md`](./ARCHIVED_SPRINTS.md). **Documentation map:** [`README.md`](./README.md)._

_Last updated: 2026-04-23 (UTC)_
_**Sprint 18 Plan Added**: 2026-04-23 — see Sprint 18 section below. Five-sprint reference arc remains pedagogical (v0.1→v0.5). Calendar truth: Sprint 17 completed 2026-04-22; Sprint 18 runs 2026-04-29 to 2026-05-13._

---

## Overview

This plan details **five consecutive reference sprints** (example calendar anchors starting **2026-04-19**) that layer a teaching story onto an **already-shipped** baseline. Each sprint focuses on a coherent slice across one or more epics. The arc walks **auth + core session → realtime + payments → enterprise + SSO → i18n + gamification → hardening + advanced features** as a **pedagogical path**, not a claim that the product is pre-v1.

**Do not** read the dates below as “project start”; they illustrate a **dependency-ordered template** aligned to [`BACKLOG.md`](./BACKLOG.md) story IDs.

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

## Website Design Wave (Sprints A / B / C)

The Website Design Wave runs concurrently with (or immediately after) the 5-sprint feature arc above. It is governed by [`docs/specs/WEBSITE_DESIGN_SPEC.md`](./specs/WEBSITE_DESIGN_SPEC.md) and its machine-readable companion [`docs/specs/design-tokens.json`](./specs/design-tokens.json). Full item list, KPIs, and exit criteria are in [`docs/BACKLOG.md §12`](./BACKLOG.md).

| Sprint | Focus | Key items | Gate |
|---|---|---|---|
| **Sprint A** (active) | Layout + token foundation — ✅ DESIGN-TYP-01, LAYOUT-SKELETON-01, LAYOUT-MOTION-01 shipped 2026-04-21 | `LAYOUT-GRID-01`, `LAYOUT-A11Y-01`, `DESIGN-TOK-01`, `AI-VIS-03`, `DX-INSIGHTS-01`, `I18N-BUG-01`, `I18N-BUG-02` | Layout primitives must land before any consuming surface ships |
| **Sprint B** | Narrative + wizard + launchpad + density | `AI-VIS-01`, `AI-VIS-02`, `DX-INSIGHTS-02`, `WIZ-AI-01`, `WIZ-AI-02`, `WIZ-OVERVIEW-01`, `LAUNCHPAD-01`, `LAYOUT-DENSITY-01`, `LAYOUT-MOTION-01`, `DESIGN-TYP-01` | LAUNCHPAD-01 requires WIZ-OVERVIEW-01 (commits DRAFT, routes to Launchpad) |
| **Sprint C** | Polish | `DESIGN-POLISH-01`, `DESIGN-POLISH-02`, `LAUNCHPAD-02` | Brand sign-off on logo; 0 a11y regressions |

**Critical path:** `DESIGN-TOK-01` (Sprint A) unblocks `DESIGN-TYP-01`, `DESIGN-POLISH-01`, `LAYOUT-GRID-01`, and `AI-VIS-03`. Do not start consuming surfaces until the token generator CI step is green.

---

## Cross-Sprint Themes

### Quality Gates (All Sprints)
- `npm test` must pass (unit + integration)
- `tsc --noEmit` must pass (no TS errors)
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
