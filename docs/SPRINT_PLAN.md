# Qesto — Sprint Plan (Latest)

_Last updated: 2026-04-12 (UTC)_

## Current Reality Snapshot

- Platform is running on release line **v2.0.0**
- Multiple core epics implemented; remaining work focuses on hardening, enterprise depth, and operational polish
- **Backlog consolidated**: See `BACKLOG.md` for full 36-item product + architecture roadmap (P0/P1 prioritized, Sprint A/B/C allocated)
- **Historical sprints** (15, 16, 16v2, 17): See `ARCHIVED_SPRINTS.md` for completion summaries

---

## Completed Sprints Reference

Sprints 15, 16, and 17 have been successfully completed. For historical details:

| Sprint | Status | Focus | Outcome |
|---|---|---|---|
| **Sprint 15** | ✅ Complete | Enterprise + i18n foundation | Base capabilities established |
| **Sprint 16** | ✅ Complete | Architecture, AI, a11y, backlog convergence | Architecture finalized, backlog consolidated |
| **Sprint 16 v2** | ❌ Not Executed | Conditional stabilization (contingency) | Not needed; sufficient quality confidence |
| **Sprint 17** | ✅ Complete | Enterprise ops + reliability | 6/6 items shipped, 0 regressions |

**See `ARCHIVED_SPRINTS.md` for full historical context.**

---

## Backlog Overview

The consolidated backlog (`BACKLOG.md`) organizes all remaining work into:
- **36 backlog items** (IDs 1-36) prioritized by WSJF
- **Sprint A** (14 items): Critical foundation + trust baseline
- **Sprint B** (14 items): Robustness + scale
- **Sprint C** (8 items): Maturity + optimization

---

## Active Sprint

### Sprint 18 — Critical Foundation + Trust (Sprint A)

**Status**: IN PLANNING — Ready for Kickoff  
**Dates**: 2026-04-12 to 2026-04-26 (2-week sprint)  
**Objective**: Establish idempotent core, unblock enterprise security, and set warm UX baseline.

**Committed Items**: 14 items (Sprint A allocation from backlog)

**Item Breakdown by Category**:
1. **Refactoring & Maintainability** (4 items)
   - ID 1: Split hotspot API orchestration (P0)
   - ID 2: Shared session lifecycle service (P0)
   - ID 5: Idempotent write handlers (P0)
   - ID 3: Typed error taxonomy (P1)

2. **Cloudflare Integration** (6 items)
   - ID 6: D1 query governance + index audit (P0)
   - ID 9: Webhook idempotency ledger (P0)
   - ID 14: Dead-letter + replay flow (P0)
   - ID 7: KV key/TTL standard (P1)
   - ID 8: DO resilience checks (P1)
   - ID 10: Vectorize benchmarkset (P1)

3. **UI/UX & Accessibility** (2 items)
   - ID 18: A11y hardening critical flows (P0)
   - ID 20: Error UX standardization (P0)

4. **Security & Compliance** (1 item)
   - ID 24: Secret governance automation (P0)

5. **Testing & Observability** (1 item)
   - ID 27: Test pyramid + CI quality gates (P0)

6. **Templates & Warm UX** (4 items)
   - ID 31: Template foundation pack (P0)
   - ID 34: Template preview→confirm→wizard flow (P0)
   - ID 35: Warm welcome journey (P0)
   - ID 36: Participant trust kit (P0)

**KPI Targets**:
- +25% time-to-first-session
- +10% participant join completion rate
- -15% early drop-off (first 60s)
- 0 secret leak incidents
- <5% escaped defects

**Definition of Done**:
- Feature implemented + route/UI tests updated
- Observability event coverage included for each new flow
- Product + architecture docs updated in same PR
- KPI measurement events live + tracked

**Detailed Implementation Plan**: See `SPRINT_18_IMPLEMENTATION.md`

---

## Planned Sprints

### Sprint 19 — Robustness + Scale (Sprint B)

**Status**: PLANNED  
**Dates**: 2026-04-26 to 2026-05-10 (2-week sprint)  
**Scope**: 14 items (Sprint B allocation from backlog)

**Focus**: Harden enterprise grade, integrate resilience, refine template lifecycle

**Phase Breakdown**:
1. **Phase 1 (Integration Hardening)**: IDs 3, 4, 7, 8, 12, 13
   - Typed error taxonomy, config validation, KV standards, DO resilience, contract tests, retry policies
   
2. **Phase 2 (Enterprise Safeguards)**: IDs 15, 16, 22, 23, 25
   - Health dashboard, multi-tenant isolation, auth threat modeling, SAML hardening, audit logs
   
3. **Phase 3 (Template Maturity)**: IDs 28, 32, 33
   - Synthetic monitoring, metadata standardization, versioning + deprecation

**KPI Targets**:
- -40% transient integration failures impact
- -30% SSO onboarding issues
- MTTR -25% on integration incidents
- 100% template metadata completeness
- >80% incident pre-detection

**Effort**: 37-39 story points (1-2 dev team)

**Release Target**: v2.1.0 (enterprise-grade integrations)

**Detailed Implementation Plan**: See [`SPRINT_19_IMPLEMENTATION.md`](SPRINT_19_IMPLEMENTATION.md)

---

### Sprint 20 — Maturity + Optimization (Sprint C)

**Status**: PLANNED  
**Dates**: 2026-05-10 to 2026-05-24 (2-week sprint)  
**Scope**: 8 items (Sprint C allocation from backlog)

**Focus**: Optimize AI quality, dashboard maturity, design/performance polish

**Phase Breakdown**:
1. **Phase 1 (AI + Design)**: IDs 10, 11, 17, 19
   - Vectorize benchmarking, AI guardrails, design tokens, performance budgets
   
2. **Phase 2 (Compliance + Ops)**: IDs 21, 26, 29, 30
   - i18n quality wave 2, GDPR erase verification, SLO dashboard, evidence governance

**KPI Targets**:
- +15% retrieval quality (precision@k)
- >99% SLO compliance critical services
- 0 missing i18n keys + eliminate text truncation
- -20% visual inconsistency defects
- 100% backlog evidence traceability

**Effort**: 66-91 story points (can be phased)

**Release Target**: v2.2.0 (platform maturity + optimization)

**Detailed Implementation Plan**: See [`SPRINT_20_IMPLEMENTATION.md`](SPRINT_20_IMPLEMENTATION.md)

---

## Release & Version Timeline

| Release | Sprints | Target Date | Focus |
|---|---|---|---|
| **v2.0.0** | Sprint 18 | 2026-04-26 | Critical foundation + trust |
| **v2.1.0** | Sprint 19 | 2026-05-10 | Robustness + scale |
| **v2.2.0** | Sprint 20 | 2026-05-24 | Maturity + optimization |

---

## Related Documentation

- `ARCHIVED_SPRINTS.md` — Historical context for Sprints 15-17
- `BACKLOG.md` — Complete 36-item roadmap with dependencies
- `SPRINT_18_IMPLEMENTATION.md` — Phase-by-phase execution plan (active)
- `CLAUDE.md` — Hard rules, sprint planning policies
- `ARCHITECTURE.md` — System design and data model
