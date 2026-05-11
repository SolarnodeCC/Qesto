# Qesto v2.2 Epic Roadmap (Agent-Validated)
**Target:** Q3 2026 (June–August) | **Status:** Approved for implementation  
**Last Updated:** 2026-05-10 (Post-agent validation)  
**Agent Review:** Product Owner, Architect, Security, Backend, DevOps  

---

## Executive Summary

Qesto v2.2 will ship **security hardening + customer intimacy features** in parallel across **Sprints 20–27** (8 weeks) to drive adoption. The roadmap prioritizes:

1. **Security First** (Sprint 20 pre-work + Sprint 21–23): Timeout/Retry → Circuit Breaker → Error Handling
2. **Infrastructure Foundation** (Sprint 20): Staging environment, circuit breaker module, integration foundation, PII sanitization
3. **Customer Intimacy** (Sprints 21–26): AI provenance, integrations/export, LIVE energizers, enterprise admin UX
4. **Go-Live Readiness** (Sprints 25–27): Stress testing, compliance validation, canary rollout

**North Star Metric:** +40% session starts (adoption volume) + 20% energizer engagement rate (retention)

---

## Critical Decisions from Agent Review

### **🔴 Blockers Resolved**

| Finding | Decision | Impact |
|---|---|---|
| **Staging doesn't exist** | Provision before Sprint 21 (2–3 days pre-work) | Unblocks all Sprints 25–27 validation |
| **Security sequencing reversed** | Timeout/Retry (Sprint 21) → Circuit Breaker (Sprint 23) | Prevents false confidence in resilience |
| **Backend points underestimated** | Realistic +27–35 pts; add Sprint 20 foundation (16 pts) | Avoids 1.5+ sprint slip |
| **PII sanitization missing** | Build `safeLogContext()` helper before Sprint 21 | GDPR blocker—must ship before production |
| **Integration foundation missing** | 8 pts upfront (OAuth, token-store, circuit-breaker wrapper) | Prevents 3× code duplication |
| **Feature flags not wired** | Add to `types.ts` + `wrangler.toml` before Sprint 21 | Enables proper feature isolation |

### **🟡 Trade-offs Made**

| Item | Decision | Reasoning |
|---|---|---|
| **Signed PDF export** | Defer to v2.3, ship unsigned | PAdES signing is 2-week R&D; unsigned covers 80% use case |
| **Airtable integration** | Defer to v2.3 (Slack + Notion in v2.2) | Slack+Notion cover adoption value; Airtable is secondary ask |
| **Quick Finger public launch** | Dark-launch soak (Sprint 25), public in Sprint 26 | Requires 3-week production proof before public |
| **Admin role UI** | Backend now (Sprint 21), UI later (Sprint 24–25) | Collect API usage patterns first, informs UX design |
| **Compliance packet** | Defer SOC 2 to v2.3, commission 1-week pen test | SOC 2 takes 18+ months; pen test summary unlocks enterprise claims |

---

## 5 Strategic Epics

### **EPIC-AUDIT-REMEDIATION** (Security & Resilience)
**Sprints:** 20 (pre-work), 21, 23, 25  
**Points:** 36  
**Owner:** Backend + DevOps  

**Stories:**
- **AUDIT-TIMEOUT** (Sprint 21, 8 pts): Hard timeouts on all external fetch (Stripe, Resend, OAuth, Workers AI) via `AbortController`. 5s default, 10s for AI. Tests + observability events.
- **AUDIT-RETRY** (Sprint 21, 8 pts): Bounded exponential backoff (max 2 attempts, jitter) for idempotent operations. Stripe requires idempotency keys. Tests.
- **AUDIT-CIRCUIT-BREAKER-LIB** (Sprint 20 pre-work, 8 pts): Generic KV-backed circuit breaker module (Stripe, Resend, AI). DO-backed state, 60s open TTL, half-open probing. Reusable for integrations.
- **AUDIT-ERROR-HANDLING** (Sprint 23, 8 pts): Catch blocks on plan middleware (D1), OAuth (JWKS), Stripe portal. No raw database errors in responses. Error boundary UX.
- **AUDIT-VALIDATION** (Sprint 25, 4 pts): Staging smoke test for Stripe/AI/OAuth failure + recovery. Circuit breaker triggers correctly.

**Outcome:** Zero critical resilience findings. <0.5% session failure rate under external outages.

---

### **EPIC-AI-PROVENANCE** (Trust & Transparency)
**Sprints:** 21, 22, 24  
**Points:** 29  
**Owner:** AI Team + Frontend  

