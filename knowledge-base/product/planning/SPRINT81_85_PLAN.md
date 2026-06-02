---
id: SPRINT81_85_PLAN
type: planning
domain: product
category: planning
status: active
version: 2.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - planning
  - sprints
  - S81-S85
  - v5.1
  - insights-plus
  - copilot-residual
  - native-mobile
  - marketplace
relates_to:
  - SPRINT81_90_PLAN
  - ADR-0045-cross-session-intelligence
  - ADR-0046-live-facilitator-copilot
  - BACKLOG_MASTER
  - COMPETITIVE_EPICS
---

# Sprint 81–85 Plan — Frontier Reconciliation & Early v5.1 (Jun 2 – Aug 10, 2026)

_Created: 2026-06-01 (UTC); scope reconciliation by Product Owner._

_**Frontier status (2026-06-01)**: v5.0 GA shipped (Sprint 80, ADR-0044 TOWNHALL epic delivered). INSIGHTS+ (Cross-Session Intelligence, ~95 pts, 11 stories, ADR-0045) confirmed as TRUE next epic. COPILOT epic 70% shipped; residual stories (COPILOT-04, COPILOT-07, COPILOT-08, COPILOT-10) require finish-work. TOWNHALL-12 (profanity filtering) and MARKET-RESEARCH-VEVOX-01 are genuine gaps._

---

## Reconciliation: INSIGHTS+ vs. COPILOT finish

The existing [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md) commits S81–S90 with ten epics and fixed capacity (120–150 pts/sprint). This **refined plan** (S81–S85) reconciles two critical frontiers:

1. **INSIGHTS+ is the true next product epic** (confirmed in BACKLOG_MASTER §Frontier). It is a 95-pt, 11-story epic groomed and ready for commitment. ADR-0045 is proposed.
2. **COPILOT residuals are must-finish.** Four stories (COPILOT-04, 07, 08, 10; ~29 pts total) remain unbuilt from the shipped epic. They are priority P0/P1 and block COPILOT GA claims.
3. **TOWNHALL-12 + MARKET-RESEARCH-VEVOX-01** are explicit gaps from the shipped TOWNHALL epic (ADR-0044).

**Strategy**: Slice INSIGHTS+ and COPILOT residuals into S81–S85 without overloading S81 (native mobile beta). The existing S81-90 plan remains the macro roadmap; this sprint plan sequences the immediate frontier work.

---

## Capacity & sizing

| Rule | Value | Notes |
|------|-------|-------|
| Committed per sprint | 120–150 pts | Product engineering + QA + security (see role-plan slices) |
| Story size cap | ≤13 pts | Enforced in backlog |
| INSIGHTS+ total | ~95 pts (11 stories) | ~2 sprints at baseline; stretched across S81–S82–S83 to avoid overload |
| COPILOT residuals | ~29 pts (4 stories) | COPILOT-04/07/08/10; finish in S82–S83 |
| TOWNHALL-12 | 8 pts | S81 or S82 (stretch) |
| Residual gate items | 2 | ADR-0045 (INSIGHTS-00), MARKET-RESEARCH-VEVOX-01 (marketing, not eng) |

---

## Calendar windows (2-week sprints, starting ~2026-06-02)

| Sprint | Dates | Goal | Release posture |
|--------|-------|------|-----------------|
| **S81** | 2026-06-02 → 2026-06-15 | Native mobile beta (iOS/Android TestFlight); Pentest #4 open; INSIGHTS foundation | No release; beta channel |
| **S82** | 2026-06-16 → 2026-06-29 | Mobile GA + marketplace billing foundation; INSIGHTS-01/02 shipped; COPILOT residuals start | No release; internal validation |
| **S83** | 2026-06-30 → 2026-07-13 | v5.1 RC milestone; paid listings live; INSIGHTS pipeline + API foundation; COPILOT finish | **v5.1 RC + ga gate** |
| **S84** | 2026-07-14 → 2026-07-27 | TOWNHALL scale + agent marketplace; INSIGHTS rollup + dashboard; v5.1 GA release | **v5.1 GA** |
| **S85** | 2026-07-28 → 2026-08-10 | Hybrid events + recurring workspaces; INSIGHTS export + observability; RETRO/IDEATE foundation | v5.1.1 patch (if needed) or S86 prep |

---

## ADR gates (S81–S85)

