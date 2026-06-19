---
id: RELEASE_TRAIN_MASTER
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - planning
  - release-train
  - cadence
  - v7.1
  - xr
  - agent-governance
relates_to:
  - BACKLOG_ACTIVE
  - BACKLOG_MASTER
  - SPRINT85_99_PLAN
  - SPRINT91_99_STORIES
  - ADR-0054
  - ADR-0064-demand-evidence-adversarial-validation-gates
  - ROADMAP_FULL
---

# Qesto — Release Train Master Plan

_Created: 2026-06-19 (UTC). PO synthesis: Phase 1 agent-system improvement — stop sprint fiction; adopt release trains._

_Planning truth for agents: **committed work** lives in [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md). This file is the **cadence contract** and **horizon map**. Historical sprint closeouts (S85–S99) remain in [`../releases/`](../releases/) as evidence only._

---

## Why release trains replace sprint fiction

The S85–S99 arc shipped **v7.0.0 GA** (2026-06-19 engineering evidence). The forward-dated sprint calendar (S91–S99 windows in 2027–2028) was a **dependency-ordered teaching model**, not a live schedule. Continuing to plan as "Sprint N" with 120–150 pts and fictional calendar anchors created:

- **Over-commitment** — 130–194 pts/sprint assumed team capacity that does not exist for solo operator + AI agents.
- **Stale headers** — KB docs with future closeout dates that never matched `main` merge reality.
- **Agent confusion** — PO/backend/frontend agents treated sprint registries in `BACKLOG_MASTER.md` as open work.

Release trains fix this by binding planning to **merge dates on `main`**, one major outcome per train, and realistic solo+AI capacity.

---

## Cadence contract

| Old pattern | New pattern |
|-------------|-------------|
| Sprint N (9–10 working days) | **Release Train `RT-YYYY-MM`** (2–3 weeks, one major outcome) |
| 10 sprints / 5 days fiction | **1 train = 1 epic slice + ≤1 version bump** |
| 130–194 pts/sprint | **40–60 pts/train** (solo operator + AI agents, realistic) |
| Forward-dated KB headers | **Closeout date = last merge date on `main`** |
| `BACKLOG_MASTER` sprint registries | **`BACKLOG_ACTIVE` train tables** (PO promotes stories) |
| Sprint execution docs as planning | **Execution docs = evidence archive** after train close |

### Capacity rules (per train)

| Rule | Value |
|------|--------|
| Train length | **2–3 weeks** (10–15 working days) |
| Committed capacity | **40–60 product pts** (+ parallel SEC/QA/i18n as needed) |
| Story size cap | ≤ 13 pts per story |
| Version bumps | **≤1 minor or patch** per train; major GA requires prior RC train |
| Merge discipline | One story ID per PR where possible; `just check` green before merge |
| Horizon split | **Committed:** RT-01 + RT-02. **Conditional:** RT-03+ (EPIC-VALID gates) |

### Continuous gates (unchanged from ADR-0054)

- `npm run test:eval` on AI prompt/model/schema changes
- `check:compliance-claims` on public copy
- `npm test` + `tsc --noEmit` before merge
- Janurai proof lanes per [`agent/JANKURAI_STANDARD.md`](../../../agent/JANKURAI_STANDARD.md)

---

## Agent-system dashboard impact

Phase 1 targets measurable improvement in **planning predictability** — the agent scorecard dimension tracking whether committed trains actually close on stated exit criteria.

| Metric | Baseline (pre-RT) | RT-01 target | Post RT-02 target |
|--------|-------------------|--------------|-------------------|
| **Predictability** | 42 | 55+ | **65+** |
| CI green rate (last 10 `main` pushes) | intermittent | 100% | 100% |
| Stories promoted without `BACKLOG_ACTIVE` row | common | 0 | 0 |
| Forward-dated planning headers in active docs | several | 0 | 0 |

_Predictability formula (monthly):_ `(trains closed meeting exit criteria) / (trains committed)` × 100, weighted by P0 gate completion. Evidence: [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md) exit checklists + merge dates on `main`.

---

## Release map (post–v7.0 GA)

| Train ID | Calendar close | Version | North star | Status |
|----------|----------------|---------|------------|--------|
| **RT-2026-06** (RT-01) | merge on `main` by 2026-07-03 | — (stabilize) | CI truth + Janurai closure + S99 ops debt | **Active** |
| **RT-2026-07** (RT-02) | merge on `main` by 2026-07-17 | — (UX only) | P1 dashboard/UI debt from S93–S95 | Planned |
| **RT-2026-08** (RT-03) | merge on `main` by 2026-08-07 | **v7.1.0** *or* XR GA | Conditional horizon — EPIC-VALID must pass | **Conditional** |

---

## RT-01 — Stabilize (`RT-2026-06`)

**Goal:** Close S99 operational gaps, restore CI truth, and clear security/process debt before new features.

**Train capacity:** ~45 pts. **Do not start RT-02 until RT-01 P0 exit criteria are green.**

### Scope (remapped from S99 closeout + platform review)

