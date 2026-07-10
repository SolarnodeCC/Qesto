---
id: BACKLOG_ACTIVE
type: planning
domain: product
category: backlog
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - backlog
  - release-train
  - active-work
relates_to:
  - BACKLOG_MASTER
  - RELEASE_TRAIN_MASTER
  - AGENT_PREDICTABILITY_SCORECARD
  - ROADMAP_FULL
  - ADR-0064-demand-evidence-adversarial-validation-gates
  - SPRINT99_EXECUTION
---

# Qesto — Active Backlog (Release Trains)

_Hub: [Documentation map](./README.md)._

**Planning truth for agents:** Read **this file** for committed work. Cadence contract and horizon map: [`RELEASE_TRAIN_MASTER.md`](../planning/RELEASE_TRAIN_MASTER.md). [`BACKLOG_MASTER.md`](./BACKLOG_MASTER.md) is the historical archive + regression contract; do not treat its sprint registries as open work.

**Cadence:** 2-week **release trains** (`RT-YYYY-MM`; solo operator + AI agents). Target **40–60 product pts** per train. Closeout date = merge date on `main`. One merge = one story ID where possible ([`CLAUDE.md`](../../../CLAUDE.md) hooks + quality gates).

**Current GA:** `7.0.0` (S99). Horizon: v7.1 after RT-01 + RT-02.

---

## RT-01 — Stabilize (`RT-2026-06`; target close 2026-07-03)

**Goal:** Close S99 operational gaps, restore CI truth, and clear security/process debt before new features.

**Train capacity:** ~45 pts (product + ops). **Do not start RT-02 until RT-01 P0 exit criteria are green.**

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `OPS-CI-RUNNER-01` | 5 | P0 | devops | **Blocked (billing)** | GitHub billing fix required; local gates green + connect-scale flake fixed — [`CI_RUNNER_STATUS_2026_06_19.md`](../../operations/CI_RUNNER_STATUS_2026_06_19.md) |
| `OPS-GIT-HOOKS-01` | 3 | P0 | devops | **Done** | `just hooks` installs `core.hooksPath`; pre-push lanes verified (`scripts/test-pre-push-hook.sh`) |
| `SEC-JANURAI-REVERIFY-01` | 8 | P0 | security + tester | **Done** | [`JANURAI_REVERIFY_2026_06_19.md`](../../security/JANURAI_REVERIFY_2026_06_19.md) — CRITICAL-5 re-tested; 4 closed, SAML dual-gate |
| `VALID-ADR-0064-ACCEPT` | 3 | P0 | PO + architect | **Done** | ADR-0064 accepted 2026-06-19; EPIC-VALID eligible for train commit |
| `OPS-DR-GAP-01` | 8 | P1 | devops + backend | **Done (code)** | [`DR_KV_EXPORT_BACKUP.md`](../../operations/DR_KV_EXPORT_BACKUP.md) + weekly Worker cron; prod first-run pending |
| `OPS-DR-GAP-02` | 8 | P1 | devops + backend | **Done** | [`DR_SNAPSHOT_CADENCE.md`](../../operations/DR_SNAPSHOT_CADENCE.md) — 30s DO alarm → R2 |
| `OPS-S99-CLOSEOUT-01` | 5 | P0 | devops + PO | **Done (automation)** | [`OPS_S99_CLOSEOUT_EVIDENCE.md`](../../operations/OPS_S99_CLOSEOUT_EVIDENCE.md) + `scripts/smoke-platform-v7.mjs` in CI; AE table pending operator |
| `MKTG-V70-GA-COPY-01` | 3 | P1 | marketing | **Draft** | [`MKTG_V70_GA_ANNOUNCEMENT.md`](../../marketing/MKTG_V70_GA_ANNOUNCEMENT.md) — PO sign-off before publish |

### RT-01 exit criteria