**Stories:**
- **AI-PROV-METADATA** (Sprint 21, 5 pts): Recap metadata schema (question IDs, vote counts, consent_posture, ai_model_version, generated_at). DB migration. Tests.
- **AI-PROV-EVIDENCE-PANEL** (Sprint 22, 8 pts): Recap editor shows evidence (question text → vote counts → contributor quotes). Edit history (view-only). Consent posture badge. Frontend tests.
- **AI-PROV-EXPORT** (Sprint 22, 5 pts): Export recap with provenance label. Includes "Sourced from X responses, generated with Y consent posture, at Z time."
- **AI-PROV-SHARING** (Sprint 24, 8 pts): Share recap link with immutable version + view count analytics. Edit history locked after share. Trackable.

**Outcome:** Teams can confidently share AI recaps with full evidence trail. AI becomes shareable, not scary.

---

### **EPIC-INTEGRATIONS-EXPORT** (Workflow Stickiness)
**Sprints:** 20 (foundation), 21–25  
**Points:** 51 (including foundation)  
**Owner:** Backend + Integration Team  

**Phase 1: Export Formats (Sprints 21–23)**
- **EXPORT-JSON** (Sprint 21, 5 pts): Session questions, responses, metadata. Schema + tests.
- **EXPORT-PDF-UNSIGNED** (Sprint 23, 8 pts): Session summary, questions, results. Qesto branding. Signature library decision (defer signed version).
- **EXPORT-DOCX** (Sprint 23, 5 pts): Questions + results + consent posture. Qesto branding. Edge-compatibility validated.

**Phase 2: Integration Foundation (Sprint 20 pre-work, 8 pts)**
- `lib/integrations/oauth.ts` — Generic OAuth 2.0 + PKCE
- `lib/integrations/token-store.ts` — KV-backed encrypted token storage
- `lib/integrations/http-client.ts` — Fetch wrapper (circuit breaker + timeout + retry)
- `lib/integrations/webhook-verify.ts` — HMAC verification

**Phase 3: Webhook Integrations (Sprints 22, 24)**
- **INTEG-SLACK** (Sprint 22, 5 pts): OAuth + slash command + result snippet posting. Team comms = adoption multiplier.
- **INTEG-NOTION** (Sprint 24, 3 pts): Sync results to Notion database. Consent posture as field. On-demand + webhook trigger.
- **INTEG-AIRTABLE** (Deferred to v2.3)

**Outcome:** 15%+ of closed sessions include ≥1 export or integration sync. Results live where teams already work.

---

### **EPIC-LIVE-ENERGIZERS-SCALE** (Gamification & Engagement)
**Sprints:** 20 (foundation), 21–26  
**Points:** 44  
**Owner:** Backend (SessionRoom) + Frontend (UI)  

**Phase 1: Protocol & Foundation (Sprint 21, 3 pts)**
- WebSocket protocol v2 spec (feature-flag gate, version negotiation). Backward compatible.

**Phase 2: Quick Finger (Sprints 22–23)**
- **ENERGIZER-QUICK-LOGIC** (Sprint 23, 13 pts): Game state machine (setup → countdown → active → scored). Host timer, participants tap answer, server validates, score broadcast. Reconnect safety. DO state management + Alarms (not setTimeout).
- **ENERGIZER-QUICK-UI** (Sprint 22, 5 pts): Participant/host UX. Mobile-optimized. Leaderboard display. Animation polish. A11y tests.

**Phase 3: Team Quiz (Sprints 24–25)**
- **ENERGIZER-TEAM-LOGIC** (Sprint 25, 8 pts): Multi-round state machine, locked submission window, cumulative leaderboard, team persistence, reconnect reconciliation.
- **ENERGIZER-TEAM-UI** (Sprint 24, 5 pts): Round timer, submission lock, leaderboard reveal. Accessibility.

**Phase 4: Progression (Sprint 24)**
- **ENERGIZER-BADGES** (Sprint 24, 5 pts): Streak, Fastest Finger, Team Player badges. Award logic on thresholds. Notify on earn.

**Outcome:** 20%+ of LIVE sessions include ≥1 energizer. +15% engagement (time-on-session). Dark-launch in Sprint 25, public in Sprint 26.

---

### **EPIC-ENTERPRISE-ADMIN-UX** (Delegation at Scale)
**Sprints:** 21–24  
**Points:** 39  
**Owner:** Frontend + Backend  

**Phase 1: Backend + API (Sprint 21, 8 pts)**
- Custom role permission matrix (D1 schema). Route enforcement (403 on deny). Audit log for mutations.
- Role-assignment API with curl examples for ops teams.

