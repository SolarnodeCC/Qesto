# Qesto — Product Backlog (Consolidated)

_Last updated: 2026-04-11 (UTC)_
_Sprint 17 Completion Sync: 2026-04-11_

## Overview

This backlog consolidates all implemented, in-progress, and pending work across Qesto's product roadmap. Items are organized by:
1. **Status**: Implemented, In-Progress, or Pending
2. **Priority**: P0 (critical), P1 (high), P2 (medium)
3. **Sprint phase**: Allocation to Sprint A, B, C, or Sprint 17+

---

## 1) Confirmed Implemented (Code-Level)

### Bugs & Hardening (Verified)
- ✅ Session route ecosystem with explicit auth/ownership
- ✅ Route modularization and service layer patterns
- ✅ Stripe billing + webhook pathways
- ✅ WebSocket/session runtime with DO state machine tests
- ✅ Security test packs (auth, tenancy, ownership, GDPR)

### Sprint 17 Completion (2026-04-11)
- ✅ ENT-ROLE-01 — Granular enterprise roles (refine permissions for 5 roles)
- ✅ ADMIN-AN-01 — Admin metrics dashboard (Cloudflare API integration + dashboard validation)
- ✅ OBS-ALERT-01 — Alerts + runbook (alert infrastructure, dashboard + audit logging)
- ✅ I18N-QA-02 — Translation QA (100% key coverage across 5 languages + 8 namespaces)
- ✅ GAM-ADV-01 — Leaderboard/badges acceptance closure (8 badges + referral leaderboard tested)
- ✅ MAINT-RT-01 — Route refactor safety pass (import integrity audit + fixes, 14 modules validated)

### Epics (Implementation Evidence — Updated Post-Sprint 17)
| Epic | Features | Status |
|---|---|---|
| **EPIC-CORE-RT** | Realtime session lifecycle, presenter/voter flows | ✅ Implemented |
| **EPIC-AUTH** | Magic-link + SAML SSO | ✅ Implemented |
| **EPIC-BILLING** | Stripe plans + webhook integration | ✅ Implemented |
| **EPIC-I18N-BASE** | Locale bundles, language selector, i18n checks | ✅ Implemented |
| **EPIC-GAMIFICATION-BASE** | Energizer components, speed-round backend | ✅ Implemented |
| **EPIC-ENTERPRISE-OPS** | Admin audit UX, granular role model, metrics dashboard | ✅ ~85% (Sprint 17 advanced: ENT-ROLE-01, ADMIN-AN-01) |
| **EPIC-OBS-SLO** | Operational dashboards, alerting, SLOs | ✅ ~75% (Sprint 17 advanced: OBS-ALERT-01, ADMIN-AN-01) |
| **EPIC-I18N-QA** | Translation QA rigor, CI enforcement, key coverage | ✅ ~95% (Sprint 17 complete: I18N-QA-02) |
| **EPIC-MAINT-ROUTES** | Route refactor, import integrity, regression gates | ✅ ~90% (Sprint 17 complete: MAINT-RT-01) |

---

## 2) In-Progress / Partially Complete (Sprint 18+)

### Remaining Enterprise & Operations Work
- 🟡 **EPIC-ENTERPRISE-OPS**: Role refinement complete; remaining: advanced role delegation, team hierarchy (completion: ~85% → 100% targeted in future sprints)
- 🟡 **EPIC-OBS-SLO**: Alert infrastructure complete; remaining: SLO dashboard, comprehensive alerting thresholds (completion: ~75% → 90% in Sprint 18+)

### Completed Quality & Maintenance  
- ✅ **EPIC-I18N-QA**: 100% key coverage achieved; remaining: performance optimization, advanced locale scenarios (completion: ~95%)
- ✅ **EPIC-MAINT-ROUTES**: Import integrity audit complete; remaining: performance optimization of hot routes (completion: ~90%)

---

## 3) Sprint 16 v2 Stabilization Wave (If Needed)

**Trigger**: Run if release confidence < threshold after regression pass.

| Item | Owner | Exit Criteria |
|---|---|---|
| Fix-only stabilization (no large features) | Backend | Acceptance gaps resolved |
| Enterprise audit UX + pagination/export | Frontend + PO | User acceptance demos |
| Session start/live/close regression pass | QA | 100% core flows green |
| Billing webhook handling regression | Backend + Tester | 0 transaction anomalies |
| Translation QA on high-traffic screens (EN/NL/ES/DE/FR) | i18n | 0 missing keys, no truncation |