- [ ] CI green rate 100% on last 10 `main` pushes _(blocked: GitHub billing — [`CI_RUNNER_STATUS_2026_06_19.md`](../../operations/CI_RUNNER_STATUS_2026_06_19.md))_
- [x] Janurai CRITICAL exploitable = 0 on default prod — [`JANURAI_REVERIFY_2026_06_19.md`](../../security/JANURAI_REVERIFY_2026_06_19.md)
- [x] ADR-0064 accepted
- [ ] S99 DoD ops items (#18–22) closed in [`SPRINT99_EXECUTION.md`](../releases/SPRINT99_EXECUTION.md) _(automation + docs ✅; AE operator row + XR device lab optional)_

---

### RT-01 addendum — Architecture hardening (REFACTORING_AUDIT)

**Goal:** Convert the audit's High findings into CI ratchets so debt can only shrink. Rails + first
fix land in RT-01; burn-down is funded across RT-02→RT-03. Refs:
[`REFACTORING_AUDIT.md`](../../../REFACTORING_AUDIT.md), [`REMEDIATION_PLAN.md`](../../../REMEDIATION_PLAN.md),
ADR-0068/0069/0070.

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `ARCH-RATCHET-01` | 5 | P0 | architect + backend | **Done** | 3 ratchet gates (`check-ai-gateway`/`check-d1-access`/`check-error-response`) wired into `quality-gates.sh` + `check:rc`; `errorResponse()` + `runAI()` added; `sovereign.ts` migrated (error baseline 610→603); ADR-0068/0069/0070 accepted |
| `ARCH-ERROR-BUILDER-MIGRATE-01` | 8 | P1 | backend | In progress | 124 sites migrated to `errorResponse()` (sovereign + 117-site codemod across 23 files); `check-error-response` 610→480. Tricky sites (variable msg, `denyFeature()`, `details`) remain |
| `ARCH-MEDIUM-CLEANUP-01` | 5 | P1 | backend | **Done** | Vectorize dedup (`lib/ai/embed-query.ts`), Env-narrowing (integrations/billing → `Pick<Env,…>`), dual-auth consolidation (`lib/authz-helpers.ts`), `lib/stripe-client.ts` extracted from billing |
| `ARCH-AI-GATEWAY-MIGRATE-01` | 8 | P1 | ai-engineer | Open | Raw `AI.run` sites routed through `runAI`; `check-ai-gateway` baseline lowered; `npm run test:eval` green (REV-10) per batch |
| `ARCH-REPO-LAYER-01` | 13 | P1 | backend + architect | In progress | First slice done: `lifecycle.ts` (724→663) → `sessionLifecycleRepository`/`sessionLifecycleService`. Remaining: `billing.ts`, `integrations.ts` extracted; `check-d1-access` baseline lowered |

---

## RT-02 — P1 UX debt / dashboards (`RT-2026-07`; target close 2026-07-17)

**Goal:** Ship the user-facing half of v7 backends deferred from S93–S95. **No new trust boundaries.**

**Precondition:** RT-01 P0 green.

| ID | Pts | Pri | Owner agent | Status | Acceptance signal |
|----|----:|-----|-------------|--------|-------------------|
| `FE-PULSE-DASHBOARD-01` | 13 | P0 | frontend | Open | HR dashboard consumes `GET /api/teams/:id/pulse/summary` + trends; k-anon masking visible |
| `FE-COPILOT-PANEL-01` | 13 | P0 | frontend | Open | Live session co-pilot side panel; plan approve/dismiss wired to existing API |
| `FE-LEARN-INSTRUCTOR-UI-01` | 13 | P0 | frontend | Open | Instructor screen for `POST /api/learn/instructor/analytics` (backend shipped S95) |
| `PULSE-AI-NARRATION-01` | 8 | P1 | ai-engineer | Conditional | Workers-AI trend narration; `npm run test:eval` green (REV-10) |
| `I18N-PULSE-COPILOT-01` | 3 | P1 | i18n | Open | New dashboard/panel strings in 5 locales; `check:i18n` green |

### RT-02 exit criteria

- [ ] P0 UI stories demo-able end-to-end on staging
- [ ] No new ADR required (consumes existing PULSE/COPILOT/LEARN APIs)
- [ ] `just check` green before merge to `main`
- [ ] Predictability ≥ 65 per [`AGENT_PREDICTABILITY_SCORECARD.md`](../../ai-context/research/AGENT_PREDICTABILITY_SCORECARD.md)

---

## Energizer security boundary — consolidated (audit E-1/E-2, closed)

**Source:** [`CORE_FEATURES_AUDIT_2026-07-09.md`](../audits/CORE_FEATURES_AUDIT_2026-07-09.md) — 2 CRITICAL findings. Consolidation approved by PO 2026-07-10 ("fix these issues now"); implemented in PR #715.

| ID | Pri | Finding | Resolution | Status |
|----|----|---------|------------|--------|
| `ARCH-ENERGIZER-E1-REST` | CRIT | `GET /energizers/active` returned raw `correct_index` to any authenticated user (no access check); team-quiz REST vote echoed `correct` immediately with re-answer allowed | `GET /active` is now **host-only** (`requireSessionAccess requireOwner`); team-quiz vote stores correctness but never echoes it and rejects re-answers (409, mirrors the WS duplicate rule) | **Done (PR #715)** |
| `ARCH-ENERGIZER-E2-ISOLATION` | CRIT | REST energizer plane 401'd for anonymous participants; REST/D1 vs WS/DO results never reconciled | **DO WebSocket is the single participant-facing plane.** Host REST lifecycle (PATCH activate, `/next`) syncs into the DO (`/energizer-sync`); DO gained emoji_poll/word_cloud answers with an aggregate `optionCounts` read model; JoinPage dropped REST polling for WS-only panels (all 4 lobby kinds); host monitoring reads live results from the DO (`/energizer-state`) with D1 fallback; DO completions mirror back to D1 | **Done (PR #715)** |

**Architecture note:** the host lobby (Launchpad) stays on the authenticated REST plane for draft/edit/activate/monitor; participants — anonymous included — are WS-only. D1 remains config/lifecycle truth; the DO is the live-answer store.

---

## RT-03 — v7.1 or XR GA (`RT-2026-08`) — **conditional**

**Goal:** One net-new epic slice — **Path A (v7.1 platform)** or **Path B (XR GA)**. Does not open until RT-02 exits and EPIC-VALID gates pass.

**Precondition:** RT-02 P0 green **and** Gates A + D + H from ADR-0064.

### Path decision (PO signs at RT-02 closeout)

Evaluate **all** criteria at RT-03 kickoff. Path B requires **every** B-row to pass; otherwise **Path A only**.

| Criterion | Path A (v7.1 default) | Path B (XR GA) |
|-----------|----------------------|----------------|
| **Live design-partner usage** | N/A | ≥3 partners with **completed beta sessions** (not LOI alone) per [`XR_00_DEMAND_VALIDATION.md`](../planning/XR_00_DEMAND_VALIDATION.md) |
| **Sean Ellis / demand proxy (Gate D)** | Documented for CONNECT/STUDIO polish scope | ≥40% "very disappointed" proxy from partner interviews |
| **Adversarial memo (Gate A)** | `VALID-ADVERSARY-01` answered for v7.1 slice | Separate memo: strongest case XR fails / competitor wins immersive |
| **Engineering risk** | No new trust boundary | XR stays feature-flagged; no new DO protocol changes |
| **Capacity** | ~50 pts fits CONNECT/STUDIO polish + `7.1.0` bump | ~39 pts XR hardening only |

**Decision rule:** If any Path B row fails → commit Path A stories and tag `RT-2026-08-A`. If all pass → Path B and tag `RT-2026-08-B`. PO records decision + date in changelog.

### Path A — v7.1 platform slice (default)

| ID | Pts | Pri | Owner | Acceptance signal |
|----|----:|-----|-------|-------------------|
| `CONNECT-EXPAND-01` | 13 | P1 | frontend | Federation admin flows polish on shipped CONNECT GA APIs |
| `STUDIO-POLISH-01` | 13 | P1 | frontend | Library/suggestion UX edge cases on shipped STUDIO APIs |
| `PLATFORM-v71-RELEASE-01` | 5 | P0 | devops + PO | `7.1.0` release notes + certification delta |

### Path B — XR GA (demand-gated)

| ID | Pts | Pri | Owner | Acceptance signal |
|----|----:|-----|-------|-------------------|
| `XR-SPATIAL-GA-01` | 13 | P1 | frontend | Spatial rendering meets GA perf thresholds |
| `XR-AVATAR-GA-01` | 8 | P1 | frontend | Avatar scale + perf at GA thresholds |
| `FE-XR-LAUNCHER-GA-01` | 8 | P1 | frontend | `beta-xr` default-on for entitled plans |
| `PLATFORM-XR-GA-01` | 5 | P0 | PO + marketing | GA copy; XR no longer labeled beta-only |

### RT-03 exit criteria

- [ ] Path A or B chosen with PO sign-off in changelog
- [ ] Gate A adversarial memo on file and answered
- [ ] ≤1 version bump (`7.1.0` Path A)
- [ ] Predictability ≥ 65 maintained

**Status:** Not committed — promote rows when RT-02 closes.

---

## Explicitly not in active scope

| Item | Reason | Promote when |
|------|--------|--------------|
| XR GA (`FE-XR-LAUNCHER` polish, WebGL engine) | Beta only; Path B in RT-03 | RT-02 close + Path B decision table green |
| CONNECT expansion | RT-03 Path A default | RT-02 complete + VALID-ADVERSARY-01 |
| v7.1 epic net-new | Conditional RT-03 | PO path decision at RT-02 closeout |
| Full `BACKLOG_MASTER` historical registries | Delivered / archive | Never auto-promote without PO |

---

## Agent routing (per train)

| Step | Agent | Handoff artifact |
|------|-------|------------------|
| 1 | product-owner | Story ID + AC in this file |
| 2 | architect | ADR only if trust boundary touched (none in RT-02) |
| 3 | frontend / backend / ai-engineer | PR + tests |
| 4 | tester | `npm test` + AC map |
| 5 | security | If auth/AI/federation path touched |
| 6 | knowledge | Update execution doc + this file status |

See [`.claude/skills/HANDOFFS.md`](../../../.claude/skills/HANDOFFS.md) edges E3–E9.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-19 | Created RT-01 (stabilize) + RT-02 (UX value loop) post S99 audit; `OPS-GIT-HOOKS-01` marked done |
| 2026-06-19 | OPS-S99 closeout: platform smoke in CI, AE runbook, deploy rollback, marketing draft; connect-scale test de-flaked |
| 2026-06-19 | Agent-system aligned to release-train cadence — PO agent/skill, HANDOFFS (E3/E20), architect/cso/release-notes/ai-strategy/marketing/i18n skills, `.claude` hooks + settings + context-preservation now reference trains and point at this file (not the deprecated `SPRINT_PLAN_MASTER.md`) |
