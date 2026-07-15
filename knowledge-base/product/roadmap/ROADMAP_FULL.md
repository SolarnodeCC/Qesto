---
id: ROADMAP
type: planning
domain: product
category: strategy
status: active
version: 1.1
created: 2026-04-01
updated: 2026-07-14
tags:
  - roadmap
  - planning
  - strategy
  - releases
relates_to:
  - SPEC_PRODUCT
  - BACKLOG_MASTER
---

# Qesto — Roadmap & Release Status (Current)

_Hub: [Documentation map](../../README.md)._

> **Forward planning runs on release trains, not sprints.** Current GA: `7.0.0`.
> For committed forward work read [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md); for the
> cadence contract + horizon map (RT-01 stabilize → RT-02 UX debt → RT-03 v7.1/XR conditional)
> read [`RELEASE_TRAIN_MASTER.md`](../planning/RELEASE_TRAIN_MASTER.md). The "Next planning
> milestones" and "Sprint N" sections below are **historical record** of how shipped versions
> were sequenced — do **not** treat them as the next thing to build.

_Last audit refresh: **2026-07-14** — [`BACKLOG_AUDIT_2026-07-14.md`](../../quality/audits/BACKLOG_AUDIT_2026-07-14.md). RT-01 (stabilize) closed 2026-07-14 with a recorded P0 exception (CI blocked on GitHub billing); RT-02 (UX debt/dashboards) is active, target close 2026-07-31. Note on the narrative below: the v7.0-GA status note carries the sprint-narrative date "2026-11-03"; the verified engineering evidence date for v7.0 GA is **2026-06-19** (see [`SPRINT99_EXECUTION.md`](../releases/SPRINT99_EXECUTION.md))._