| ADR | Title | Target | Gate | Status |
|-----|-------|--------|------|--------|
| ADR-0044 | Townhall moderated QA (shipped) | ✅ Shipped S80 | — | ✅ Accepted |
| **ADR-0045** | **Cross-session intelligence architecture** | **S81 kickoff** | **Blocks INSIGHTS-02+ implementation** | Proposed (accept before S82) |
| ADR-0046 | Live facilitator copilot (shipped) | ✅ Shipped S77–S80 | COPILOT-02+ already shipped; COPILOT-04/07/08/10 don't require new ADR | ✅ Accepted |

**ADR-0045 must be accepted by end of S81** to unblock INSIGHTS-02 (D1 migration + pipeline) in S82.

---

## Sprint 81 — Native mobile beta + INSIGHTS foundation (≈142 pts)

**Goal**: Deliver Capacitor iOS/Android beta to TestFlight/Play internal; open Pentest #4; lay ADR-0045 groundwork; start INSIGHTS data model.

**Release posture**: No customer release; internal beta channel only.

### Committed items

| ID | Title | Pts | Pri | Dependency |
|---|---|---:|---|---|
| **Native mobile** |
| `NATIVE-SHELL-01` | Capacitor shell: iOS/Android build + app signing + native push (ADR-0044) | 13 | P0 | ADR-0044 accepted |
| `FE-NATIVE-OFFLINE-01` | Offline voter shell + local response queue | 13 | P0 | — |
| `NATIVE-PUSH-01` | Native push action handlers (Firebase FCM + APNs) | 13 | P0 | — |
| **Security** |
| `SEC-PEN4-01` | Pentest #4 (mobile + marketplace surface) engagement + scope | 13 | P0 | — |
| `SEC-PEN4-PREP-02` | Mobile auth + local storage hardening + threat model | 8 | P0 | — |
| **INSIGHTS+ foundation** |
| `INSIGHTS-00` | ADR-0045 acceptance review cycle | 3 | P0 | Architect review |
| `INSIGHTS-01-SPIKE` | D1 schema spike: `team_insight_rollup` table design + migration stub | 8 | P0 | ADR-0045 accepted (gated) |
| **Quality** |
| `QA-NATIVE-DEVICE-MATRIX-01` | Multi-device matrix (iPhone SE, Pixel 6, Samsung Tab) + smoke suite | 13 | P0 | — |
| **i18n** |
| `I18N-SPRINT81-01` | App store listings (5 locales): EN/NL/DE/FR/ES descriptions + keywords + screenshots | 10 | P1 | — |
| **Marketing** |
| `MKTG-81-01` | App launch teaser campaign (social + email) | 8 | P1 | — |
| `MKTG-81-02` | App Store Optimization (keywords, category, rating management) | 6 | P1 | — |

**Stretch items** (start only if core items complete):
| `AI-441`–`AI-443` | Agent runtime schema foundation (COPILOT bridge) | 13 | P1 | AI-strategy gate |

### Exit criteria

- [ ] iOS TestFlight + Android Play internal builds signed and in stores
- [ ] Native push fires and is actionable (vote from push, navigate to session)
- [ ] Device matrix passes (3+ device types, orientation changes, reconnects)
- [ ] Pentest #4 scope document signed
- [ ] ADR-0045 accepted (architect + PO sign-off)
- [ ] D1 migration stub ready for S82 implementation
- [ ] App store listings live in all 5 locales
- [ ] `npm test` green; `tsc --noEmit` passes

### Dependencies

- ADR-0044 (shipped) — native shell build signature
- Cloudflare App signing certificate provisioned
- Firebase project + APNs cert uploaded

### KPI targets

- App downloads (day 1): ≥500 internal installs
- Native push delivery rate: ≥95%
- Device matrix coverage: ≥100% of top 5 devices

---

## Sprint 82 — Mobile GA + marketplace foundation + INSIGHTS Tier-1 (≈147 pts)

**Goal**: iOS/Android GA release; Stripe Connect onboarding; INSIGHTS-01/02 (D1 + close-path pipeline) shipped; COPILOT residuals start.

**Release posture**: Mobile GA (store release); no web release.

### Committed items

