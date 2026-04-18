# Sprint 20 Implementation Plan — Maturity + Optimization (Sprint C)

_Prepared: 2026-04-12 | Target Dates: 2026-05-10 to 2026-05-24 (2-week sprint)_

## Executive Summary

Sprint 20 optimizes AI retrieval quality, hardens design consistency, locks down compliance, and operationalizes SLO dashboards. **8 items** organized into **2 phases**:

- **Phase 1 (AI + Design)**: IDs 10, 11, 17, 19 — Vectorize benchmarking, AI guardrails, design tokens, performance budgets
- **Phase 2 (Compliance + Ops)**: IDs 21, 26, 29, 30 — i18n quality, GDPR erase verification, SLO dashboard, evidence governance

**KPI Targets**:
- +15% retrieval quality (precision@k for semantic search)
- >99% SLO compliance for critical services (API, WebSocket, AI, billing)
- 0 missing i18n keys + eliminate text truncation
- -20% visual inconsistency defects (design tokens)
- 100% backlog evidence traceability

**v2.2.0 Release Readiness**: All 8 items shipped, 100% backlog evidence links, zero regressions.

---

## Phase 1: AI Quality + Design Polish (4 P1 Items)

### ID 10: Vectorize Benchmarkset — AI Quality Foundation

**Problem Statement:**
Semantic search in decisions (Vectorize) lacks a gold benchmark dataset. Without ground-truth measurements, we cannot validate +15% retrieval quality improvements.

**Acceptance Criteria:**
- Gold Dataset (50+ query-result pairs):
  - 50-100 representative business queries (e.g., "What pricing objections emerged?")
  - 5-10 known-relevant decision IDs per query (hand-labeled)
  - 70% train / 30% test split
  
- Evaluation Framework:
  - Precision@k (k=5, 10, 20): % of top-K results marked relevant
  - Recall@k: % of all relevant docs returned
  - NDCG@k: ranked relevance score
  - Baseline metrics recorded pre-optimization
  
- Optimization Pass:
  - Query preprocessing: stemming, synonym expansion, domain-specific stop words
  - Candidate retrieval: tune similarity threshold
  - Re-ranking: use LLM to re-rank top-20 by semantic match
  - Target: precision@10 ≥ +15% vs baseline
  
- Test Suite:
  - Precision@k regression tests (CI gate)
  - Query analytics: latency (p50/p95) + result count
  - Document coverage: no indexing gaps
  
- Dashboard:
  - Query performance leaderboard
  - Precision trend (track over time)
  - Embedding stats

**Files to Create/Modify:**
```
functions/api/vectorize.ts                   (MODIFY)
functions/api/db.ts                          (MODIFY)
tests/performance/vectorize-benchmark.test.ts (NEW)
scripts/vectorize-benchmark-loader.ts        (NEW)
docs/VECTORIZE_EVALUATION.md                 (NEW)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** Precision@10: baseline → +15% improvement

**Dependencies:** None (Phase 1 foundation)

---

### ID 11: Workers AI Guardrails — AI Safety Policy Enforcement

**Problem Statement:**
Llama 3.3 70B generates answers without safety filters. Risk: policy violations (hate speech, misinformation, PII leakage), untraced violations.

**Acceptance Criteria:**
- Policy Definitions (3 violation tiers):
  - CRITICAL: PII leakage, hate speech, illegal → reject + alert
  - WARNING: Misinformation, hostile tone → flag + annotate
  - INFO: Excessive verbosity, unsafe format → warn + suggest
  
- Pre-Generation Guardrails:
  - Input length limits (max 2000 chars)
  - Sanitization (escape special chars, normalize)
  
- Post-Generation Guardrails:
  - PII detection (regex for email, SSN)
  - Toxicity scoring
  - Length validation
  - Format validation
  
- Audit Logging:
  - All violations logged: {timestamp, prompt, violation_type, severity, action}
  - Admin dashboard: view + filter violations
  - False positive tracking
  
- Feedback Loop:
  - Safety alerts to ops (hourly summary)
  - Escalation: >2% violation rate → PagerDuty alert

**Files to Create/Modify:**
```
functions/api/ai-guardrails.ts               (NEW)
functions/api/middleware/aiSafetyFilter.ts   (NEW)
functions/api/types/safety.ts                (NEW)
functions/api/db.ts                          (MODIFY)
functions/api/insights.ts                    (MODIFY)
functions/api/services/aiSafetyAudit.ts     (NEW)
tests/unit/ai-guardrails.test.ts            (NEW)
tests/integration/ai-safety-end-to-end.test.ts (NEW)
docs/AI_SAFETY_POLICY.md                    (NEW)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** Violation rate <1%, <1% CRITICAL detection latency <5min