**Phase 2: UX Foundation (Sprint 22, 8 pts)**
- Role definition UI wireframes + prototype. Permission matrix data model.

**Phase 3: Permission Enforcement (Sprint 23, 8 pts)**
- Backend: permission checks on session/team routes. Audit evidence (who denied what, why).

**Phase 4: Full UX (Sprint 24, 15 pts)**
- Role creation flow. Checkbox matrix picker. Templates (Owner, Facilitator, Presenter, Viewer, Analyst). Bulk assign. Permission audit log viewer.

**Outcome:** Large teams (10+ members) self-serve custom roles without Qesto support.

---

## Sprint Sequence & Dependencies

```
SPRINT 20 (PRE-WORK — May 13–27)
├─ INFRA: Staging env provisioning (KV, D1, Stripe test keys, commit SHA)
├─ CIRCUIT-BREAKER-LIB (8 pts)
├─ INTEGRATION-FOUNDATION (8 pts)
├─ DB-MIGRATION-BATCH (ai_recap_metadata, custom_roles, audit_event)
└─ PII-SANITIZATION-HELPER (safeLogContext, CI grep gate)

SPRINT 21 (May 27–Jun 10) — "Foundations & Export Phase 1"
├─ AUDIT-TIMEOUT (8 pts) ✓ blocking all external calls
├─ AUDIT-RETRY (8 pts)
├─ EXPORT-JSON (5 pts)
├─ AI-PROV-METADATA (5 pts)
├─ ADMIN-RBAC-BACKEND (8 pts)
└─ ENERGIZER-PROTOCOL-V2 (3 pts)

SPRINT 22 (Jun 10–24) — "AI Evidence & Energizer UX Phase 1"
├─ AI-PROV-EVIDENCE-PANEL (8 pts)
├─ AI-PROV-EXPORT (5 pts)
├─ ENERGIZER-QUICK-UI (5 pts)
├─ INTEG-SLACK-OAuth (5 pts)
└─ ADMIN-UX-PROTOTYPE (8 pts)

SPRINT 23 (Jun 24–Jul 8) — "Resilience Hardening & Export Phase 2"
├─ AUDIT-CIRCUIT-BREAKER (8 pts) ✓ now has failure signals from Sprint 21
├─ AUDIT-ERROR-HANDLING (8 pts)
├─ EXPORT-PDF-UNSIGNED (8 pts)
├─ EXPORT-DOCX (5 pts)
├─ ENERGIZER-QUICK-LOGIC (13 pts)
└─ ADMIN-RBAC-ENFORCE (8 pts)

SPRINT 24 (Jul 8–22) — "Integration Phase 1 & Gamification UX"
├─ ENERGIZER-TEAM-UI (5 pts)
├─ ENERGIZER-BADGES (5 pts)
├─ INTEG-NOTION (3 pts)
├─ AI-PROV-SHARING (8 pts)
├─ ADMIN-UX-FULL (15 pts)
└─ OBSERVABILITY (3 pts)

SPRINT 25 (Jul 22–Aug 5) — "Hardening & Stress Test"
├─ ENERGIZER-TEAM-LOGIC (8 pts)
├─ AUDIT-VALIDATION (4 pts)
├─ LOAD-TEST & PERF-OPTIMIZE (5 pts)
├─ MONITORING-DASHBOARDS (8 pts)
└─ COMPLIANCE-CLOSEOUT (3 pts)

SPRINT 26 (Aug 5–19) — "Release Candidate & Go-Live"
├─ REGRESSION-SUITE (10 pts)
├─ LAUNCH-COMMS (3 pts)
├─ DOCS-USER-GUIDES (5 pts)
├─ DOCS-API (3 pts)
└─ FEATURE-FLAG-ROLLOUT (3 pts)

SPRINT 27 (Aug 19–Sep 2) — "Post-Launch Stability"
├─ Monitor canary metrics
├─ Fix P1 bugs
├─ Support readiness
└─ Ramp to 100%
```

---

## Realistic Point Estimates (Agent-Validated)

| Component | Original | Realistic | Reason |
|---|---|---|---|
| Circuit Breaker Module | 8 | 8 | Correct (reusable, foundational) |
| Integration Foundation | 0 | 8 | Was missing; prevents 3× duplication |
| Quick Finger Logic | 8 | 13 | DO state machine + alarm + reconnect edge cases |
| Team Quiz Logic | 5 | 8 | Submission window + team persistence + reconciliation |
| PDF Export | 5 | 13 | PAdES signing, RSA crypto, library decision required |
| DOCX Export | 5 | 8 | Edge-compatibility audit for Workers runtime |
| Timeout/Retry | 8 | 8 | Correct |
| Error Handling | 8 | 8 | Correct |
| **Total Adjustment** | **48** | **75** | **+27 (mitigated via scope cuts + foundation)** |