| ID | Title | Pts | Pri | Dependency |
|---|---|---:|---|---|
| **Mobile GA** |
| `NATIVE-GA-01` | iOS/Android GA release: store review (2 weeks assumed), certification, version bump | 13 | P0 | S81 TestFlight + Play internal green |
| `FE-NATIVE-STORE-01` | Store listing polish + rating/review prompts + OTA update prep | 8 | P0 | — |
| **Marketplace foundation** |
| `MARKETPLACE-CONNECT-01` | Stripe Connect account linking + KYC form + verification polling | 13 | P0 | Stripe Connect API sandbox ready |
| `MARKETPLACE-PAYOUT-01` | Payout routing + bank account verification + test transactions | 13 | P0 | Stripe legal review (compliance gate) |
| `MARKETPLACE-BILLING-SPIKE-02` | Billing schema extension for partner tiers (payment account per partner) | 8 | P0 | — |
| **INSIGHTS+ Tier-1** |
| `INSIGHTS-01` | D1 migration: execute `0047`; add `team_insight_rollup` table + repository; ZK-excluded backfill | 13 | P0 | ADR-0045 accepted + migration tested |
| `INSIGHTS-02` | Tier-1 pipeline: extend `precomputeInsights()` on close; upsert embedding w/ `team_id` metadata; ZK guard + emit event | 13 | P0 | INSIGHTS-01 complete |
| **COPILOT residuals** |
| `COPILOT-04` | Disengagement detection: sentiment concern (k≥5) + response-rate drop off DO snapshot | 8 | P1 | ADR-0046 (shipped) |
| **Security** |
| `SEC-PEN4-02` | Pentest #4 remediation review (mobile security findings) | 8 | P0 | — |
| `SEC-MKTPL-KYC-01` | KYC data flow audit + PII handling (Stripe Connect data, ADR-0009) | 8 | P0 | — |
| **Marketing** |
| `MKTG-82-01` | Partner program launch page (vs Slido App Store) | 8 | P1 | — |
| `MKTG-82-02` | Mobile GA GTM: app store ads + launch email to waitlist | 6 | P1 | — |

**Stretch items**:
| `TOWNHALL-12` | Workers-AI profanity filtering (async, per-session toggle) | 8 | P1 | Workers AI availability |
| `AI-444`–`AI-447` | Agent runtime schema (continued) | 13 | P1 | — |

### Exit criteria

- [ ] iOS + Android apps live in public stores (no beta flag)
- [ ] Stripe Connect accounts linkable; test payout succeeds
- [ ] D1 migration applied to production; backfill verified
- [ ] Insights aggregated for ≥3 test teams; ZK sessions excluded
- [ ] COPILOT-04 (disengagement) shipped and tested
- [ ] Pentest #4 findings triaged (critical/high remediations planned)
- [ ] All i18n keys green; compliance claims checked
- [ ] `npm test` green; `tsc --noEmit` passes

### Dependencies

- Stripe legal review of KYC flow
- App store review (2 weeks typical)
- D1 migration reviewed by architect

### KPI targets

- Mobile app installs: ≥2k by end of sprint
- Marketplace signups: ≥5 partner accounts created

---

## Sprint 83 — v5.1 RC + INSIGHTS pipeline + COPILOT finish (≈146 pts)

**Goal**: v5.1 RC gate; paid listings foundation; INSIGHTS Tier-2 (recurring clustering); COPILOT-07/08/10 complete; Pentest #4 critical/high = 0.

**Release posture**: v5.1 Release Candidate (no GA yet; internal + staging validation).

### Committed items