**Dependencies:** None (Phase 1 foundation)

---

### ID 17: Design-Token Audit + Cleanup — Design System Maturity

**Problem Statement:**
Design tokens scattered across `index.css` and inline styles. Token duplication, inconsistent naming, missing dark mode. Result: -20% visual consistency, accessibility gaps.

**Acceptance Criteria:**
- Token Inventory (comprehensive audit):
  - Colors, typography, spacing, shadows, animations
  - Deduplicate: merge similar shades, standardize naming
  - Semantic tokens: `--color-error` instead of `--color-red-600`
  - Dark mode: 100% token coverage (light + dark variants)
  
- Component Audit (6 critical flows):
  - Vote page, Solutions page, Join page, Admin panel, Presenter view, Templates/wizard
  - Replace inline styles with token refs
  - Accessibility: color contrast ≥4.5:1 (AA)
  
- Tailwind Integration:
  - Export tokens as Tailwind config
  - All components use Tailwind classes
  - CI gate: block inline style props (ESLint)
  
- Documentation:
  - Design tokens guide
  - Token change process
  - Accessibility checklist
  - Figma sync (if applicable)

**Files to Create/Modify:**
```
src/index.css                                (MODIFY)
tailwind.config.ts                           (MODIFY)
src/design-tokens.json                       (NEW)
src/design-tokens-dark.json                  (NEW)
src/components/Vote.tsx                      (MODIFY)
src/components/Solutions.tsx                 (MODIFY)
src/pages/Vote.tsx                           (MODIFY)
src/pages/SolutionsPage.tsx                  (MODIFY)
src/pages/JoinPage.tsx                       (MODIFY)
src/pages/AdminPanel.tsx                     (MODIFY)
src/pages/Present.tsx                        (MODIFY)
.eslintrc.json                               (MODIFY)
tests/visual/design-tokens.test.ts           (NEW)
docs/DESIGN_TOKENS.md                        (NEW)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** -20% visual inconsistency defects, 100% color contrast ≥4.5:1

**Dependencies:** None (can start early)

---

### ID 19: Performance Budget (Vote/Solutions) — Frontend Speed Optimization

**Problem Statement:**
Vote and Solutions pages have no performance budget. LCP, TTI, CLS not measured. Risk: slow load → participant drop-off.

**Acceptance Criteria:**
- Web Vitals Instrumentation:
  - Measure: LCP (Largest Contentful Paint), TTI (Time to Interactive), CLS (Cumulative Layout Shift)
  - Send metrics to observability backend
  - Baseline: measure current state
  
- Performance Budgets:
  - Vote: LCP ≤2.5s, TTI ≤3.5s, CLS ≤0.1, JS ≤150KB (gzipped)
  - Solutions: LCP ≤2.5s, TTI ≤3.5s, CLS ≤0.1, JS ≤120KB (gzipped)
  
- Optimization Pass:
  - Code splitting: lazy-load non-visible components
  - Image optimization: WebP, lazy-load, responsive sizes
  - Script optimization: async/defer, remove unused dependencies
  - Font optimization: preload critical fonts, font-display: swap
  - Layout stability: use CSS aspect-ratio to reserve space
  
- Monitoring:
  - Real User Metrics (RUM) on prod
  - Lighthouse CI on every PR (budget enforcement)
  - Alerting: LCP >3s in last 1h → alert ops

**Files to Create/Modify:**
```
src/pages/Vote.tsx                           (MODIFY)
src/pages/SolutionsPage.tsx                  (MODIFY)
src/lib/webVitals.ts                         (NEW)
src/hooks/usePerformance.ts                  (NEW)
.github/workflows/lighthouse-ci.yml          (NEW)
lighthouse.config.json                       (NEW)
scripts/measure-performance.ts               (NEW)
docs/PERFORMANCE_BUDGET.md                   (NEW)
tests/performance/vote-page.test.ts          (MODIFY)
tests/performance/solutions-page.test.ts     (MODIFY)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** LCP ≤2.5s, TTI ≤3.5s, CLS ≤0.1, 0 budget violations in CI