**Exit Criteria**: No P0 regressions, full test suite green, all deferred S15/S16 stories closed or re-scoped.

---

## 4) Pending Items — Sprint A Candidates (Next Committed)

### Refactoring & Maintainability (P0/P1)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 1 | Split hotspot API orchestration | P0 | Backend + Architect | -30% regressies hotspot routes | Route boundaries |
| 2 | Shared session lifecycle service | P0 | Backend | <1% state transition errors | Session/DO contracts |
| 5 | Idempotent write handlers | P0 | Backend | 0 dubbele mutaties | Request dedupe |
| 3 | Typed error taxonomy | P1 | Backend + Frontend | 100% uniform error shape | API contract |
| 4 | Startup config validation | P1 | Backend + DevOps | 0 misconfigured starts | Env schema |

### Cloudflare Integration (P0/P1)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 6 | D1 query governance + index audit | P0 | Backend + Architect | p95 DB latency budget met | Index policy |
| 9 | Webhook idempotency ledger | P0 | Backend + Security | 0 dubbele billing updates | Stripe flow |
| 14 | Dead-letter + replay flow | P0 | DevOps + Backend | 100% failed events replayable | Event ledger |
| 7 | KV key/TTL standard | P1 | Backend + DevOps | <2% stale cache incidents | Key taxonomy |
| 8 | DO resilience checks | P1 | Backend + Tester | 100% reconnect tests pass | DO testset |
| 10 | Vectorize benchmarkset | P1 | AI + Backend | +15% precision@k | Gold dataset |
| 11 | Workers AI guardrails | P1 | AI + Security | <1% policy violations | Guardrail rules |

### Integration Reliability (P0/P1)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 12 | Integration contract tests | P1 | Tester + Backend | 100% kritieke contracts covered | Provider specs |
| 13 | Retry/backoff policy matrix | P1 | Backend + DevOps | -40% transient failures impact | Provider runbook |
| 15 | Integration health dashboard | P1 | DevOps + Analytics | MTTR -25% | Metrics surface |
| 16 | Multi-tenant integration safeguards | P1 | Security + Backend | 0 cross-tenant incidents | Tenant policy |

### UI/UX & Accessibility (P0/P1)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 18 | A11y hardening critical flows | P0 | Frontend + Tester | WCAG AA on top flows | A11y suite |
| 20 | Error UX standardization | P0 | Frontend + PO | -20% support tickets | Error pattern library |
| 17 | Design-token audit + cleanup | P1 | Frontend | -20% visual inconsistency defects | Token inventory |
| 19 | Performance budget (Vote/Solutions) | P1 | Frontend + Architect | LCP/TTI target met | Perf tooling |
| 21 | i18n quality wave 2 | P1 | i18n + Frontend | 0 missing keys, less truncation | Locale QA |

### Security & Compliance (P0/P1)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 24 | Secret governance automation | P0 | DevOps + Security | 0 secret leak incidents | CI security gates |
| 22 | JWT/magic-link threat model refresh | P1 | Security | 100% high risks classified | Threat model |
| 23 | SAML hardening checklist | P1 | Security + Backend | -30% SSO onboarding issues | SAML checklist |
| 25 | Audit log completeness matrix | P1 | Security + Backend | 100% mutating endpoints auditable | Audit map |
| 26 | GDPR erase verification suite | P1 | Security + Tester | 100% erase provable | Deletion tests |

### Testing, Observability & Quality (P0/P2)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 27 | Test pyramid + CI quality gates | P0 | Tester | <5% escaped defects | CI policy |
| 28 | Synthetic journey monitoring | P1 | DevOps + Analytics | >80% incident pre-detection | Synthetic monitors |
| 29 | Unified SLO dashboard + alerts | P2 | DevOps + Analytics | >99% SLO compliance critical services | SLI/SLO definitions |
| 30 | Backlog-to-evidence discipline | P2 | PO + Architect | 100% items with evidence link | Governance |

### Templates & Warm UX (P0)