| ID | Title | Pts | Pri | Dependency |
|---|---|---:|---|---|
| **v5.1 RC** |
| `RC-V51-01` | v5.1 RC release: version bump, changelog, rollout plan, infra validation | 13 | P0 | All committed items green |
| **INSIGHTS+ Tier-2** |
| `INSIGHTS-03` | Recurring-topic clustering: Vectorize query over team embeddings w/ `team_id` filter + k-anonymity floor | 13 | P0 | INSIGHTS-02 shipped + Vectorize tested |
| `INSIGHTS-04` | Trend API: `GET /api/teams/:id/insights/trends` (30/90/180d windows); KV-cached; plan-gated | 8 | P1 | INSIGHTS-03 + entitlement gate |
| **COPILOT residuals** |
| `COPILOT-07` | Observability: AE events (`copilot.suggestion_emitted`, `suggestion_accepted`, `poll_drafted`); adoption KPI | 5 | P1 | COPILOT-06 (shipped) |
| `COPILOT-08` | Privacy/ZK guardrails + regression bundle: no PII in prompts; ZK disengagement fallback; audit evidence | 8 | P0 | COPILOT-04 shipped |
| `COPILOT-10` | Integration tests: vote → sentiment → suggestion → accept → `add_question` injected full loop | 8 | P1 | All COPILOT stories shipped |
| **Marketplace** |
| `MARKETPLACE-PAID-LISTING-01` | Paid listings live: template/plugin upload + price tier selection + visibility toggle | 13 | P0 | MARKETPLACE-CONNECT-01 shipped |
| `FE-MKTPL-LISTING-01` | Paid listing UX: creator dashboard + listing editor + preview | 13 | P0 | — |
| **Security / QA** |
| `SEC-PEN4-REM-01` | Pentest #4 critical/high remediation verification (mobile + marketplace final) | 8 | P0 | — |
| `SEC-AGENT-SANDBOX-01` | Agent sandbox security model (workers WfP isolation, capabilities limits) | 8 | P0 | ADR-0046 (shipped) |
| `CONTRACT-MARKETPLACE-PAYOUT-01` | Contract test: payout eligibility, tax calculation, edge cases | 8 | P0 | — |
| **Marketing** |
| `MKTG-83-01` | Marketplace launch: feature page + partner case study + pricing comparison | 8 | P1 | — |
| `MKTG-83-02` | v5.1 launch GTM prep: release notes + community preview | 6 | P1 | — |

**Stretch items**:
| `AI-448`–`AI-451` | Agent runtime schema + safety eval foundation | 13 | P1 | — |

### Exit criteria

- [ ] v5.1 RC version in staging; rollout plan documented
- [ ] Pentest #4 critical/high = 0; all findings documented
- [ ] Paid listings CRUD works; creator can upload template + set price
- [ ] INSIGHTS Tier-2 trending API returns 30d trends w/ ≥3 sessions; KV cache working
- [ ] COPILOT integration tests pass (full vote → suggestion → accept flow)
- [ ] Marketplace KYC compliance review passed (legal gate)
- [ ] All COPILOT stories marked ✅ (residuals complete)
- [ ] `npm test` green; `tsc --noEmit` passes

### Dependencies

- Pentest #4 completion (external security firm)
- Legal review of KYC + payout compliance
- ADR-0046 (shipped) — copilot architecture
- Architect sign-off on v5.1 RC exit criteria

### KPI targets

- Marketplace partner onboarding: ≥10 partners with listings
- Paid listing click-through rate: ≥5% on creator dashboard
- v5.1 RC staging: zero P0 bugs in 48h validation window

---

## Sprint 84 — v5.1 GA + TOWNHALL scale + INSIGHTS dashboard (≈144 pts)

**Goal**: v5.1 GA ship; TOWNHALL 50k moderation load proof; INSIGHTS frontend + export foundation; agent marketplace setup.

**Release posture**: **v5.1 GA release** to production.

### Committed items

| ID | Title | Pts | Pri | Dependency |
|---|---|---:|---|---|
| **v5.1 GA** |
| `V51-GA-RELEASE-01` | v5.1 GA: production deployment, rollout monitoring, docs publish | 13 | P0 | RC-V51-01 + staging green |
| **TOWNHALL scale** |
| `TOWNHALL-SCALE-PROOF-50K-01` | Load test: 50k concurrent voters in TOWNHALL mode; moderation queue latency p95 <2s | 13 | P0 | Q&A queue stable in S83 |
| **INSIGHTS+ frontend** |
| `INSIGHTS-05` | Facilitator scorecard API: sessions-run, avg participation, response rate, mood trend (non-ZK) | 8 | P1 | INSIGHTS-03 + sentiment foundation |
| `INSIGHTS-06` | Dashboard UI: cross-session Insights tab; recurring themes, trends, scorecard; WCAG 2.1 AA | 13 | P1 | INSIGHTS-05 + FE components |
| **Marketplace / Agent prep** |
| `AGENT-MARKETPLACE-FOUNDATION-01` | Agent registry schema + listing endpoints (not yet live; S85 gate) | 13 | P0 | — |
| **Observability** |
| `INSIGHTS-08` | Observability: `insight.aggregated`, `trends_viewed`, `scorecard_viewed` AE events + adoption KPI | 5 | P1 | — |
| **Security / Marketing** |
| `SEC-AGENT-EVAL-01` | Agent safety eval suite: capability gates, action validation, autonomous-action guards | 13 | P0 | ADR-0046 (shipped) |
| `MKTG-84-01` | v5.1 launch: release notes + feature highlights + internal-comms ICP positioning | 8 | P1 | — |
| `MKTG-84-02` | TOWNHALL scale story (case study): 50k moderation proof + competitive positioning | 6 | P1 | — |

