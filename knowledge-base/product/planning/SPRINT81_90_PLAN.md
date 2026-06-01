---
id: SPRINT81_90_PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - planning
  - sprints
  - v5.1
  - v5.2
  - v6.0
  - post-v5
  - native-mobile
  - marketplace
  - agentic
  - new-business
relates_to:
  - SPRINT71_80_PLAN
  - BACKLOG_MASTER
  - ROADMAP_FULL
  - COMPETITIVE_EPICS
  - MARKET_PULSE_INTEGRATION_2026-05-19
---

# Sprint 81–90 Plan — Post-v5.0 Platform Expansion Arc (3× Capacity)

_Created: 2026-06-01 (UTC). Agent-assisted synthesis: PO (lead), architect, backend, frontend, security, DevOps, tester, analytics, AI strategy, marketing, market research, i18n._

_Planning basis: [`SPRINT71_80_PLAN.md`](./SPRINT71_80_PLAN.md), [`ROADMAP_FULL.md`](../roadmap/ROADMAP_FULL.md), [`BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md), [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md) (10 new-business epics promoted to committed scope), [`MARKET_PULSE_INTEGRATION_2026-05-19.md`](../research/MARKET_PULSE_INTEGRATION_2026-05-19.md), [`SPRINT71_80_PLAN.md`](./SPRINT71_80_PLAN.md) §Out of scope (deferred S81+)._

---

## Why this arc exists

S71–S80 closed **v5.0 GA**: platform certification, SOC 2 Type II, realtime v3, edge copilot, audit API, CMK, FedRAMP **path** (docs only). The platform is now mature, certified, and scaled. S81–S90 is the **expansion arc** — it spends the certified platform's credibility on three moves the S71–S80 plan explicitly deferred to S81+:

1. **Reach** — native mobile store apps GA (Capacitor shell from ADR-0042 → store submission).
2. **Economy** — a paid marketplace with Stripe Connect payout, agent runtime GA, and revenue share.
3. **New buyers** — promote the [`COMPETITIVE_EPICS.md`](../strategy/COMPETITIVE_EPICS.md) ideation set (TOWNHALL, STAGE, RETRO, IDEATE, DELIBERATE, EMBED, CANVAS, CAPTIONS) from "proposed" into committed scope, opening internal-comms, events, agile-team, governance, and embed/developer buyers.

It closes on **v6.0 GA** — the first major version since v5.0, certified for gov cloud (full FedRAMP Moderate ATO path) and AAA accessibility.

---

## Capacity rule (3× reference arc)

| Rule | Value |
|------|--------|
| Reference sprint size (S30–S39) | **40–50 pts** per 2-week sprint |
| **S81–S90 capacity** | **120–150 pts** committed product/engineering per sprint (~3×) |
| Story size cap | ≤ 13 pts per story |
| QA budget | ~12–18 pts/sprint (~12% of capacity) |
| i18n budget | ~8–13 pts/sprint (parallel track) |
| DevOps budget | ~28–35 pts/sprint (from infra pool; see infra plan) |
| Marketing budget | ~10–16 pts/sprint (parallel track) |
| Security budget | ~12–18 pts/sprint (parallel track) |
| AI budget | ~17–24 pts/sprint (AI-441–AI-480) |

**Important:** [`SPRINT81_90_INFRA_PLAN.md`](./SPRINT81_90_INFRA_PLAN.md) commits the DevOps slice separately. Product tables below are **engineering + QA + security** slices; add infra/marketing/i18n from role plans for full sprint load.

---

## Bridge: S80 → S81

Sprint **80** closes **v5.0 GA** (platform certification, SOC 2 Type II closure, annual DR drill, AAA conformance audit, v4.x sunset notice). S81 assumes:

| Prerequisite | Evidence |
|--------------|----------|
| v5.0 GA shipped | [`v5.0.0.md`](../releases/v5.0.0.md), `GET /api/platform/version` → `5.0.0` |
| ADR-0034–0043 accepted | PWA shell, DO decomposition, MR write GA, marketplace exec, realtime v3, agent runtime, OTel v2, CMK, Capacitor shell, FedRAMP mapping |
| SCALE-PROOF-100K-01 | 100k load evidence current; refresh at S85 if marketing claims exceed |
| Pentest #3 closed | S72; **Pentest #4 opens S81** (mobile + marketplace surface) |
| Realtime v3 GA | `results_delta` wire format live; required when touching SessionRoom |
| FedRAMP path docs | Control mapping (ADR-0043) accepted; **full ATO begins S89** |

---

## Ten epics (E81–E90)

| Epic | Sprints | North star |
|------|---------|------------|
| **E81 — Native Mobile GA** | S81–S82 | iOS + Android store apps GA (Capacitor); offline-first voter shell; native push actions |
| **E82 — Marketplace Economy** | S82–S83 | Paid plugin/template listings + Stripe Connect payout + revenue share + partner billing |
| **E83 — Agentic Facilitation** | S83–S84 | AI agent runtime GA (AgentRunDO) + agent marketplace; autonomous facilitation (Workers AI only) |
| **E84 — Town Hall & Hybrid Events** | S84–S85 | TOWNHALL moderated anonymous Q&A at scale + STAGE hybrid-event engagement suite |
| **E85 — Continuous Collaboration** | S85–S86 | RETRO (agile retrospectives + team health) + IDEATE (brainstorm + prioritization) recurring workspaces |
| **E86 — Verifiable Governance** | S86–S87 | DELIBERATE: cryptographically-verifiable governance voting + receipts + audit-grade tally |
| **E87 — Embeddable Platform** | S87–S88 | EMBED: engagement SDK + public widget API + headless embed (highest TAM ceiling) |
| **E88 — Adaptive Experience & AAA** | S88–S89 | CANVAS (themes + adaptive dataviz) + CAPTIONS (live captions/translation, Workers AI) + WCAG AAA GA |
| **E89 — Gov Cloud & Full ATO** | S89 | FedRAMP Moderate full ATO path + sovereign tenant tier; SOC 2 Type II annual refresh |
| **E90 — Platform v6.0 Certification** | S90 | v6.0 GA; certification bundle; annual DR drill; SLA sign-off; v5.x sunset timeline |

**Moat alignment** (per `COMPETITIVE_EPICS.md`): every new-business epic reuses an existing Qesto moat — edge latency (TOWNHALL/STAGE scale), zero-knowledge privacy (DELIBERATE, TOWNHALL anonymity), native Workers AI (agentic, CAPTIONS), and the reusable question engine (RETRO, IDEATE, EMBED).

---

## Release map

| Release | Target close | Sprints | North star |
|---------|--------------|---------|------------|
| **v5.1** | S83 | S81–S83 | Native mobile GA, marketplace economy, agent runtime foundation |
| **v5.2** | S86 | S84–S86 | New-business suite (town hall, hybrid events, retro, ideate), agentic GA |
| **v6.0-rc** | S89 | S87–S89 | Embeddable SDK, verifiable governance, adaptive/AAA, gov cloud full ATO |
| **v6.0 GA** | S90 | S90 | Certification bundle, DR evidence, v5.x sunset timeline |

**Calendar anchor** (2-week sprints after S80 @ 2028-02-18):

| Sprint | Window (indicative) |
|--------|---------------------|
| S81 | 2028-02-18 → 2028-03-03 |
| S85 | 2028-04-14 → 2028-04-28 |
| S90 | 2028-06-23 → 2028-07-07 |

---

## ADR calendar (S81–S90)

| ADR | Title | Accept | Blocks |
|-----|-------|--------|--------|
| ADR-0044 | Native shell store submission + native push (Capacitor GA) | S81 | App store release, mobile push actions |
| ADR-0045 | Marketplace billing — Stripe Connect payout + revenue share + KYC | S82 | Paid listings, partner payout |
| ADR-0046 | AI agent runtime GA (AgentRunDO + Workflows) + agent sandbox | S83 | Agent marketplace, autonomous facilitation |
| ADR-0047 | Town-hall moderation queue DO + upvote scale | S84 | TOWNHALL @ 50k, hybrid-event Q&A |
| ADR-0048 | Recurring-workspace data model (RETRO/IDEATE persistence + history) | S85 | Team-health trends, recurring buyer GTM |
| ADR-0049 | Verifiable voting — cryptographic receipt + tally integrity | S86 | DELIBERATE governance tier |
| ADR-0050 | Embeddable SDK auth + widget origin sandboxing | S87 | EMBED public widget API, partner embeds |
| ADR-0051 | Live captions/translation pipeline (Workers AI ASR + MT, no third-party) | S88 | CAPTIONS GA |
| ADR-0052 | FedRAMP Moderate full ATO boundary + sovereign data plane | S89 | Gov GTM, sovereign tenant tier |
| ADR-0053 | v6.0 platform certification + v5.x deprecation policy | S90 | v6.0 GA ship |

**Forbidden:** ADR-0046 (agent runtime GA) and ADR-0049 (verifiable-voting crypto) must **not** land in the **same** sprint — both are high-risk net-new trust surfaces and split Pentest #4 / #5 scope. (Same discipline as the S71–S80 ADR-0035/0036 rule.)

---

## Cross-sprint gates

| Gate | Complete by | Blocks |
|------|-------------|--------|
| App store review accepted (iOS TestFlight + Play internal) | S82 | E81 GA, all "native app" marketing |
| Marketplace KYC + payout compliance (Stripe Connect) review | S83 | Paid listings going live, partner payout |
| Agent safety eval suite green (no unsafe autonomous action) | S84 | E83 agent marketplace public |
| TOWNHALL 50k moderation load evidence | S85 | TOWNHALL scale marketing |
| Pentest #4 critical/high = 0 (mobile + marketplace) | S83 | v5.1 RC |
| Verifiable-vote receipt independently re-tallyable | S87 | DELIBERATE governance GTM |
| Captions accuracy ≥ agreed WER bar (EN + top 4 locales) | S88 | CAPTIONS GA claim |
| FedRAMP 3PAO readiness assessment passed | S89 | v6.0 gov-cloud claim |
| WCAG AAA audit 0 violations on core flows | S89 | AAA GA claim |
| Pentest #5 (governance + embed + agent) critical/high = 0 | S89 | v6.0 RC |
| DR drill RTO ≤ 2h evidence | S89 (not S90) | v6.0 GA ship |
| `check:compliance-claims` green | Every sprint | Public copy |

---

## Sprint commitments (120–150 pts product engineering each)

Pts: **BE** · **FE** · **SEC** · **OPS** (product-facing) · **QA** · **AI** · **MKT** (non-eng)

### Sprint 81 — Native mobile beta + Pentest #4 open (≈138 pts)

**Goal:** Ship Capacitor iOS/Android beta to internal/TestFlight; native push; open Pentest #4 (mobile + marketplace surface).

| ID | Pts | Track |
|----|-----|-------|
| `NATIVE-SHELL-01`, `NATIVE-PUSH-01` (ADR-0044) | 26 | BE/FE |
| `FE-NATIVE-OFFLINE-01` (offline voter shell) | 13 | FE |
| `SEC-PEN4-01`, `SEC-PEN4-PREP-02` | 13 | SEC |
| `MARKETPLACE-BILLING-SPIKE-01` (ADR-0045 prep) | 8 | BE |
| `QA-NATIVE-DEVICE-MATRIX-01` | 13 | QA |
| `I18N-SPRINT81-01` (store listings 5 locales) | 10 | i18n |
| `MKTG-81-01`, `MKTG-81-02` (app launch teaser, ASO) | 14 | MKT |
| `AI-441`–`AI-444` (agent runtime schema) | 21 | AI |

**P0:** `NATIVE-SHELL-01`, `SEC-PEN4-01`, `AI-441`.

---

### Sprint 82 — Mobile GA + marketplace billing (≈143 pts)

**Goal:** iOS/Android store GA; Stripe Connect payout + paid listings foundation.

| ID | Pts | Track |
|----|-----|-------|
| `NATIVE-GA-01`, `FE-NATIVE-STORE-01` (store release) | 21 | BE/FE |
| `MARKETPLACE-CONNECT-01`, `MARKETPLACE-PAYOUT-01` (ADR-0045) | 34 | BE/SEC |
| `FE-MKTPL-LISTING-01` (paid listing UX) | 13 | FE |
| `SEC-PEN4-02`, `SEC-MKTPL-KYC-01` | 16 | SEC |
| `MKTG-82-01`, `MKTG-82-02` (partner program, vs Slido apps) | 16 | MKT |
| `AI-445`–`AI-448` | 21 | AI |

**P0:** `NATIVE-GA-01`, `MARKETPLACE-CONNECT-01`, `SEC-MKTPL-KYC-01`.

---

### Sprint 83 — v5.1 RC + agent runtime foundation (≈140 pts)

**Goal:** Paid listings live; agent runtime GA foundation; v5.1 RC gate.

| ID | Pts | Track |
|----|-----|-------|
| `MARKETPLACE-PAID-LISTING-01`, `RC-V51-01` | 26 | BE |
| `AGENT-RUNTIME-01` (AgentRunDO, ADR-0046) | 21 | BE/AI |
| `FE-MKTPL-REVENUE-01` (partner earnings dashboard) | 13 | FE |
| `SEC-PEN4-REM-01`, `SEC-AGENT-SANDBOX-01` | 16 | SEC |
| `CONTRACT-MARKETPLACE-PAYOUT-01` | 8 | QA |
| `MKTG-83-01`, `MKTG-83-02` (marketplace launch, case study) | 15 | MKT |
| `AI-449`–`AI-452` | 18 | AI |

**P0:** `RC-V51-01`, `AGENT-RUNTIME-01`, `MARKETPLACE-PAID-LISTING-01`.

---

### Sprint 84 — Town hall + agent marketplace (≈145 pts)

**Goal:** TOWNHALL moderated anonymous Q&A at scale; agent marketplace public; STAGE foundation.

| ID | Pts | Track |
|----|-----|-------|
| `TOWNHALL-QUEUE-01`, `TOWNHALL-MODERATE-01` (ADR-0047) | 29 | BE/FE |
| `AGENT-MARKETPLACE-01`, `AGENT-FACILITATE-01` | 26 | AI/BE |
| `STAGE-FOUNDATION-01` (hybrid-event surface) | 13 | FE |
| `SEC-AGENT-EVAL-01` (safety eval suite) | 13 | SEC |
| `QA-TOWNHALL-SCALE-01` | 13 | QA |
| `MKTG-84-01` (internal-comms ICP, town-hall page) | 14 | MKT |
| `AI-453`–`AI-456` | 17 | AI |

**P0:** `TOWNHALL-QUEUE-01`, `AGENT-MARKETPLACE-01`, `SEC-AGENT-EVAL-01`.

---

### Sprint 85 — Hybrid events + retro/ideate foundation (≈142 pts)

**Goal:** STAGE hybrid-event suite; RETRO + IDEATE recurring workspaces; town-hall 50k proof.

| ID | Pts | Track |
|----|-----|-------|
| `STAGE-SUITE-01`, `FE-STAGE-PRES-01` | 26 | FE/BE |
| `RETRO-WORKSPACE-01`, `IDEATE-BOARD-01` (ADR-0048) | 29 | BE/FE |
| `TOWNHALL-SCALE-PROOF-50K-01` | 13 | QA |
| `FE-RETRO-HEALTH-01` (team-health trends) | 13 | FE |
| `SEC-WORKSPACE-RBAC-01` | 8 | SEC |
| `MKTG-85-01` (agile-team ICP, retro page) | 14 | MKT |
| `AI-457`–`AI-460` (AI retro summarizer, idea clustering) | 22 | AI |

**P0:** `RETRO-WORKSPACE-01`, `STAGE-SUITE-01`, `TOWNHALL-SCALE-PROOF-50K-01`.

---

### Sprint 86 — v5.2 RC + verifiable voting foundation (≈138 pts)

**Goal:** Continuous-collaboration GA; DELIBERATE verifiable-voting foundation; v5.2 RC.

| ID | Pts | Track |
|----|-----|-------|
| `IDEATE-PRIORITIZE-01`, `RC-V52-01` | 26 | BE/FE |
| `DELIBERATE-RECEIPT-01` (crypto receipt, ADR-0049) | 21 | BE/SEC |
| `FE-DELIBERATE-VERIFY-01` (voter receipt UX) | 13 | FE |
| `AGENT-FACILITATE-GA-01` | 13 | AI |
| `SEC-VOTE-INTEGRITY-01` | 13 | SEC |
| `MKTG-86-01` (v5.1 launch pack, governance teaser) | 16 | MKT |

**P0:** `RC-V52-01`, `DELIBERATE-RECEIPT-01`, `SEC-VOTE-INTEGRITY-01`.

---

### Sprint 87 — Embeddable SDK + governance GA (≈140 pts)

**Goal:** EMBED engagement SDK + widget API; DELIBERATE governance GA; verifiable re-tally.

| ID | Pts | Track |
|----|-----|-------|
| `EMBED-SDK-01`, `EMBED-WIDGET-API-01` (ADR-0050) | 34 | BE/FE |
| `DELIBERATE-GA-01`, `DELIBERATE-RETALLY-01` | 21 | BE |
| `FE-EMBED-PLAYGROUND-01` (embed config console) | 13 | FE |
| `SEC-EMBED-ORIGIN-01`, `SEC-PEN5-PREP-01` | 16 | SEC |
| `CONTRACT-EMBED-SDK-01` | 8 | QA |
| `MKTG-87-01` (developer/embed ICP, `/embed` hub) | 14 | MKT |
| `AI-461`–`AI-464` | 18 | AI |

**P0:** `EMBED-SDK-01`, `DELIBERATE-GA-01`.

---

### Sprint 88 — Adaptive experience + captions (≈141 pts)

**Goal:** CANVAS themes + adaptive dataviz; CAPTIONS live translate (Workers AI); AAA path.

| ID | Pts | Track |
|----|-----|-------|
| `CANVAS-THEME-01`, `CANVAS-ADAPTIVE-VIZ-01` | 26 | FE |
| `CAPTIONS-PIPELINE-01` (ASR+MT, ADR-0051) | 21 | AI/BE |
| `FE-CAPTIONS-OVERLAY-01` | 13 | FE |
| `FE-AAA-GA-01` (WCAG AAA core flows) | 13 | FE |
| `SEC-PEN5-01` (governance + embed + agent) | 13 | SEC |
| `MKTG-88-01` (accessibility + multilingual story) | 14 | MKT |
| `AI-465`–`AI-470` (captions quality, theme intelligence) | 24 | AI |
| `I18N-CAPTIONS-01` (MT locale coverage) | 13 | i18n |

**P0:** `CAPTIONS-PIPELINE-01`, `CANVAS-ADAPTIVE-VIZ-01`, `FE-AAA-GA-01`.

---

### Sprint 89 — v6.0 RC + full ATO path (≈140 pts)

**Goal:** Gov-cloud full ATO path; sovereign tier; AAA GA; v6.0 RC; DR drill.

| ID | Pts | Track |
|----|-----|-------|
| `RC-V60-RC-01`, `SOVEREIGN-TIER-01` (ADR-0052) | 34 | BE |
| `FEDRAMP-ATO-FULL-01`, `COMPLIANCE-SOC2-ANNUAL-01` | 34 | SEC |
| `FE-AAA-AUDIT-FINAL-01`, `SEC-PEN5-REM-01` | 16 | FE/SEC |
| `CAPTIONS-GA-01` | 13 | AI |
| `API-PLAT-V6-AUDIT-01` | 13 | SEC |
| `MKTG-89-01` (v5.2 launch, gov GTM) | 16 | MKT |

**P0:** `RC-V60-RC-01`, `FEDRAMP-ATO-FULL-01`, `COMPLIANCE-SOC2-ANNUAL-01`.

---

### Sprint 90 — v6.0 GA (≈139 pts)

**Goal:** v6.0 GA; platform certification; annual DR drill; AAA conformance; v5.x sunset.

| ID | Pts | Track |
|----|-----|-------|
| `V60-GA-RELEASE-01`, `PLATFORM-CERTIFICATION-V6-01` (ADR-0053) | 29 | BE/SEC |
| `DR-DRILL-ANNUAL-V6-01`, `EDGE-DEPLOYMENT-AUDIT-V6-01` | 26 | OPS |
| `FE-AAA-FINAL-CONFORMANCE-01`, `QA-E2E-FULL-REGRESSION-V6-01` | 26 | FE/QA |
| `V5X-SUNSET-NOTICE-01` | 5 | BE |
| `MKTG-90-01` (v6 launch + YE metrics + v6→v7 teaser) | 15 | MKT |
| `AI-471`–`AI-480` (agent maturity closeout, L4) | 24 | AI |

**P0:** `V60-GA-RELEASE-01`, `PLATFORM-CERTIFICATION-V6-01`, `DR-DRILL-ANNUAL-V6-01`.

---

## New backlog items (agent consensus — add to BACKLOG_MASTER §S81–S90)

| ID | Pts | Pri | Sprint | Source |
|----|-----|-----|--------|--------|
| `NATIVE-SHELL-01` | 13 | P0 | S81 | Deferred S81+ (Capacitor GA) |
| `NATIVE-GA-01` | 13 | P0 | S82 | App store release |
| `MARKETPLACE-CONNECT-01` | 13 | P0 | S82 | Marketplace payout (Stripe Connect) |
| `MARKETPLACE-PAID-LISTING-01` | 13 | P0 | S83 | Deferred S81+ (paid listings) |
| `AGENT-RUNTIME-01` | 21 | P0 | S83 | ADR-0046 agent runtime GA |
| `AGENT-MARKETPLACE-01` | 21 | P0 | S84 | Deferred S81+ (agent marketplace) |
| `TOWNHALL-QUEUE-01` | 21 | P0 | S84 | COMPETITIVE_EPICS — TOWNHALL |
| `STAGE-SUITE-01` | 13 | P1 | S85 | COMPETITIVE_EPICS — STAGE |
| `RETRO-WORKSPACE-01` | 21 | P0 | S85 | COMPETITIVE_EPICS — RETRO |
| `IDEATE-BOARD-01` | 13 | P1 | S85–S86 | COMPETITIVE_EPICS — IDEATE |
| `DELIBERATE-RECEIPT-01` | 21 | P0 | S86 | COMPETITIVE_EPICS — DELIBERATE |
| `EMBED-SDK-01` | 21 | P0 | S87 | COMPETITIVE_EPICS — EMBED |
| `CANVAS-THEME-01` | 13 | P1 | S88 | COMPETITIVE_EPICS — CANVAS |
| `CAPTIONS-PIPELINE-01` | 21 | P1 | S88 | COMPETITIVE_EPICS — CAPTIONS |
| `FE-AAA-GA-01` | 13 | P0 | S88–S89 | WCAG AAA GA |
| `FEDRAMP-ATO-FULL-01` | 21 | P1 | S89 | Gov segment (full ATO path) |
| `SOVEREIGN-TIER-01` | 13 | P1 | S89 | Sovereign tenant tier |
| `PLATFORM-CERTIFICATION-V6-01` | 16 | P0 | S90 | v6.0 GA gate |
| `SEC-PEN4-01` | 13 | P0 | S81–S83 | Security track (mobile + marketplace) |
| `SEC-PEN5-01` | 13 | P0 | S87–S89 | Security track (governance + embed + agent) |
| `SEC-AGENT-EVAL-01` | 13 | P0 | S84 | Agent safety eval |

**AI stories AI-441–AI-480:** Groomed per-sprint above (agent runtime schema S81 → agent maturity L4 closeout S90).

---

## Market pulse tie-ins (re-run at S81 + S85)

| Signal | S81–S90 response |
|--------|------------------|
| Mobile-first engagement (Kahoot/Mentimeter app strength) | E81 Native Mobile GA, ASO MKTG-81/82 |
| Marketplace / ecosystem monetization (Miro/Notion app stores) | E82 Marketplace Economy, partner program |
| Agentic AI wave (autonomous facilitation) | E83 agent runtime + marketplace (Workers AI only) |
| Internal-comms / town halls (Slido, Vevox core) | E84 TOWNHALL — edge-scale + anonymity moat |
| Agile/retro buyers (Parabol, Retrium, EasyRetro) | E85 RETRO/IDEATE recurring workspaces |
| Governance/association voting (verifiable ballots) | E86 DELIBERATE — zero-knowledge + crypto receipt |
| Embed/developer TAM (Typeform/embed widgets) | E87 EMBED SDK + widget API |
| Accessibility + multilingual events | E88 CANVAS + CAPTIONS + AAA |
| Gov / public-sector sovereignty | E89 full FedRAMP ATO + sovereign tier |

---

## Audit & quality alignment

| Audit theme | S81–S90 mitigation |
|-------------|-------------------|
| `AUDIT-COVERAGE-01` (executable tests) | Contract + load + device-matrix suites each RC (S83, S86, S89, S90) |
| Staging WebSocket smoke | Mandatory for TOWNHALL queue DO (S84) and realtime-touching work |
| `check:compliance-claims` | All MKTG + native/marketplace/governance/AAA copy |
| WCAG AAA | GA at S88–S89 (`FE-AAA-*`); claim gated on S89 audit |
| Pentest cadence | #4 S81–S83 (mobile + marketplace); #5 S87–S89 (governance + embed + agent) |
| Agent safety | `SEC-AGENT-EVAL-01` gate before agent marketplace public (S84) |

---

## Role deep-dives (L2 packs)

| Role | Document |
|------|----------|
| DevOps / SRE | [`SPRINT81_90_INFRA_PLAN.md`](./SPRINT81_90_INFRA_PLAN.md) |
| Frontend | [`SPRINT81_90_FRONTEND_PROPOSAL.md`](./SPRINT81_90_FRONTEND_PROPOSAL.md) |
| Backend | [`SPRINT81_90_BACKEND_PROPOSAL.md`](./SPRINT81_90_BACKEND_PROPOSAL.md) |
| Architecture / ADRs | [`SPRINT81_90_ARCH_NOTES.md`](./SPRINT81_90_ARCH_NOTES.md) |
| QA | [`QA_COMMITMENT_SPRINTS_81_90.md`](../backlog/QA_COMMITMENT_SPRINTS_81_90.md) |
| Security | [`SPRINT81_90_SECURITY_PLAN.md`](./SPRINT81_90_SECURITY_PLAN.md) |
| Marketing | [`MARKETING_SPRINTS_81_90.md`](../marketing/MARKETING_SPRINTS_81_90.md) |
| i18n | [`I18N_SPRINT_81_90_PLAN.md`](../../I18N_SPRINT_81_90_PLAN.md) |
| AI | [`SPRINT81_90_AI_PLAN.md`](./SPRINT81_90_AI_PLAN.md) (AI-441–AI-480) |

---

## Out of scope (S81–S90)

OpenAI/Anthropic API (Workers AI only — hard rule), Stripe Connect **lending/credit** products, blockchain/on-chain voting (verifiable ≠ blockchain — crypto receipts only, ADR-0049), quantum crypto, full native AR/VR session mode, marketplace-built third-party **native** code execution outside the WfP sandbox — deferred S91+.

---

## PO sign-off checklist

- [ ] Confirm S80 v5.0 GA matches calendar before S81 kickoff
- [ ] Cap each sprint at **150 pts** in tracker; spill stretch to next sprint
- [ ] Re-run [`MARKET_PULSE_TO_BACKLOG_WORKFLOW.md`](../MARKET_PULSE_TO_BACKLOG_WORKFLOW.md) at **S81** and **S85**
- [ ] Architect signs ADR-0044 before S81 store build, ADR-0045 before S82 payout, ADR-0049 before S86 crypto receipt
- [ ] Legal/finance review Stripe Connect KYC + payout compliance before S83 paid listings go live
- [ ] Security confirms agent safety eval suite green before S84 agent marketplace public
- [ ] Legal reviews FedRAMP full-ATO 3PAO scope before S89
- [ ] Schedule annual DR drill week 2 of S89
- [ ] Promote `COMPETITIVE_EPICS.md` rows (TOWNHALL, STAGE, RETRO, IDEATE, DELIBERATE, EMBED, CANVAS, CAPTIONS) from "proposed" → committed in BACKLOG_MASTER