| ID | Pts | Pri | Owner | Acceptance signal |
|----|----:|-----|-------|-------------------|
| `OPS-CI-RUNNER-01` | 5 | P0 | devops | GitHub `ci.yml` green on `main` push |
| `OPS-GIT-HOOKS-01` | 3 | P0 | devops | **Done** — `just hooks` + pre-push lanes verified |
| `SEC-JANURAI-REVERIFY-01` | 8 | P0 | security + tester | Janurai CRITICAL = 0 on `main`; closure doc in `knowledge-base/security/` |
| `VALID-ADR-0064-ACCEPT` | 3 | P0 | PO + architect | ADR-0064 → accepted; EPIC-VALID eligible for commit |
| `OPS-S99-CLOSEOUT-01` | 5 | P0 | devops + PO | Staging smoke `/api/platform/*`; AE error-rate documented |
| `OPS-DR-GAP-01` | 8 | P1 | devops + backend | KV export backup job spec + first run evidence |
| `OPS-DR-GAP-02` | 8 | P1 | devops + backend | R2 snapshot cadence + automated trigger |
| `MKTG-V70-GA-COPY-01` | 3 | P1 | marketing | GA copy approved; XR labeled beta-only |

### Exit criteria

- [ ] CI green rate 100% on last 10 `main` pushes
- [ ] Janurai CRITICAL = 0 open on `main`
- [ ] ADR-0064 accepted
- [ ] S99 DoD ops items closed — evidence in [`SPRINT99_EXECUTION.md`](../releases/SPRINT99_EXECUTION.md)

**Live status:** [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md) §RT-01.

---

## RT-02 — P1 UX debt / dashboards (`RT-2026-07`)

**Goal:** Ship the user-facing half of v7 backends deferred from S93–S97. **No new trust boundaries.**

**Precondition:** RT-01 P0 green.

**Train capacity:** ~50 pts.

### Scope (remapped from [`SPRINT85_99_PLAN.md`](./SPRINT85_99_PLAN.md) §S93 P1 + §S95 instructor UI)

| ID | Pts | Pri | Owner | Source sprint | Acceptance signal |
|----|----:|-----|-------|---------------|-------------------|
| `FE-PULSE-DASHBOARD-01` | 13 | P0 | frontend | S93 | HR dashboard: `GET /api/teams/:id/pulse/summary` + trends; k-anon masking |
| `FE-COPILOT-PANEL-01` | 13 | P0 | frontend | S93 | Live co-pilot side panel; approve/dismiss wired to existing API |
| `FE-LEARN-INSTRUCTOR-UI-01` | 13 | P0 | frontend | S95 | Instructor UI for `POST /api/learn/instructor/analytics` (backend shipped) |
| `PULSE-AI-NARRATION-01` | 8 | P1 | ai-engineer | S93 | Workers-AI trend narration; `npm run test:eval` green |
| `I18N-PULSE-COPILOT-01` | 3 | P1 | i18n | S93 | Dashboard/panel strings in 5 locales; `check:i18n` green |

### Exit criteria

- [ ] P0 UI stories demo-able end-to-end on staging
- [ ] No new ADR required (consumes existing PULSE/COPILOT/LEARN APIs)
- [ ] `just check` green before merge to `main`
- [ ] Predictability scorecard ≥ 65 (train closed on committed scope, no scope creep)

**Live status:** [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md) §RT-02.

---

## RT-03 — v7.1 or XR GA path (`RT-2026-08`) — **conditional**

**Goal:** One net-new epic slice toward v7.1 **or** XR beta → GA promotion. **Does not open until EPIC-VALID gates pass.**

**Precondition:** RT-02 exit green **and** all of:

| Gate | Owner | Evidence |
|------|-------|----------|
| ADR-0064 accepted | PO + architect | ADR status = accepted |
| Gate A — adversarial memo answered | market-research | `VALID-ADVERSARY-01` memo + PO response |
| Gate D — demand exit criteria defined | PO | Sean Ellis / effort proxy documented per epic |
| Gate H — path labeled committed | PO | This section promoted from conditional → committed in `BACKLOG_ACTIVE` |

### Path A — v7.1 platform slice (default if XR demand weakens)

Net-new work **not** in v7.0 GA scope. Candidate stories from deferred S91–S99 tail and platform review:

| ID | Pts | Pri | Notes |
|----|----:|-----|-------|
| `CONNECT-EXPAND-01` | 13 | P1 | Federation UI polish + multi-org admin flows (post-RT-02) |
| `STUDIO-POLISH-01` | 13 | P1 | Library UX, suggestion affordances, authoring edge cases |
| `REV-13` (Jankurai Phase 2 input validation) | 8 | P0 | Remaining boundary-cast remediation — if not closed in RT-01 |
| `PLATFORM-v71-RELEASE-01` | 5 | P0 | Version bump `7.1.0`; release notes; certification delta |

**Release:** `v7.1.0` at train close (patch/minor only — no new trust boundary without ADR).

### Path B — XR GA (only if demand gate holds)

Proceed only if **≥3 design partners with live beta usage** (not just LOI) per [`XR_00_DEMAND_VALIDATION.md`](./XR_00_DEMAND_VALIDATION.md) and EPIC-VALID Gate D.