**Stretch items**:
| `TOWNHALL-05-REGROUP` | Group/ungroup moderation UI + 5k regrouping load test | 13 | P1 | — |
| `AI-452`–`AI-456` | Agent runtime + safety (continued) | 13 | P1 | — |

### Exit criteria

- [ ] v5.1 live in production; zero rollback triggers in 24h
- [ ] TOWNHALL 50k load test results published; moderation queue p95 <2s verified
- [ ] INSIGHTS dashboard renders for Team-tier team with ≥3 non-ZK sessions
- [ ] Scorecard API returns facilitator metrics; no PII exposed
- [ ] Agent marketplace foundation schema live; test agent registered
- [ ] Agent safety eval suite green (no unsafe autonomous actions)
- [ ] `npm test` green; `tsc --noEmit` passes

### Dependencies

- v5.1 RC staging pass
- Load testing infrastructure (k8s, synthetic voters)
- ADR-0046 (shipped) — agent safety boundary

### KPI targets

- v5.1 GA adoption: ≥50% of active teams on v5.1 within 7 days
- TOWNHALL 50k proof: internal + marketing use
- INSIGHTS engagement: ≥20% of Team-tier teams open Insights tab in 14 days

---

## Sprint 85 — Hybrid events + INSIGHTS export + RETRO foundation (≈140 pts)

**Goal**: STAGE hybrid-event suite; INSIGHTS export + full rollup; RETRO recurring-workspace foundation; prepare for S86 v5.2 milestone.

**Release posture**: v5.1.1 patch release (if bug fixes warrant; else defer to S86 v5.2 prep).

### Committed items

| ID | Title | Pts | Pri | Dependency |
|---|---|---:|---|---|
| **Hybrid events (STAGE)** |
| `STAGE-FOUNDATION-01` | STAGE hybrid-event workspace: session mode, presenter/organizer roles, live broadcast feed | 13 | P0 | — |
| `FE-STAGE-PRES-01` | STAGE presenter UI: slide deck integration, live participant feed, Q&A panel | 13 | P1 | — |
| **INSIGHTS+ completion** |
| `INSIGHTS-07` | Export: JSON + CSV cross-session report; formula-injection safe; PDF stretch | 8 | P1 | INSIGHTS-06 shipped |
| `INSIGHTS-09` | Privacy/ZK guardrails: regression bundle (ZK excluded, k-anonymity floor, no PII in exports) | 8 | P0 | All INSIGHTS stories |
| `INSIGHTS-10` | Plan gating + entitlement: `crossSessionInsights` (Team tier+); contract tests | 5 | P0 | — |
| `I18N-INSIGHTS-01` | i18n: trend labels, scorecard, recurring topics in EN/NL/DE/FR/ES; `check:i18n` green | 3 | P1 | — |
| **RETRO / IDEATE foundation** |
| `RETRO-WORKSPACE-01` | RETRO recurring workspace: template-based sessions, team-health history, trend tracking | 13 | P0 | ADR-0048 (on-deck) |
| `IDEATE-BOARD-01` | IDEATE brainstorm workspace: idea capture, voting, clustering + facilitator dashboard | 13 | P1 | ADR-0048 gate |
| **Observability / Marketing** |
| `INSIGHTS-ADOPT-KPI-CONFIRM-01` | Verify INSIGHTS adoption KPI baseline: ≥40% of Team-tier teams viewed cross-session insights | 5 | P1 | All INSIGHTS shipped |
| `MKTG-85-01` | v5.1 wrap-up + S86 v5.2 teaser: agile-team ICP, RETRO feature preview | 8 | P1 | — |

**Stretch items**:
| `FE-RETRO-HEALTH-01` | Team-health trend UI + longitudinal scorecard | 13 | P1 | — |
| `IDEATE-PRIORITIZE-01` | Idea prioritization (dot voting, ranking) | 8 | P1 | — |

### Exit criteria

- [ ] STAGE workspace template live; presenter can broadcast to participants
- [ ] INSIGHTS export (JSON + CSV) generates cleanly; no formula injection
- [ ] Cross-session intelligence feature complete and gated behind Team-tier entitlement
- [ ] INSIGHTS adoption KPI measured: ≥40% of eligible teams opened cross-session view
- [ ] RETRO template available; team can create recurring retro
- [ ] IDEATE board functional; ideas capturable + voteable
- [ ] All INSIGHTS stories marked ✅ (epic complete)
- [ ] `npm test` green; `tsc --noEmit` passes