**Dependencies:** ID 17 (design tokens) helpful but not blocking

---

## Phase 2: Compliance + Operations (4 P1/P2 Items)

### ID 21: i18n Quality Wave 2 — Internationalization Rigor

**Problem Statement:**
Sprint 17 achieved 100% key coverage. Wave 2 addresses runtime quality: missing keys in edge cases, text truncation on mobile, poor translations.

**Acceptance Criteria:**
- Missing Key Detection:
  - Runtime check: if key not found, log warning + show `[MISSING: key_name]`
  - Coverage: ensure 100% of user-facing text is i18n keyed
  - Exception list: document intentionally dynamic keys
  
- Text Length Validation:
  - Character limits: labels 40, buttons 20, descriptions 250
  - Check translations against limits
  - Use CSS text-overflow: ellipsis as fallback
  
- Translation Quality:
  - Review by native speakers in context
  - Quality metrics: 1-5 star rating (target 4.5+)
  - Common issues: terminology, tone, cultural appropriateness
  
- Locale Expansion (2-3 new):
  - Greek, Portuguese identified as priority
  - Professional translation
  - Native speaker QA
  
- Dynamic Content:
  - Date formatting: `Intl.DateTimeFormat`
  - Number formatting: `Intl.NumberFormat`
  - Plural rules per locale
  - Message formatting: "Hello {{name}}"

**Files to Create/Modify:**
```
public/locales/*/                            (MODIFY)
public/locales/el/                           (NEW - Greek)
public/locales/pt/                           (NEW - Portuguese)
src/lib/i18n.ts                              (MODIFY)
src/hooks/useI18n.ts                         (NEW)
src/components/I18nDebug.tsx                 (NEW)
tests/i18n/missing-keys.test.ts              (NEW)
tests/i18n/truncation.test.ts                (NEW)
tests/i18n/translation-quality.test.ts       (NEW)
docs/I18N_GUIDE.md                           (MODIFY)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** 0 missing keys, 0 truncation, 4.5+ avg quality, ≥2 new locales

**Dependencies:** None (parallel with Phase 1)

---

### ID 26: GDPR Erase Verification Suite — Compliance Rigor

**Problem Statement:**
GDPR erase endpoints exist. Sprint 20 hardens verification: comprehensive test suite ensuring 100% data erasure (KV, D1, DO, Vectorize, audit logs).

**Acceptance Criteria:**
- Test Coverage:
  - Full user erase: delete user → verify all KV/D1 records gone
  - Per-session respondent: delete voter → vote records gone, counts updated
  - Cascading: erase user → all owned sessions marked orphaned
  - Audit trail: all erases logged, queryable
  - Concurrent: erase + session activity → erase wins
  - Partial failure: transaction rollback, no orphaned data
  - Idempotency: re-erase same user idempotent
  - Vectorize: deleted decisions removed from vector index
  
- Verification Tools:
  - Admin CLI: `qesto-cli verify-erase <user_id>` → confirms all deleted
  - Audit export: `GET /admin/audit/erases?format=csv`
  - Compliance report: auto-generate monthly GDPR report
  
- Documentation:
  - GDPR runbook: step-by-step manual verification
  - Incident response: what if erase fails
  - Evidence links: where to find test results for auditors

**Files to Create/Modify:**
```
tests/data-security/gdpr/erase-verification.test.ts (NEW)
tests/data-security/gdpr/cascading-deletes.test.ts (NEW)
tests/data-security/gdpr/audit-trail.test.ts (NEW)
functions/api/routes/admin.routes.ts          (MODIFY)
functions/api/services/eraseService.ts        (NEW)
functions/api/db.ts                           (MODIFY)
scripts/cli/verify-erase.ts                   (NEW)
docs/GDPR_COMPLIANCE.md                       (NEW)
docs/GDPR_INCIDENT_RESPONSE.md                (NEW)
.github/workflows/gdpr-compliance-check.yml   (NEW)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** 100% erase provable, 0 GDPR violations, 100% test coverage