| ID | Item | Pri | Owner | KPI | Dependencies |
|---|---|---|---|---|---|
| 31 | Template foundation pack (min 3 per topic) | P0 | PO + Frontend + Content | +25% faster "time to first session" | Template curation |
| 34 | Template preview→confirm→wizard flow | P0 | Frontend + Backend | +15% template-to-session conversion | Wizard integration |
| 35 | Warm welcome journey (host + participant) | P0 | Frontend + PO + Marketing | +10% participant completion rate | UX copy + journey instrumentation |
| 36 | Participant trust kit (privacy + anonymity) | P0 | Security + Frontend + i18n | +15% trust score / lower join drop-off | Privacy messaging |
| 32 | Template metadata standard | P1 | PO + Backend | 100% templates with complete metadata | Schema + UI |
| 33 | Template versioning + changelog + deprecation | P1 | Architect + Backend | 0 regressions from template changes | Versioning policy |

---

## 5) Sprint Phase Allocation

### Sprint A — Critical Foundation + Trust (IDs: 1, 2, 5, 6, 9, 14, 18, 20, 24, 27, 31, 34, 35, 36)

**Goal**: Ship idempotent core, unblock enterprise security, establish warm UX baseline.

**KPI targets**:
- +25% "time to first session"
- +10% participant join completion
- -15% early drop-off (first 60s)
- 0 secret leak incidents
- <5% escaped defects

**Exit criteria**:
- All Sprint A AC's demonstrated
- Measurement events live on onboarding/join/template flows
- No blocker defects on join/wizard/template selection

---

### Sprint B — Robustness + Scale (IDs: 3, 4, 7, 8, 12, 13, 15, 16, 22, 23, 25, 28, 32, 33)

**Goal**: Harden enterprise grade, integrate resilience, refine template lifecycle.

**KPI targets**:
- -40% transient integration failures impact
- -30% SSO onboarding issues
- MTTR -25% on integration incidents
- 100% template metadata completeness

**Exit criteria**:
- Security review sign-off on all auth/integration changes
- Reproducible replay flow for failed events
- Audit coverage on all mutating endpoints proven

---

### Sprint C — Maturity + Optimization (IDs: 10, 11, 17, 19, 21, 26, 29, 30)

**Goal**: Optimize AI quality, dashboard maturity, design/performance polish.

**KPI targets**:
- +15% retrieval quality (precision@k)
- >99% SLO compliance critical services
- 0 missing keys + less truncation in i18n
- -20% visual inconsistency defects

**Exit criteria**:
- Dashboards + alerting live for API/WS/AI/billing
- Template lifecycle governance documented + applied
- 100% backlog items with evidence link

---

## 6) Dependencies Matrix

| Dependency | Required For | Note |
|---|---|---|
| Template foundation (31) | 32, 33, 34 | Core content first, then metadata/versioning |
| Error UX + a11y (20, 18) | 35, 36 | Warmth without clear error handling fails |
| Secret governance (24) | 22, 23, 25 | Security baseline for enterprise trust |
| Idempotency + DLQ (9, 14) | 15, 29 | Reliable metrics depend on reliable event processing |
| Core refactor (1, 2, 5) | 27, 28 | Predictable architecture for stable test/monitoring |
| SLO dashboard (29) | 30 | Evidence discipline needs consistent SLI/SLO signals |

---

## 7) Definition of Ready / Done

### Definition of Ready
- Problem statement, target audience, hypothesis are concrete
- KPI + measurement method named
- Acceptance criteria in Given/When/Then format
- Security/privacy/a11y impact assessed
- Dependencies + scope-in/out confirmed

### Definition of Done
- Code + tests + docs updated
- Observability evidence (metrics/logs) available
- Security/privacy review completed (if applicable)
- Evidence link added to backlog item

---

## 8) Release Readiness Guardrails

- ✅ No sprint closure without `npm test` + `tsc --noEmit` green
- ✅ No epic closure without evidence links (tests/routes/components)
- ✅ Backlog item status maps to concrete implementation artifact
- ✅ P0 defects always enter sprint first
- ✅ Sprint velocity tracked; stories >13pt split pre-sprint

---

## 9) Evidence & Links (To Be Updated as Implementation Progresses)

| ID | Component | Test Location | Route | Component |
|---|---|---|---|---|
| 1 | Hotspot refactor | `tests/unit/api/` | `functions/api/routes/` | TBD |
| 2 | Session lifecycle | `tests/unit/services/` | `functions/api/routes/sessions.routes.ts` | TBD |
| 6 | D1 governance | `tests/unit/db/` | `functions/api/` | Schema validation |
| 18 | A11y hardening | `tests/a11y/` | N/A | `src/components/` |
| 27 | Test gates | `.github/workflows/` | N/A | CI config |
| 31 | Templates | `tests/functional/ui/` | `functions/api/routes/templates.ts` | `src/templates/` |