### Dependencies

- ADR-0048 (recurring workspaces) acceptance
- S84 v5.1 GA stable in production
- Team-tier entitlement tracking stable

### KPI targets

- INSIGHTS adoption: ≥40% of Team-tier teams
- RETRO template usage: ≥10 teams create a recurring retro by end of sprint
- Hybrid-event interest (STAGE): ≥3 internal pilots run

---

## Residual gaps (S81–S85)

| Gap | Pts | Plan | Owner | Notes |
|-----|-----|------|-------|-------|
| **TOWNHALL-12** | 8 | S82 stretch or S86 | Backend | Workers-AI profanity screening; async, per-session toggle, non-blocking ack. **Gate**: Workers AI model availability for async content filtering. |
| **MARKET-RESEARCH-VEVOX-01** | — | S81 planning cycle | Marketing | Competitive deep-dive (not engineering). Document Vevox's anonymous Q&A, moderation, and employee-voice analytics. **Gate**: Market research capacity. |
| **COPILOT residuals** | 29 | S82–S83 | Backend/AI | COPILOT-04 (8), COPILOT-07 (5), COPILOT-08 (8), COPILOT-10 (8) — all finished by end of S83. |

**Why deferred**:
- TOWNHALL-12 is an enhancement (profanity screening), not a GA blocker; defer if Workers AI models have latency constraints.
- MARKET-RESEARCH-VEVOX-01 is research-track work (no code), scheduled in marketing sprint planning.

---

## Cross-sprint dependencies & gates

| Gate | Complete by | Blocks |
|------|-------------|--------|
| ADR-0045 (INSIGHTS architecture) acceptance | End of S81 | INSIGHTS-02+ implementation |
| v5.1 RC staging pass | Mid-S83 | v5.1 GA release (S84) |
| Pentest #4 critical/high = 0 | End of S83 | v5.1 GA claim + marketplace live |
| Mobile app GA (store submission approved) | End of S82 | Native mobile GA release |
| TOWNHALL 50k moderation queue p95 <2s | Mid-S84 | TOWNHALL scale marketing |
| INSIGHTS adoption KPI ≥40% | End of S85 | v5.2 teaser in marketing |
| ADR-0048 (recurring workspaces) acceptance | Mid-S85 | RETRO/IDEATE implementation (S86+) |

---

## Release gates & exit criteria

### v5.1 RC (S83 exit)

- [ ] All committed S81–S83 stories at ✅
- [ ] Pentest #4 critical/high = 0
- [ ] Marketplace KYC compliance signed (legal gate)
- [ ] INSIGHTS Tier-1/2 APIs tested at scale (≥10 teams)
- [ ] COPILOT integration tests green (full flow)
- [ ] Device matrix passing (mobile)
- [ ] `npm test`, `tsc --noEmit`, `check:compliance-claims` all green
- [ ] Rollout plan documented

### v5.1 GA (S84 exit)

- [ ] v5.1 RC staging validation complete (zero P0 bugs 48h window)
- [ ] Production deployment successful; monitoring green
- [ ] TOWNHALL 50k load test published
- [ ] Agent marketplace foundation ready (not yet public)
- [ ] Marketing launch materials published

### Definition of Done (every story)

- [ ] Acceptance criteria demonstrated end-to-end
- [ ] Code reviewed + merged to main
- [ ] `npm test` green; `tsc --noEmit` passes
- [ ] All clickable elements ≥44px height (mobile first)
- [ ] Loading state visible for every async operation
- [ ] Error state visible in UI (no silent failures)
- [ ] Focus ring visible on keyboard navigation
- [ ] Tested at 375px viewport (iPhone SE)
- [ ] i18n: all user-facing strings in EN/NL/DE/FR/ES (unless explicitly out-of-scope)
- [ ] AE events instrumented with `teamId`, `plan`, correlation IDs where applicable
- [ ] No raw errors/PII in logs (use `safeLogContext()` per ADR-0009)

---

## KPI measurement plan (end of S85)