**Dependencies:** Phase 1 70% done (no blocking dependencies)

---

### ID 29: Unified SLO Dashboard + Alerts — Operations Maturity

**Problem Statement:**
Observability exists (Sprint 17: alerts + runbook). Sprint 20 consolidates into unified SLO dashboard with clear health visibility.

**Acceptance Criteria:**
- SLO Definitions (per service):
  - API Gateway: 99% availability, latency p99 ≤500ms
  - WebSocket: 99.5% availability, latency p99 ≤200ms
  - AI Generation: 99% success rate, latency p99 ≤10s
  - Billing Webhooks: 99.9% delivery, 0 data loss
  - D1 Database: 99.5% availability, query latency p99 ≤100ms
  
- Error Budget:
  - Calculate: 100% - SLO% = budget
  - Example: 99% SLO = 7.2 hours error budget/month
  - Alert if >50% consumed early in month
  
- Dashboard (unified view):
  - Service health (last 7 days): green/yellow/red
  - Availability: % uptime + error budget
  - Latency: p50/p95/p99 trends
  - Error rate: % failures by type
  - Incident history: recent incidents + MTTR
  
- Alert Thresholds:
  - Critical: SLO breached → PagerDuty
  - Warning: trending toward breach → Slack
  - Runbook link: included with alert
  
- Metrics Collection:
  - API: status codes, latency, endpoints
  - WebSocket: connections, disconnections, throughput
  - AI: request count, latency, error types
  - Billing: webhook count, delivery status, retry count

**Files to Create/Modify:**
```
functions/api/middleware/observability.ts     (MODIFY)
functions/api/services/sloMonitor.ts          (NEW)
functions/api/routes/observability.routes.ts  (NEW)
functions/api/db.ts                           (MODIFY)
functions/worker-tail/slo-metrics.ts          (NEW)
src/pages/AdminPanel.tsx                      (MODIFY)
src/components/SLODashboard.tsx               (NEW)
src/components/ServiceHealthCard.tsx          (NEW)
src/components/ErrorBudgetGauge.tsx           (NEW)
.github/workflows/slo-alert.yml               (NEW)
docs/SLO_DEFINITIONS.md                       (NEW)
docs/INCIDENT_RUNBOOK.md                      (MODIFY)
```

**Effort Estimate:** 8-13 story points

**KPI Target:** >99% SLO compliance per service, MTTR <30min, 0 silent failures

**Dependencies:** Phase 1 70% done (no blocking dependencies)

---

### ID 30: Backlog-to-Evidence Discipline — Governance & Accountability

**Problem Statement:**
Backlog items completed but evidence not systematically linked. No audit trail for stakeholders.

**Acceptance Criteria:**
- Evidence Framework (3-tier):
  1. Code Location: which files modified/created
  2. Test Location: which test verifies acceptance criteria
  3. Deployment Evidence: feature flag, rollout plan, KPI measurement
  