**Mitigation:** Sprint 20 pre-work (16 pts foundation) + scope cuts (signed PDF, Airtable → v2.3) = fits 6 sprints at 45–55 pts/sprint.

---

## Required Infrastructure Pre-Work

Before Sprint 21 can begin, complete Sprint 20 infrastructure:

### **Staging Environment Checklist**
- [ ] Create `qesto-staging` D1 database
- [ ] Provision KV namespaces (`SESSIONS_KV`, `USERS_KV`, `TEAMS_KV`, `DECISIONS_KV`, `CIRCUIT_BREAKER_KV` all with `--preview` suffix)
- [ ] Add `[env.staging]` block to `wrangler.toml` with separate bindings
- [ ] Inject Stripe test-mode keys as staging secrets (`sk_test_*` keys)
- [ ] Inject test Resend API key as staging secret
- [ ] Set `LIVE_ENERGIZERS_ENABLED=true` in `[env.staging.vars]`
- [ ] Fix CI to inject `COMMIT_SHA` during Pages deploy (currently `COMMIT_SHA=dev` on production)
- [ ] Add `deploy-staging` CI job (runs on `staging` branch, targets staging Cloudflare Pages project)

### **Feature Flag Wiring**
- [ ] Add `CIRCUIT_BREAKER_ENABLED?: string` to `types.ts` Env interface
- [ ] Add `INTEGRATION_ENABLED?: string` to `types.ts` Env interface
- [ ] Add `LIVE_ENERGIZERS_ENABLED = "true"` to `[env.staging.vars]` in `wrangler.toml`
- [ ] Implement KV kill-switch pattern: check `SESSIONS_KV.get('feature:live_energizers_enabled')` before falling back to env var
- [ ] Document operator command for kill-switch: `wrangler kv key put --namespace-id <SESSIONS_KV_ID> "feature:live_energizers_enabled" "false"`

### **PII Sanitization Setup**
- [ ] Create `functions/api/lib/log.ts` with `safeLogContext()` helper (redacts emails, JWTs, Stripe IDs, bearer tokens)
- [ ] Add CI grep gate blocking raw `console.error(err)` outside helper
- [ ] Document PII denylist: magic-link emails, JWT bodies, Stripe customer IDs, SAML assertions, Workers AI prompts, Vectorize embeddings

### **Circuit Breaker KV Namespace**
- [ ] Provision `CIRCUIT_BREAKER_KV` binding in `wrangler.toml` (separate for staging/prod)
- [ ] Add to `types.ts` Env interface: `CIRCUIT_BREAKER_KV?: KVNamespace`
- [ ] CI validation: assert `CIRCUIT_BREAKER_KV` present at deploy time

**Estimated Effort:** 2–3 days DevOps + 1 day Backend

---

## Go-Live Gates (Sprints 25–27)

### **Sprint 25 Gates**
- [ ] Staging WebSocket round-trip (Quick Finger full game, score broadcast <100ms p95)
- [ ] Stripe failure + circuit breaker recovery (breaker opens, session continues, error logged)
- [ ] AI timeout (request aborts at 10s, fallback response sent)
- [ ] Export formats (JSON valid, PDF opens in Office/Google Docs, DOCX tested)
- [ ] Custom role enforcement (403 on deny, audit log created)
- [ ] Load test (100 concurrent participants, p95 latency <100ms)
- [ ] Compliance validation (OWASP Top 10 checklist, no secrets in logs)

### **Sprint 26 Gates (Canary, 5% Cohort)**
**P0 Exit Criteria (rollback if any triggered):**
- WebSocket error rate >2% (baseline to be established)
- `ws.capacity_exceeded` events >50% above baseline
- `ai.inference` failure rate >20%
- Any circuit breaker open on Stripe (zero tolerance for billing)
- Reconnect failure rate doubles

**Rollback Automation:**
- KV kill-switch: `wrangler kv key put "feature:live_energizers_enabled" "false"` (immediate, no redeploy)
- Manual fallback: `LIVE_ENERGIZERS_ENABLED=false` redeploy (2–3 min)