| KPI | Target | Owner | Measurement |
|-----|--------|-------|-------------|
| **Mobile GA adoption** | ≥2k installs by end of S82 | DevOps + Analytics | App store download counts + Firebase Analytics |
| **Marketplace partner onboarding** | ≥10 active partners by end of S83 | PO + Marketing | `partner_account_created` AE events |
| **INSIGHTS engagement** | ≥40% of Team-tier teams open cross-session view by end of S85 | Analytics | `insight.trends_viewed` AE events |
| **TOWNHALL scale proof** | 50k concurrent moderation queue p95 <2s by end of S84 | Backend + DevOps | Load test results; `townhall_question_moderated` AE latency |
| **COPILOT GA readiness** | COPILOT-04/07/08/10 all shipped by end of S83 | Backend + QA | Story ✅ status; integration tests passing |
| **Zero-knowledge safety** | Zero PII leaks in INSIGHTS exports/AE for ZK sessions | Security | Privacy audit + regression tests |

---

## Role-plan slices (sourced from existing role docs)

Detailed role commitments are in:

| Role | Document | S81–S85 notes |
|------|----------|---------------|
| **Backend** | `SPRINT81_90_BACKEND_PROPOSAL.md` | INSIGHTS data model + API routes (S81–S84); COPILOT residuals (S82–S83); TOWNHALL moderation (S84) |
| **Frontend** | `SPRINT81_90_FRONTEND_PROPOSAL.md` | Native mobile UI (S81–S82); INSIGHTS dashboard + export (S84–S85); STAGE/RETRO surfaces (S85) |
| **Security** | `SPRINT81_90_SECURITY_PLAN.md` | Pentest #4 (S81–S83); agent sandbox eval (S83–S84); privacy audit (S85) |
| **DevOps / Infra** | `SPRINT81_90_INFRA_PLAN.md` | Mobile CI/CD (S81–S82); Stripe Connect infra (S82); Pentest #4 remediation (S83) |
| **QA** | `QA_COMMITMENT_SPRINTS_81_90.md` | Device matrix (S81); contract tests (S82–S83); load test (S84); privacy regression (S85) |
| **i18n** | `I18N_SPRINT_81_90_PLAN.md` | App store listings (S81); INSIGHTS UI strings (S85) |
| **AI** | `SPRINT81_90_AI_PLAN.md` | Agent runtime schema (S81–S83); COPILOT observability (S83); agent safety (S84) |
| **Marketing** | (separate sprint marketing plan) | Mobile launch (S81–S82); marketplace GTM (S83); v5.1 GA (S84); RETRO teaser (S85) |

---

## Explicit deferrals (S81–S85)

The following committed work from [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md) is deferred to S86+ to focus on mobile GA + INSIGHTS+ + COPILOT residuals:

| Deferred item | Originally S | New target | Reason |
|---|---|---|---|
| DELIBERATE crypto receipt foundation (ADR-0049) | S86 | S86 (unchanged) | Pentest #5 scope; high-risk trust surface; needs parallel pentest #4 remediation window |
| EMBED SDK / developer API (ADR-0050) | S87 | S87+ (unchanged) | Marketplace GA → developer ecosystem; dependent on marketplace monetization confidence |
| Full FedRAMP ATO path (ADR-0052) | S89 | S89+ (unchanged) | Sovereign tier + gov procurement; dependent on s86–s88 product maturity |
| CAPTIONS / live translation (ADR-0051) | S88 | S88+ (unchanged) | AAA + multilingual; dependent on STAGE/RETRO momentum |
| CANVAS adaptive theming | S88 | S88+ (unchanged) | Low-priority UX; no revenue impact yet |

**Frontier commitment**: All five deferrals remain in the **macro S81–S90 roadmap**; this refined S81–S85 plan simply prioritizes INSIGHTS+ and COPILOT finish-work ahead of them.

---

## Risk mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| **Pentest #4 finds showstoppers (mobile security)** | Early engagement with security firm; scope signed S81; weekly triage. Remediation budget reserved S82–S83. | Security |
| **App store review delays (>2 weeks)** | Submit with beta flag in S81; prioritize app review guidelines; Slack w/ Apple/Google contacts. S82 can slip 1 week if needed. | DevOps |
| **INSIGHTS data model migration lock** | Architect reviews migration dry-run S81; D1 point-in-time backup before execute S82. Rollback plan documented. | Backend + DevOps |
| **COPILOT observability data lag** | AE events sampled for cost; but adoption KPI measured at sprint end (acceptable lag). Alert on zero-events if pipeline breaks. | Analytics |
| **Agent safety eval suite incomplete by S83** | Safety gate is **hard stop** for agent marketplace public. If incomplete, defer agent marketplace launch to S85. Accept v5.1 GA without public agent marketplace. | Security + PO |
| **TOWNHALL 50k moderation queue latency >2s p95** | Caching + DO connection pooling. If latency unmet by mid-S84, scale messaging claim to "25k GA" and defer "50k" to S85 patch. | Backend + DevOps |
| **INSIGHTS adoption KPI miss (<40% Team-tier engagement)** | Dashboard UX may need refinement. If miss at S85 end, KPI reset for S86 measurement; product stays shipped (no delay). | Frontend + Analytics |