| ID | Pts | Pri | Source | Notes |
|----|----:|-----|--------|-------|
| `XR-SPATIAL-01` | 13 | P1 | S98 | Production spatial rendering hardening |
| `XR-AVATAR-01` | 8 | P1 | S98 | Avatar scale + perf at GA thresholds |
| `FE-XR-LAUNCHER-GA-01` | 8 | P1 | S99 | Remove `beta-xr` default-off; GA entitlement gating |
| `XR-FALLBACK-GA-01` | 5 | P1 | S99 | 2D path certified for enterprise accessibility |
| `PLATFORM-XR-GA-01` | 5 | P0 | — | XR GA copy + certification field update |

**Kill criterion (unchanged):** If live usage <3 partners by RT-03 kickoff, **Path A only** — XR stays beta.

### Explicitly not in RT-03 without new ADR + EPIC-VALID

- Third-party AI APIs (Workers AI only)
- New federation trust boundaries beyond v7.0 CONNECT GA
- Full production AR/VR hardware certification
- Auto-promotion from `BACKLOG_MASTER` historical registries

---

## Remapping: S91–S99 tail → trains

The S91–S99 sprint tables in [`SPRINT85_99_PLAN.md`](./SPRINT85_99_PLAN.md) §S91–S99 are **superseded** for forward planning. Use this map:

| Original sprint slice | Disposition | New home |
|----------------------|-------------|----------|
| S91–S92 REACTIONS + COPILOT foundation | **Shipped** v6.1 / v7.0 | [`SPRINT92_EXECUTION.md`](../releases/SPRINT92_EXECUTION.md) |
| S93–S95 PULSE + LEARN + SOVEREIGN | **Shipped** backends; UI deferred | RT-02 (dashboards) |
| S95–S97 CONNECT + STUDIO | **Shipped** v7.0-rc / GA | [`SPRINT97_EXECUTION.md`](../releases/SPRINT97_EXECUTION.md) |
| S98 XR spike + soak | **Shipped** beta | [`SPRINT98_EXECUTION.md`](../releases/SPRINT98_EXECUTION.md) |
| S99 GA + certification | **Shipped** v7.0.0 | [`SPRINT99_EXECUTION.md`](../releases/SPRINT99_EXECUTION.md) |
| S99 ops/GTM gaps | **Open** | RT-01 |
| S93 P1 dashboards + S95 instructor UI | **Open** | RT-02 |
| XR GA / v7.1 net-new | **Conditional** | RT-03 (EPIC-VALID) |

Story-level detail for the shipped arc remains in [`SPRINT91_99_STORIES.md`](./SPRINT91_99_STORIES.md) as historical registry.

---

## Agent routing (per train)

| Step | Agent | Handoff artifact |
|------|-------|------------------|
| 1 | product-owner | Story ID + AC in `BACKLOG_ACTIVE.md` |
| 2 | architect | ADR only if trust boundary touched |
| 3 | frontend / backend / ai-engineer | PR + tests |
| 4 | tester | `npm test` + AC map |
| 5 | security | Auth/AI/federation path changes |
| 6 | knowledge | Update execution doc + train status; closeout date = merge date |

See [`.claude/skills/HANDOFFS.md`](../../../.claude/skills/HANDOFFS.md) edges E3–E9.

---

## Role deep-dives (unchanged references)

| Role | Document |
|------|----------|
| Architecture / ADRs | [`SPRINT85_99_ARCH_NOTES.md`](./SPRINT85_99_ARCH_NOTES.md) |
| Story registry (S91–S99 shipped) | [`SPRINT91_99_STORIES.md`](./SPRINT91_99_STORIES.md) |
| Market validation | [`MARKET_VALIDATION_S85_99.md`](../research/MARKET_VALIDATION_S85_99.md) |
| Demand gates | [`ADR-0064`](../../adr/ADR-0064-demand-evidence-adversarial-validation-gates.md) |
| Active committed work | [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md) |

---

## PO + Architect sign-off checklist

- [x] v7.0 GA exit criteria met (S99 engineering evidence 2026-06-19)
- [ ] RT-01 P0 exit criteria green before RT-02 kickoff (CI + S99 ops remain)
- [x] ADR-0064 accepted before RT-03 promotion
- [ ] Predictability scorecard ≥ 65 after RT-02 close — [`AGENT_PREDICTABILITY_SCORECARD.md`](../ai-context/research/AGENT_PREDICTABILITY_SCORECARD.md)
- [x] RT-03 path (A vs B) decision criteria in [`BACKLOG_ACTIVE.md`](../backlog/BACKLOG_ACTIVE.md)
- [x] `SPRINT85_99_PLAN.md` S91–S99 tail marked superseded

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-19 | Created — supersedes S91–S99 forward sprint fiction; RT-01/02/03 defined; predictability target 42→65+ |
| 2026-06-19 | Cadence propagated into the agent system: `.claude` agents/skills/hooks/settings, `CLAUDE.md` planning rule, roadmap + product README banners now operate on release trains and route to `BACKLOG_ACTIVE.md` instead of `SPRINT_PLAN_MASTER.md` |