---

## 10) Cadence & Review

- **Weekly**: Backlog triage & refinement for upcoming sprint
- **Monthly**: Backlog hygiene pass (archive completed, reprioritize)
- **Sprint-start**: Confirm scope, assign owners, bind to deliverables
- **Sprint-end**: Evidence collection, update KPI status, reflect on velocity

---

## Appendix: Historical Notes

**Sprint 15 retrospective**: Majority of base capabilities implemented; closure quality depends on acceptance rigor.

**Sprint 16 retrospective**: Implementation progress exists; release confidence depends on regression pass + enterprise QA completion.

**Sprint 16 v2 (conditional)**: If release confidence < threshold, run stabilization sprint covering acceptance gaps, regression, and QA hardening.

**Sprint 17 (completed 2026-04-11)**: ✅ Ship enterprise-operational completeness + measurable reliability improvements:
- ENT-ROLE-01: Role permissions refined (5 roles, fine-grained checks)
- ADMIN-AN-01: Dashboard validated + Cloudflare API integration
- OBS-ALERT-01: Alert infrastructure deployed (dashboard + audit logging)
- I18N-QA-02: 100% key coverage across 5 languages + 8 namespaces
- GAM-ADV-01: 8 badges + leaderboard acceptance tests complete
- MAINT-RT-01: Import integrity audit complete across 14 route modules
- Outcome: 0 regressions, all tests green, enterprise reliability hardened

**Sprint 18 (planned)**: Ship critical foundation + trust baseline (Sprint A):
- 14 items: refactoring, Cloudflare integration hardening, A11y/UX polish, security foundations, template warm UX
- Goal: -30% hotspot regressions, 0 secret leaks, +25% "time to first session", +10% participant completion
- Dependencies: Ensure ID 1,2,5,6,9,14 (core refactoring) land first; unblock IDs 27,28,29,30 (observability)

---

## 11) Sprint 18 Scope — Critical Foundation + Trust (Sprint A)

### Summary
Following Sprint 17's enterprise hardening, Sprint 18 focuses on **critical technical foundation + warm UX baseline**. 14 items (Sprint A) organized by risk/dependency:

### P0 Items (Must Commit — 8 items)
1. **ID 1**: Split hotspot API orchestration (-30% regressions)
2. **ID 2**: Shared session lifecycle service (<1% state transition errors)
3. **ID 5**: Idempotent write handlers (0 duplicate mutations)
4. **ID 6**: D1 query governance + index audit (p95 latency budget)
5. **ID 9**: Webhook idempotency ledger (0 duplicate billing updates)
6. **ID 14**: Dead-letter + replay flow (100% event recoverability)
7. **ID 18**: A11y hardening critical flows (WCAG AA compliance)
8. **ID 20**: Error UX standardization (-20% support tickets)

### P0 Foundation (2 items — enable observability)
9. **ID 24**: Secret governance automation (0 secret leaks)
10. **ID 27**: Test pyramid + CI quality gates (<5% escaped defects)

### P0 Warm UX (4 items — drive adoption)
11. **ID 31**: Template foundation pack (+25% time-to-first-session)
12. **ID 34**: Template preview→confirm→wizard (+15% template-to-session conversion)
13. **ID 35**: Warm welcome journey (+10% participant completion)
14. **ID 36**: Participant trust kit (+15% trust score)

### Dependencies & Sequencing
**Phase 1 (Core)**: IDs 1, 2, 5, 6, 9, 14 — foundation refactoring (unblocks all observability)
**Phase 2 (Stability)**: IDs 18, 20, 24, 27 — UX + security polish + test gates (validate Phase 1)
**Phase 3 (Adoption)**: IDs 31, 34, 35, 36 — template warm UX (enabled by Phase 1 + 2)

### Exit Criteria
- All P0 items shipped + tested
- A11y: WCAG AA on top flows (Vote, Join, Solutions)
- Templates: ≥3 templates per topic, wizard flow live
- Observability: SLOs defined, dashboards live, no silent failures
- KPI targets met: +25% time-to-first-session, +10% participant completion

---

**See also**:
- `SPRINT_PLAN.md` — current sprint goals + exit criteria
- `ARCHITECTURE.md` — system design + data model  
- `ROADMAP_FULL.md` — release timeline + version targets
- `CLAUDE.md` — L1 project context + hard rules