---

## Scope protection invariants

| Invariant | Rationale | Enforcement |
|---|---|---|
| **INSIGHTS+ ADR-0045 must be accepted before S82 implementation** | Blocks cross-team data model + privacy decisions; cannot start D1 migration without it. | PO + Architect gatekeep INSIGHTS-01 start |
| **COPILOT residuals MUST be complete by end S83** | Blocks "COPILOT GA" claim; shipped stories (COPILOT-01/02/03/05/06/09) stay stable regression baseline. | Backend ✅ story cap; no scope slip into S84 |
| **Pentest #4 critical/high must be zero before v5.1 GA** | Security gate; cannot release v5.1 with open high-severity mobile/marketplace vulns. | Security lead sign-off; release blocked if violated |
| **No third-party AI beyond Workers AI for INSIGHTS/COPILOT** | Hard rule #1 from CLAUDE.md; cost + privacy + latency constraints. | Code review gate; no `ANTHROPIC_API_KEY` allowed |
| **Native mobile must use offline queue** | Carrier signal loss common in field; voter must not lose response on reconnect. | FE acceptance criteria; device test assertion |

---

## PO sign-off checklist

Before S81 kickoff:

- [ ] Confirm v5.0 GA (S80) shipped and stable in production
- [ ] ADR-0045 (INSIGHTS) in Architect's acceptance queue; target review completion by end of S81
- [ ] Pentest #4 scope document signed with security firm
- [ ] Stripe legal review of KYC flow complete (needed for S82 MARKETPLACE-CONNECT-01 start)
- [ ] COPILOT residuals (COPILOT-04/07/08/10) groomed and added to sprint board
- [ ] Mobile app signing certificate + App ID profiles ready (Apple Developer + Google Play)
- [ ] Each sprint cap verified ≤150 pts in tracker (exclude stretch items from committed total)
- [ ] Role leads confirm capacity per [`SPRINT81_90_*_PLAN.md`](./SPRINT81_90_PLAN.md) documents
- [ ] Marketing confirms MARKET-RESEARCH-VEVOX-01 ownership + timeline (S81 research phase)
- [ ] This plan (SPRINT81_85_PLAN.md) signed by PO + Architect
- [ ] Calendar windows communicated to team (S81: 2026-06-02)

---

## Appendix: From SPRINT81_90_PLAN § Epic map

This plan S81–S85 maps to the first **two epicycles** of the ten-epic roadmap:

1. **E81 (Native Mobile GA)** — **S81–S82** (this plan, mostly)
2. **E82 (Marketplace Economy)** — **S82–S83** (this plan, mostly)
3. **E83 (Agentic Facilitation)** — **S83–S84** (agent-runtime foundation, deferred public marketplace to S86+)
4. **E84 (Town Hall & Hybrid Events)** — **S84–S85** (TOWNHALL scale proof + STAGE foundation)
5. **E85 (Continuous Collaboration)** — **S85+** (RETRO/IDEATE foundation, deferred full GA)

**INSIGHTS+ (Cross-Session Intelligence)** is a **parallel cross-cutting epic**, not in the original ten-epic list. It unlocks the **analytics moat** and is sequenced S81–S85 in parallel with mobile/marketplace/agentic work, feeding into the Team-tier upsell motion.

**COPILOT residuals** complete the shipped COPILOT epic (S76–S80); all four remaining stories (COPILOT-04/07/08/10) are committed by end of S83.

---

**Versioning**: SPRINT81_85_PLAN v2.0 — Reconciliation plan created 2026-06-01, replacing the single-epic-per-sprint narrative from SPRINT81_90_PLAN with a fine-grained, dependency-aware S81–S85 sequence. All S81–S85 items are **committed**; S86–S90 remain **planned** (see SPRINT81_90_PLAN).