_Historical status note (sprint-narrative date 2026-11-03) — **v7.0 GA shipped at Sprint 99** (Engagement Intelligence Network): REACTIONS / PULSE / COPILOT / LEARN / SOVEREIGN+ / CONNECT / STUDIO all GA; XR ships beta only behind `beta-xr`. Platform certified at `7.0.0` (ADR-0063: Pentest #6 closed, ADR-0062 isolation proof, DR drill ≤2h, SOC 2 annual, bounded AAA); v6.x → 24-month maintenance. Current GA: `7.0.0`. See [`v7.0.0.md`](../releases/v7.0.0.md). Previous: 2026-06-11 — added **Sprint 85–99 9-Day-Cadence Re-plan toward v7.0**_
_Superseded: 2026-06-11 (UTC) — added **Sprint 85–99 9-Day-Cadence Re-plan toward v7.0** (cadence change 10→9 working days, capacity retained at 120–150 pts; S85–S90 carry the committed v6.0 epics re-spaced, S91–S99 add 8 net-new epics E91–E98 → v7.0 GA) with agent synthesis (PO, architect, market research). Previous refresh 2026-06-01 (Sprint 81–90 Post-v5.0 Expansion Arc, E81–E90 → v6.0 GA)._

## Release status

**Current GA: `7.0.0`** (certified per ADR-0063; engineering evidence 2026-06-19). Forward work runs on release trains — see [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md). `v7.1.0` is conditional (RT-03, EPIC-VALID gates).

<details>
<summary>Historical release-status snapshot (v2.x era, superseded — kept for archive continuity)</summary>

- **v2.0.0**: shipped core realtime sessions, auth, billing foundations, AI-assisted flows, i18n baseline, and broad automated testing.
- **v2.1 (shipped)**: stabilization + entitlement enforcement + enterprise/compliance readiness + translation QA hardening.
- **v2.2 (shipped as part of the v2.x→v3 arc)**: LIVE engagement depth (Quick Finger, Team Quiz, leaderboard, badges), resilience P0 (PII sanitization, AI timeouts, circuit-breaker wiring), admin analytics maturity, enterprise hardening, integration provider foundation.
- **v2.3 (shipped as part of the v2.x→v3 arc)**: Integration ecosystem (Slack, Teams, generic webhooks), compliance evidence (EU residency docs, GDPR badge, SOC 2 framework), AI depth (recap provenance, real-time session sentiment), anonymous engagement leadership (zero-knowledge mode depth).

</details>

## Epic status summary
-  **Core Session Platform** (session lifecycle, realtime voting, presenter controls)
-  **Billing + Plan foundations** (Stripe integration + plan middleware)
-  **Authentication** (magic link + SAML)
-  **Enterprise operations** (audit and role granularity still finishing)
-  **Internationalization QA** (locale bundles done; validation hardening ongoing)
-  **Gamification expansion** (base energizers done; advanced scenarios queued)

## Next planning milestones

### Sprint 20 — Readiness + Entitlement Enforcement + Measurement (built; verification gate)
**Focus:** Stabilize v2.1 before the next feature expansion: plan entitlement coverage, Sprint 19 KPI measurement, observability evidence, and trustworthy local/CI quality gates.

**Key items:**
| Item | Status |
|---|---|
| ENTITLEMENTS-01 Pricing claim → backend gate matrix | ✅ Shipped 2026-05-01 |
| ENTITLEMENTS-02 Contract tests for paid capabilities | ✅ Built 2026-05-04 |
| OBS-02 Sprint 19 operational evidence | ✅ Shipped 2026-05-01 |
| QA-DOCDRIFT-01 Align docs with package scripts/test counts | ✅ Shipped 2026-05-01 |
| DESIGN-GATE-01 Stabilize token drift check locally and in CI | ✅ Shipped 2026-05-01 |
| S19-MEASURE-01 AI wizard + Launchpad KPI baseline | ✅ Completed with durable events 2026-05-04 |
| AUTHZ-ADR-01 Custom RBAC authorization ADR | Proposed for Sprint 20 review |
| Sprint A verification bundle | Verification gate active |

**Gate:** RBAC depth/custom roles require `ADR-0004` acceptance by Product Owner + Architect; LIVE energizers require a Durable Object protocol/versioning ADR.

### Sprint 21 — Enterprise Authorization + Compliance UX (✅ Shipped 2026-05-04)
**Focus:** Turn the Sprint 20 entitlement evidence into an authorization design the team can safely extend. This is the first sprint where RBAC depth can move, but only after the ADR is accepted.

**Key items:**
| Item | Status |
|---|---|
| AUTHZ-ADR-01 Custom RBAC authorization ADR | ✅ Accepted 2026-05-04 |
| AUTHZ-RBAC-01 Custom role permission matrix + server-side enforcement plan | ✅ Shipped 2026-05-04 |
| AUTHZ-RBAC-02 Admin role-management UX and delegated permissions | ✅ Shipped 2026-05-04 (backend API; frontend UI deferred) |
| ENT-03/ENT-04 compliance UX follow-through from audit/admin evidence | ✅ Shipped 2026-05-04 |

**Quality:** 16 integration tests; 0 TypeScript errors; audit trail ✅

### Sprint 22 — Template Catalogue + Session Creation Polish (✅ Shipped 2026-05-04)
**Focus:** Pull forward the next functional requirement from `SPEC.md`: make templates a complete session-starting surface instead of a passive dashboard tab.

**Key items:**
| Item | Status |
|---|---|
| TPL-CATALOG-01 Customer vs Qesto template groups | ✅ Shipped 2026-05-04 |
| TPL-CATALOG-02 Template overview confirmation flow | ✅ Shipped 2026-05-04 |
| TPL-CATALOG-03 Minimum 3 Qesto templates per required topic + functional coverage | ✅ Shipped 2026-05-04 |
| Wizard seeding from selected template into the customize step | ✅ Shipped 2026-05-04 |

**Quality:** 14 tests; i18n validated ✅

### Sprint 23 — Launchpad + Design Polish (✅ Shipped 2026-05-04)
**Focus:** Complete Website Design Wave Sprint C after Sprint 19 measurement proves the wizard → Launchpad path is reliable.

**Key items:**
| Item | Status |
|---|---|
| LAUNCHPAD-02 Inline editor, reorder, and state-preserving back-to-questions flow | ✅ Shipped 2026-05-04 |
| DESIGN-POLISH-01 Primary CTA hover/motion polish | ✅ Shipped 2026-05-04 |
| DESIGN-POLISH-02 Logo optical weight + sparkle mark | ✅ Shipped 2026-05-04 |
| AI-VIS-01 Landing AI narrative + copy/i18n sign-off | ✅ Shipped 2026-05-04 |

**Quality:** 3 polish contract tests; 644 full suite; 38 a11y; token drift ✅

### Sprint 24 — v2.2 Realtime Governance + Admin Hardening (✅ Shipped 2026-05-18)
**Focus:** Start v2.2 depth work with protocol governance first, then controlled LIVE energizer and analytics expansion.

**Key items:**
| Item | Status |
|---|---|
| DO-PROTOCOL-ADR-01 Durable Object protocol/versioning ADR | ✅ Shipped 2026-05-18 via `ADR-0005` |
| AUTHZ-ROLE-UI-01 Custom role-management UI | ✅ Shipped 2026-05-18 (Spring 21 integration) |
| ADMIN-ANALYTICS-01 Admin reporting/export maturity | ✅ Shipped 2026-05-18 |
| Legacy backlog status reconciliation for v2.x regression contracts | ✅ Shipped 2026-05-18 |
| GAM-01 LIVE energizer foundation behind versioned message contracts | ✅ Shipped 2026-05-18 |

**Quality:** 717 tests; TypeScript 0 errors; 4px baseline ✅

### Sprint 25 — LIVE Energizer Protocol Foundation (✅ Shipped 2026-05-19)
**Focus:** Use the accepted Sprint 24 protocol contract to add the first dark-launched LIVE energizer WebSocket foundation.

**Key items:**
| Item | Status |
|---|---|
| GAM-LIVE-01 Presenter-only `energizer_activate` frame | ✅ Shipped 2026-05-19 |
| GAM-LIVE-FLAG-01 `LIVE_ENERGIZERS_ENABLED` rollout guard | ✅ Shipped 2026-05-19 |
| GAM-LIVE-RECONNECT-01 active energizer state in `init` snapshots | ✅ Shipped 2026-05-19 |

**Quality:** 46 tests; v1 protocol versioned ✅

### Sprint 26-32 — v2.2 Live Engagement to Enterprise Release (Sprints 26-29 ✅ Shipped, 30-32 active)
**Focus:** Turn the Sprint 25 dark-launched protocol into staged gameplay, then mature scoring, badges, resilience hardening, enterprise permissions, and release readiness. Sprints 30-32 revised 2026-05-20 to incorporate specialist agent review findings (ADMIN-ENGAGE-01/02 already shipped; resilience P0 items added; Sprint 32 de-risked by moving Slack to Sprint 33).

| Sprint | Goal | Status |
|---|---|---|
| Sprint 26 | LIVE energizer activation readiness and staging WebSocket smoke | ✅ Shipped 2026-05-19: presenter activation, flag-off/on guards, reconnect state |
| Sprint 27 | First playable LIVE energizer: Quick Finger | ✅ Shipped 2026-05-19: participant answers, DO validation, score broadcast, reconnect-safe state |
| Sprint 28 | Team Quiz LIVE loop | ✅ Shipped 2026-05-19: quiz progression, locked submissions, score summary, reconnect state |
| Sprint 29 | Leaderboard + badge foundation | ✅ Shipped 2026-05-19: bounded leaderboard, deterministic badge hooks, idempotency tests |
| Sprint 30 | Resilience P0 + analytics observability | Active: PII sanitization CI gate, AI timeouts, vote.submitted AE event; ADMIN-ENGAGE-01/02 already shipped |
| Sprint 31 | Enterprise hardening + circuit-breaker wiring + integration foundation | Planned: circuit breakers (ADR-0007), INT-PROVIDER-01 with real encryption, ANON-DEPTH-01 (ADR-0010 gate) |
| Sprint 32 | v2.2 RC + code quality + export foundation | Planned: Full regression (840+ tests), CODE-SPLIT-01, EXPORT-RICH-01-A, PERF-PROOF-01 |

**Plan:** See [`SPRINT26_32_PLAN.md`](../planning/SPRINT26_32_PLAN.md).

### Sprint 33-34 — v2.3 Integration Suite, Compliance & AI Depth (Planned)
**Focus:** Fill the #1 lost-deal reason (integrations), start the enterprise compliance evidence story, extend AI from generation-only to session-aware inference.

| Sprint | Goal | Status |
|---|---|---|
| Sprint 33 | Integration suite (Slack, Teams, webhooks) + AI context schema + ADR-0011 | Planned: 2026-07-08 to 2026-07-22 |
| Sprint 34 | Compliance evidence + AI depth (sentiment, recap provenance) + anonymous leadership | Planned: 2026-07-22 to 2026-08-05 |

**Plan:** See [`SPRINT33_34_PLAN.md`](../planning/SPRINT33_34_PLAN.md).

### Sprint 30-39 — Ten-Sprint Horizon (v2.2 → v2.4)

**Focus:** Committed S30–S34 execution plus groomed S35–S39 backlog (SOC 2 Type I, Zoom, white-label, mobile PWA, Salesforce, LDAP, tournaments, AI coaching).

| Sprint range | Release | Status |
|---|---|---|
| Sprint 30-32 | v2.2 | S30 active; S31-32 planned |
| Sprint 33-34 | v2.3 | Planned |
| Sprint 35-39 | v2.4 foundation | Backlog groomed; ADRs 0012–0019 |

**Plan:** See [`SPRINT30_39_PLAN.md`](../planning/SPRINT30_39_PLAN.md).

### Sprint 40–50 — v3.0 Platform RC

**Focus:** Multi-region read activation, Public API v2 realtime, SDK/partner tiers, observability hardening ([`v3.0.0-RC.md`](../releases/v3.0.0-RC.md)).

| Sprint range | Release | Status |
|---|---|---|
| Sprint 40–45 | v2.6 / integrations depth | Shipped specs in `planning/sprints/SPRINT40_*` … `SPRINT46_*` |
| Sprint 46–49 | Multi-region + API v2 + tracing | Shipped |
| Sprint 50 | v3.0.0 RC | Shipped |

### Sprint 60–70 — Post-v3.0 Platform Arc (3× capacity)

**Focus:** API v3, repository/DO decomposition, multi-region **writes**, SOC 2 Type II, federation, edge AI coach, 50k scale proof. **120–150 pts per 2-week sprint** (vs 40–50 in S30–S39).

| Sprint range | Release | Target |
|---|---|---|
| Sprint 60–62 | v3.1 | API v3 draft + platform boundaries |
| Sprint 63–66 | v3.2 | Governance + marketplace + Type II |
| Sprint 67–70 | v4.0 | Federation + platform GA |

**Plan:** [`SPRINT60_70_PLAN.md`](../planning/SPRINT60_70_PLAN.md) (2026-05-25, all-agent synthesis).

### Sprint 71–80 — Post-v4.0 Platform Maturity Arc (3× capacity)

**Focus:** Dark mode GA, Zoom/Slack at scale, 100k load proof, EU residency enforce, copilot multi-turn + edge, audit API, realtime v3, FedRAMP path (docs), v5.0 GA certification. **120–150 pts per 2-week sprint.**

| Sprint range | Release | Target |
|---|---|---|
| Sprint 71–73 | v4.1 | Experience GA + event integrators + dev portal v2 |
| Sprint 74–76 | v4.2 | Federation depth + metering + 100k proof + copilot GA |
| Sprint 77–79 | v5.0-rc | Tenant isolation + audit/CMK + realtime v3 + compliance closure |
| Sprint 80 | v5.0 GA | Platform certification + DR drill + AAA conformance |

**Plan:** [`SPRINT71_80_PLAN.md`](../planning/SPRINT71_80_PLAN.md) (2026-05-27, all-agent synthesis). Role plans: [`SPRINT71_80_INFRA_PLAN.md`](../planning/SPRINT71_80_INFRA_PLAN.md), [`SPRINT71_80_FRONTEND_PROPOSAL.md`](../planning/SPRINT71_80_FRONTEND_PROPOSAL.md), [`QA_COMMITMENT_SPRINTS_71_80.md`](../backlog/QA_COMMITMENT_SPRINTS_71_80.md), [`MARKETING_SPRINTS_71_80.md`](../marketing/MARKETING_SPRINTS_71_80.md), [`I18N_SPRINT_71_80_PLAN.md`](../planning/I18N_SPRINT_71_80_PLAN.md).

### Sprint 81–90 — Post-v5.0 Platform Expansion Arc (3× capacity) — NEW

**Focus:** Spend the certified v5.0 platform's credibility on **reach, economy, and new buyers**. Native mobile store apps GA, a paid marketplace (Stripe Connect payout + agent runtime + revenue share), and the promotion of the [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md) ideation set (town hall, hybrid events, retrospectives, ideation, verifiable governance, embeddable SDK, adaptive themes, live captions) into committed scope — opening internal-comms, events, agile-team, governance, and developer buyers. Closes on **v6.0 GA** with full FedRAMP Moderate ATO path + WCAG AAA. **120–150 pts per 2-week sprint.**

**Ten new epics (E81–E90):**

| Epic | Sprints | North star |
|---|---|---|
| E81 — Native Mobile GA | S81–S82 | iOS + Android store apps GA (Capacitor); offline-first voter shell; native push |
| E82 — Marketplace Economy | S82–S83 | Paid listings + Stripe Connect payout + revenue share + partner billing |
| E83 — Agentic Facilitation | S83–S84 | AI agent runtime GA (AgentRunDO) + agent marketplace (Workers AI only) |
| E84 — Town Hall & Hybrid Events | S84–S85 | TOWNHALL moderated anonymous Q&A at scale + STAGE hybrid-event suite |
| E85 — Continuous Collaboration | S85–S86 | RETRO retrospectives + IDEATE brainstorm/prioritization recurring workspaces |
| E86 — Verifiable Governance | S86–S87 | DELIBERATE cryptographically-verifiable voting + receipts + audit-grade tally |
| E87 — Embeddable Platform | S87–S88 | EMBED engagement SDK + public widget API (highest TAM ceiling) |
| E88 — Adaptive Experience & AAA | S88–S89 | CANVAS themes + adaptive dataviz + CAPTIONS live translation + WCAG AAA GA |
| E89 — Gov Cloud & Full ATO | S89 | FedRAMP Moderate full ATO path + sovereign tenant tier |
| E90 — Platform v6.0 Certification | S90 | v6.0 GA; certification bundle; annual DR drill; v5.x sunset |

| Sprint range | Release | Target |
|---|---|---|
| Sprint 81–83 | v5.1 | Native mobile GA + marketplace economy + agent runtime foundation |
| Sprint 84–86 | v5.2 | New-business suite (town hall, events, retro, ideate) + agentic GA |
| Sprint 87–89 | v6.0-rc | Embeddable SDK + verifiable governance + adaptive/AAA + gov cloud |
| Sprint 90 | v6.0 GA | Certification bundle + DR evidence + v5.x sunset |

**New ADRs:** ADR-0044 (Capacitor store GA) · ADR-0045 (marketplace billing/Stripe Connect) · ADR-0046 (agent runtime GA) · ADR-0047 (town-hall moderation DO) · ADR-0048 (recurring-workspace model) · ADR-0049 (verifiable-voting crypto) · ADR-0050 (embed SDK sandbox) · ADR-0051 (captions/translation, Workers AI) · ADR-0052 (FedRAMP full ATO + sovereign tier) · ADR-0053 (v6.0 certification). **Forbidden:** ADR-0046 (agent runtime GA) and ADR-0049 (verifiable-vote crypto) must not co-land.

**Plan:** [`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) (2026-06-01, all-agent synthesis). Role plans: [`SPRINT81_90_INFRA_PLAN.md`](../planning/SPRINT81_90_INFRA_PLAN.md), [`SPRINT81_90_FRONTEND_PROPOSAL.md`](../planning/SPRINT81_90_FRONTEND_PROPOSAL.md), [`SPRINT81_90_BACKEND_PROPOSAL.md`](../planning/SPRINT81_90_BACKEND_PROPOSAL.md), [`SPRINT81_90_ARCH_NOTES.md`](../planning/SPRINT81_90_ARCH_NOTES.md), [`SPRINT81_90_SECURITY_PLAN.md`](../planning/SPRINT81_90_SECURITY_PLAN.md), [`SPRINT81_90_AI_PLAN.md`](../planning/SPRINT81_90_AI_PLAN.md), [`SPRINT81_90_ANALYTICS_PLAN.md`](../planning/SPRINT81_90_ANALYTICS_PLAN.md), [`QA_COMMITMENT_SPRINTS_81_90.md`](../backlog/QA_COMMITMENT_SPRINTS_81_90.md), [`MARKETING_SPRINTS_81_90.md`](../marketing/MARKETING_SPRINTS_81_90.md), [`I18N_SPRINT_81_90_PLAN.md`](../planning/I18N_SPRINT_81_90_PLAN.md), [`MARKET_VALIDATION_S81_90.md`](../research/MARKET_VALIDATION_S81_90.md).

### Sprint 85–99 — 9-Day-Cadence Re-plan toward v7.0 GA — NEW (2026-06-11)

**Cadence change:** Sprints move from 10-working-day (2-week) to **9 working days**. Committed capacity is **retained at 120–150 pts/sprint**, so per-build-day load rises ~+11–12.5% — the squeeze is absorbed on *serial* windows (two-sprint RC for majors, pentests opened a sprint earlier with remediation decoupled from the sprint clock, end-of-sprint gates converted to continuous per-PR gates).

**Two halves of one arc:**
- **S85–S90 — finish v6.0.** The same committed v6.0 epics (E85–E90: continuous collaboration, verifiable governance, embed, adaptive/AAA, gov full-ATO, certification) re-spaced onto 9-day stepping. Content unchanged from the S81–S90 plan.
- **S91–S99 — net-new horizon toward v7.0.** Eight market-validated epics that **deepen and operationalize** shipped surfaces rather than open new trust boundaries, closing on **v7.0 GA — the "Engagement Intelligence Network."**

**Eight net-new epics (E91–E98):**

| Epic | Sprints | Release | New buyer · moat |
|---|---|---|---|
| E91 — REACTIONS GA | S91–S92 | v6.1 | Creators / webinar hosts · edge latency |
| E92 — PULSE (HR/people-ops analytics) | S91–S93 | v6.2 | HR/People-ops · native AI + zero-knowledge |
| E93 — COPILOT GA (supervised AI co-pilot) | S92–S93 | v6.1 | Base upsell / Menti switchers · native AI |
| E94 — LEARN (L&D / LMS via EMBED) | S93–S95 | v6.2 | L&D / LMS · engine + EMBED SDK |
| E95 — SOVEREIGN+ (region residency + audit) | S93–S95 | v6.2 | EU/DACH public sector · residency moat |
| E96 — CONNECT (cross-tenant federation) | S95–S97 | v7.0-rc | Multi-org events / associations · network moat |
| E97 — STUDIO (privacy-native AI authoring) | S96–S98 | v7.0 | Content/enablement · native AI + CANVAS |
| E98 — XR (beta) | S98–S99 | v7.0 beta | Hybrid-event / innovation (gated, speculative) |

| Sprint range | Release | Target |
|---|---|---|
| S85–S86 | **v5.2 GA** | Continuous collaboration + STAGE hybrid events |
| S87–S89 | **v6.0-rc** | Embed + governance GA + adaptive/AAA + gov ATO |
| S90 | **v6.0 GA** | Certification bundle + DR drill + v5.x sunset |
| S91–S92 | **v6.1 GA** | Creator reach (REACTIONS) + live AI co-pilot (COPILOT) |
| S93–S95 | **v6.2 GA** | Data product (PULSE) + verticals (LEARN, SOVEREIGN+) |
| S95–S97 | **v7.0-rc** | The network turn — federation (CONNECT) + authoring (STUDIO) |
| S97–S99 | **v7.0 GA** | Engagement Intelligence Network GA + XR beta |

**New ADRs:** ADR-0054 (cadence-9 governance) · ADR-0055 (REACTIONS GA) · ADR-0056 (agentic L2) · ADR-0057 (analytics aggregation plane) · ADR-0058 (vertical packaging) · ADR-0059 (ecosystem egress) · ADR-0060 (AI analytics narration) · ADR-0061 (agentic L3 ceiling) · ADR-0062 (scale/isolation proof) · ADR-0063 (v7.0 certification). **Do-not-co-land:** ADR-0056 ✗ ADR-0057; ADR-0059 ✗ ADR-0060; ADR-0061 ✗ any data-egress/analytics-AI GA; ADR-0062 ✗ ADR-0063.

**Plan (S85–S99 arc, shipped v7.0):** [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) (historical). **Post-GA committed horizon:** [`RELEASE_TRAIN_MASTER.md`](../planning/RELEASE_TRAIN_MASTER.md) + [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md). Supporting: [`SPRINT85_99_ARCH_NOTES.md`](../planning/SPRINT85_99_ARCH_NOTES.md), [`SPRINT91_99_STORIES.md`](../planning/SPRINT91_99_STORIES.md), [`MARKET_VALIDATION_S85_99.md`](../research/MARKET_VALIDATION_S85_99.md).

### Post-v2.2 Commercial Promise Completion

**Focus:** Keep go-live copy honest while sequencing the higher-value promises that were removed or marked roadmap during the marketing promise audit. Promises now have sprint assignments following the 2026-05-20 planning refresh.

| Item | Status | Sprint |
|---|---|---|
| MKT-PROMISE-01 Launch-safe marketing promise audit and copy correction | ✅ Implemented 2026-05-05; public pages now avoid unsupported compliance, export, integration, latency, and AI provenance claims | — |
| EXPORT-RICH-01-A Structured JSON + enhanced CSV export | Planned: Sprint 32 | S32 |
| EXPORT-PDF-01 Signed PDF session summary | Planned: Sprint 33 stretch or Sprint 34 stretch | S33+ |
| SLACK-01/02 Slack integration (session results + settings) | Planned: Sprint 33 | S33 |
| TEAMS-01 Microsoft Teams integration | Planned: Sprint 33 | S33 |
| WEBHOOK-01 Generic webhook with HMAC + SSRF controls | Planned: Sprint 33 | S33 |
| INT-WEBHOOK-01 (full suite) Workday, BambooHR, Notion webhooks | Future: Sprint 35+ | S35+ |
| ENT-COMPLIANCE-01 SOC 2 evidence framework scaffolding | Planned: Sprint 34 | S34 |
| COMPLIANCE-03 SOC 2 Type I full audit | Future: Sprint 35+ (13 pts) | S35+ |
| ENT-RESIDENCY-01 EU residency: routing evidence + DPA template | Planned: Sprint 34 (documentation deliverable; D1 location irreversible) | S34 |
| COMPLIANCE-02 DPA/SCC template + compliance CI claim gate | Planned: Sprint 34 | S34 |
| AI-RECAP-PROV-01 AI recap evidence/edit provenance | Planned: Sprint 34 (extends AI-CONTEXT-01 from Sprint 33) | S34 |
| AI-SENTIMENT-01 Real-time session sentiment (Workers AI) | Planned: Sprint 34 (requires ADR-0011 accepted in Sprint 33) | S34 |
| PERF-PROOF-01 Production latency benchmark evidence | Planned: Sprint 32 (requires OBS-VOTE-01 from Sprint 30 for 30d of data) | S32 |
| GDPR-TRUST-PAGE-01 GDPR compliance trust page (marketing artifact, no engineering) | Planned: Sprint 31 — ship early to capture Mentimeter GDPR churn wave; engineering badge follows in Sprint 34 | S31 |
| GDPR-BADGE-01 GDPR compliance badge + deletion automation | Planned: Sprint 34 | S34 |
| ZOOM-01 Zoom integration | Planned: Sprint 33 stretch or Sprint 34 — **market research flag (WIN_LOSS_ANALYSIS): Zoom is #2 loss reason for event organizers; without it, event-organizer GTM must be deferred** | S33+/S34 |

**Gate:** Any claim moved from roadmap to public launch copy must have a matching implementation path, tests, and documentation evidence in the same PR. Sprint 34 compliance claim CI gate (COMPLIANCE-02) enforces this automatically.

**New ADRs required before implementation:**
- ADR-0010 (zero-knowledge mode) — Sprint 31 gate for ANON-DEPTH-01
- ADR-0011 (live sentiment inference + DPIA) — Sprint 33, required before Sprint 34 AI-SENTIMENT-01
- ADR-0007 amendment (CircuitBreaker.INTEGRATIONS) — Sprint 31 gate for CB-01 wiring

### Sprint A — Layout + Token Foundation (mostly shipped; verify in Sprint 20)
**Focus:** Design-token source of truth, layout primitives, a11y baseline, i18n bug fixes.

**Key items (P0 first):**
| Item | Status |
|---|---|
| DESIGN-TYP-01 Typography refresh (Inter body) | ✅ Shipped 2026-04-21 |
| LAYOUT-SKELETON-01 Skeleton/empty/error state parity | ✅ Shipped 2026-04-21 |
| LAYOUT-MOTION-01 Motion choreography tokens | ✅ Shipped 2026-04-21 |
| LAYOUT-GRID-01 Responsive 12/8/4-column grid primitive | Verify/close in Sprint 20 |
| LAYOUT-A11Y-01 Landmark regions, skip-link, WCAG 2.2 focus | Verify/close in Sprint 20 |
| DESIGN-TOK-01 Design-token source-of-truth → src/ui/tokens.ts | Verify/close in Sprint 20 |
| AI-VIS-03 `<AIBadge>` primitive + sparkle icon | ✅ Shipped 2026-04-30 |
| DX-INSIGHTS-01 Dashboard Insights tab scaffold | Verify/close in Sprint 20 |
| I18N-BUG-01 Fix missing wizard step4 keys across 5 locales | Verify/close in Sprint 20 |
| I18N-BUG-02 Fix Dutch/English mixing on Launchpad | Verify/close in Sprint 20 |

### Sprint B — Narrative + Wizard + Launchpad + Density (implementation complete except marketing narrative)
✅ AI-VIS-02, ✅ DX-INSIGHTS-02, ✅ WIZ-AI-01, ✅ WIZ-AI-02, ✅ WIZ-OVERVIEW-01, ✅ LAUNCHPAD-01, ✅ LAYOUT-DENSITY-01 shipped 2026-04-30. AI-VIS-01 remains marketing/copy scope.

**Gate:** Sprint 20 must measure AI wizard and Launchpad reliability before further Launchpad expansion.

### Sprint C — Polish (planned after Sprint 20 readiness)
DESIGN-POLISH-01, DESIGN-POLISH-02, LAUNCHPAD-02.

**Gate:** Brand sign-off on logo; 0 a11y regressions; Sprint 19 KPI baseline acceptable.

### Parallel feature work (shipped since 2026-04-19)
- Dashboard personalised greeting (replaces "Your sessions" heading)
- Active plan badge visible on dashboard
- Teams and Templates tabs added to dashboard tab bar
- Search + status filter on Draft & live session list
- Admin panel button for superuser role; `/admin` route guarded
- Language switcher added to header on all pages
- End-to-end session join flow: QR code scanning, join bar, polished voter UX
- Six experience-improvement recommendations implemented
- Marketing solution pages narrative expanded (education, business, enterprise)