- Backlog Schema Update:
  - Add columns: test_location, code_location, feature_flag, kpi_event, rollout_plan, evidence_link
  
- Per-Item Evidence Template:
  ```
  ## ID XX: [Item Name]
  
  ### Code Changes
  - [List files modified]
  
  ### Test Location
  - Test file: tests/path/to/test.ts
  - Test name: "Should [acceptance criterion]"
  
  ### Deployment Evidence
  - Feature flag: FF_ITEM_XX
  - Rollout: 25% → 50% → 100%
  
  ### KPI Measurement
  - Event: item_XX_success
  - Dashboard: [link to analytics]
  
  ### Deployment Date
  - Merged: YYYY-MM-DD
  - Rolled out: YYYY-MM-DD
  ```
  
- Governance Process:
  - Item start: create evidence stub
  - Item progress: update evidence in PR
  - Item completion: PR only merges if evidence complete
  - Sprint closure: 100% items audited for evidence
  
- Backlog Audit:
  - Script scans for missing evidence
  - PR blocked if evidence incomplete
  - Monthly: auto-generate compliance report

**Files to Create/Modify:**
```
BACKLOG.md                                   (MODIFY)
docs/EVIDENCE_FRAMEWORK.md                   (NEW)
scripts/audit-evidence.ts                    (NEW)
.github/workflows/evidence-check.yml         (NEW)
.github/pull_request_template.md             (MODIFY)
```

**Effort Estimate:** 5-8 story points

**KPI Target:** 100% backlog items with evidence link, 0 missing evidence fields

**Dependencies:** None (can implement in parallel)

---

## Execution Timeline

**Week 1 (May 10 - May 17)**:
- Days 1-3: Phase 1 foundation (IDs 10, 11, 17, 19)
  - ID 10: benchmark dataset (50 queries, eval framework)
  - ID 11: guardrails logic + audit logging
  - ID 17: token audit (colors, typography, spacing)
  - ID 19: Web Vitals instrumentation + budget definition
- Days 4-5: Phase 1 optimization + Phase 2 start
- Gate: Phase 1 60%+ done

**Week 2 (May 17 - May 24)**:
- Days 6-9: Phase 2 hardening (IDs 21, 26, 29, 30)
  - ID 21: missing key detection, translation QA, new locales
  - ID 26: erase verification suite, compliance tools
  - ID 29: SLO definitions, dashboard, alerts
  - ID 30: evidence schema, governance process
- Days 10-14: Phase 1 polish + Phase 2 completion
- Gate: All 8 items complete + tested by day 14

---

## Sprint Metrics

**Effort Distribution:**
- Phase 1 (AI + Design): 37-52 points
- Phase 2 (Compliance + Ops): 29-39 points
- **Total: 66-91 points** (can be phased or scaled)

**KPI Targets:**
- +15% retrieval quality (Vectorize precision@k)
- >99% SLO compliance per service
- 0 missing i18n keys + eliminate truncation
- -20% visual inconsistency defects
- 100% backlog evidence traceability

**Definition of Done:**
- Code + tests complete
- Security review (if applicable)
- Performance tested
- Docs updated
- Evidence links added
- No regressions

**Release Guardrails (v2.2.0):**
- All tests green (npm test, coverage ≥80%)
- TypeScript strict mode
- No linting errors
- No secret leaks
- Performance budgets met
- a11y: WCAG AA on critical flows
- Security review sign-off
- Canary rollout (5% → 100% over 3 days)

---

## Related Documentation

- `SPRINT_PLAN.md` — Active sprint planning hub
- `BACKLOG.md` — Full 36-item product roadmap
- `SPRINT_18_IMPLEMENTATION.md` — Sprint A (foundation + trust)
- `SPRINT_19_IMPLEMENTATION.md` — Sprint B (robustness + scale)
- `CLAUDE.md` — Hard rules, stack overview