### **Sprint 27 Gates (Ramp to 100%)**
- [ ] 48h soak at 5% cohort, P0 metrics stay green
- [ ] Ramp 5% → 25% → 50% → 100% over 2 weeks
- [ ] Monitor circuit breaker trigger %, AI timeout %, integration success %
- [ ] Support readiness (runbooks tested, FAQ ready)
- [ ] No critical bugs in top 10 customer accounts

---

## Success Metrics

| Metric | Target | Owner | Measurement |
|---|---|---|---|
| **Session Starts (North Star)** | +40% Q3 vs Q2 | Product | Analytics dashboard |
| **Energizer Engagement** | 20%+ of LIVE sessions use ≥1 energizer | Backend | D1 `ws.energizer_*` event count |
| **Integration Adoption** | 15%+ of closed sessions use ≥1 export/sync | Backend | Integration webhook success % |
| **AI Recap Trust** | 40%+ of sessions generate recap; 40% of those shared | Frontend | Share tracking analytics |
| **Enterprise Adoption** | 2+ large teams (10+ members) with custom roles | Product | Segment cohort |
| **Circuit Breaker Resilience** | <1% session failure due to external outages | DevOps | Error rate dashboard |
| **Error Reduction** | 0 raw DB errors in production; all logged with trace ID | Security | Log audit |
| **Energizer Reliability** | <0.5% energizer game error rate | Backend | D1 audit event count |

---

## Risk Mitigations

| Risk | Mitigation | Owner |
|---|---|---|
| **Staging provisioning delays** | Start Day 1 of pre-work; use bootstrap docs as checklist | DevOps |
| **Circuit breaker adds complexity** | ADR review, test under Stripe failures in staging | Architect |
| **AI recap edit history slows pageload** | Lazy-load, pagination; benchmark v2.1 vs v2.2 | Frontend |
| **LIVE energizers overload SessionRoom** | Load test 500+ concurrent in staging; profile CPU/memory | Backend |
| **Admin UX not adopted** | Validate with 2–3 large customer teams in Sprint 24 user testing | Product |
| **PII leaks into logs** | Strict `safeLogContext()` helper + CI grep gate | Security |
| **Timeline slip (6 weeks → 8+)** | Parallel workstreams, Sprint 20 foundation, scope cuts | PM |

---

## Scope Cuts (If Timeline Pressure)

If 6-week timeline is at risk, cut in this priority order:

1. **Signed PDF export** (defer to v2.3) — saves 8 pts, unsigned covers 80% use case
2. **Airtable integration** (defer to v2.3) — saves 5 pts, Slack+Notion cover adoption value
3. **Quick Finger public launch** (dark-launch soak only) — saves 3 pts marketing/support effort
4. **Admin role UI** (ship API-only, defer UX to v2.3) — saves 13 pts, collect usage patterns first
5. **Post-Sprint 26 ramp** (defer full 100% ramp to Sprint 27) — gives stability buffer

---

## Next Steps

1. **Day 1:** Approve this roadmap + infrastructure checklist with team
2. **Days 2–3:** Execute Sprint 20 pre-work (staging, flags, PII helper, circuit breaker lib)
3. **Day 4:** Kick off Sprint 21 with foundation in place
4. **Weekly:** Sync on agent findings, resolve blockers, measure against KPIs
5. **Sprint 25:** Begin staging validation gates
6. **Sprint 26:** Canary rollout (5% cohort)
7. **Sprint 27:** Ramp to 100% + post-launch stability

---

## Reference Documents

- [ROADMAP_FULL.md](../roadmap/ROADMAP_FULL.md) — Current v2.x release status
- [BACKLOG.md](../backlog/BACKLOG_MASTER.md) — All user stories, acceptance criteria, sizing
- [SPRINT_PLAN.md](../planning/SPRINT_PLAN_MASTER.md) — Calendar sprints (Sprints 20–27 detailed)
- [ADR-CIRCUIT-BREAKER.md](../../adr/ADR-0007-circuit-breaker.md) — Circuit breaker pattern decision
- [ADR-INTEGRATION-FOUNDATION.md](../../adr/ADR-0008-integration-foundation.md) — Integration provider pattern
- [ADR-PII-SANITIZATION.md](../../adr/ADR-0009-pii-sanitization.md) — Logging security decision
- [INFRA-SPRINT-20-CHECKLIST.md](../../operations/deployment/INFRA_SPRINT_CHECKLIST.md) — Pre-work tasks
- [V2_2_ROLLOUT_PLAN.md](../releases/V2_2_ROLLOUT_PLAN.md) — Canary + ramp strategy
