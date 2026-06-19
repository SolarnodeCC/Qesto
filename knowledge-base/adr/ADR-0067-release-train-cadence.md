---
id: ADR-0067
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, product-owner, devops
relates_to: ADR-0054, ADR-0064, RELEASE_TRAIN_MASTER, BACKLOG_ACTIVE, BACKLOG_MASTER, ROADMAP_FULL, SPRINT_PLAN_MASTER
supersedes: ADR-0054 (cadence/capacity sections only)
---

# ADR-0067: Release-Train Cadence (Replacing Sprint-Based Planning)

## Status

Accepted (2026-06-19, RT-01). Foundational governance ADR. **Supersedes the cadence and
capacity sections of [`ADR-0054`](./ADR-0054-cadence-9-governance.md)** (nine-day sprint
cadence, 120–150 pts/sprint). Establishes the **release train** as Qesto's unit of forward
planning. The cadence contract lives in
[`RELEASE_TRAIN_MASTER.md`](../product/planning/RELEASE_TRAIN_MASTER.md); committed work in
[`BACKLOG_ACTIVE.md`](../product/backlog/BACKLOG_ACTIVE.md). No code or schema change.

## Context

Qesto's S85–S99 arc shipped **v7.0.0 GA**. The forward-dated "Sprint N" calendar that ADR-0054
ratified (nine working days, **120–150 pts/sprint**) assumed a team capacity that does not exist
for a **solo operator + AI agents**, and the forward sprint windows (S91–S99 dated into 2027–2028)
were a dependency-ordered teaching model, not a live schedule. Continuing to plan as "sprints"
produced three recurring failures, documented in `RELEASE_TRAIN_MASTER.md`:

- **Over-commitment** — 130–194 pt sprint targets that never matched real throughput.
- **Stale headers** — KB docs with future closeout dates that never matched `main` merge reality.
- **Agent confusion** — PO / backend / frontend agents treated `BACKLOG_MASTER.md` sprint
  registries as open work.

ADR-0054 remains the historical decision record for the S91–S99 arc, but its cadence/capacity
rules are no longer the operating model. The decision log needs an explicit successor so that the
formal architecture record matches the live planning truth in `RELEASE_TRAIN_MASTER.md` and
`BACKLOG_ACTIVE.md`, and so the L1–L4 agent system (CLAUDE.md, skills, agents) has an ADR to anchor
on.

## Decision

### 1. Release trains replace sprints as the unit of forward planning

| Rule | Value |
|------|--------|
| Planning unit | **Release Train `RT-YYYY-MM`** — 2–3 weeks (10–15 working days), one major outcome |
| Committed capacity | **40–60 product pts per train** (solo operator + AI agents) |
| Story size cap | ≤ 13 pts per story (split anything larger) |
| Version bumps | **≤ 1** minor or patch per train; a major GA requires a prior RC train |
| Closeout date | **Last merge date on `main`** — no forward-dated headers |
| Commitment signal | A story is committed only when it has a **row in `BACKLOG_ACTIVE.md`** |
| Horizon | **Committed:** current + next train. **Conditional:** everything further out, behind EPIC-VALID gates ([`ADR-0064`](./ADR-0064-demand-evidence-adversarial-validation-gates.md)) |
| Merge discipline | One story ID per PR where possible; `just check` green before merge |

`BACKLOG_MASTER.md` is the **historical archive + regression contract**; its sprint registries are
never auto-promoted. The five-sprint arc in `SPRINT_PLAN_MASTER.md` is **pedagogical only**.

### 2. Predictability replaces velocity as the cadence health metric

`Predictability = (trains closed meeting exit criteria) / (trains committed) × 100`, weighted by P0
gate completion. Evidence: `BACKLOG_ACTIVE.md` exit checklists + merge dates on `main`. Target
**≥ 65** (baseline 42 pre-RT). Sprint-velocity variance is retired.

### 3. Retained from ADR-0054 (cadence-independent — still in force)

- **Per-PR continuous gates:** `npm run test:eval` (AI prompt/model/schema), `check:compliance-claims`
  (public copy/certification), realtime/DO protocol smoke, tenant-isolation contract tests, plus
  `npm test` + `tsc --noEmit` before merge.
- **RC-before-major-GA:** no major GA ships without a prior `-rc` train when it introduces a new
  trust boundary or scale claim.
- **Hotfix / backport lane:** patch releases may ship between train boundaries for P0 production
  fixes; minor releases align to train close.

### 4. Agent-system binding

The L1–L4 agent system plans against this ADR: `CLAUDE.md` (release-train planning rule), the
product-owner agent/skill, `HANDOFFS.md` (E3 promotion, E20 train close), and the `.claude` hooks
all route to `BACKLOG_ACTIVE.md` + `RELEASE_TRAIN_MASTER.md` rather than `SPRINT_PLAN_MASTER.md`.

## Consequences

- `ADR-0054` cadence/capacity sections are **superseded**; its body remains as historical record of
  the S91–S99 arc. ADR-0054's continuous gates, RC-before-GA, and hotfix-lane rules persist via §3.
- Forward planning reads `RELEASE_TRAIN_MASTER.md` (contract/horizon) and `BACKLOG_ACTIVE.md`
  (committed work). Historical sprint execution/plan docs remain evidence only.
- Capacity targets drop from 120–150 pts to 40–60 pts/train; planning docs must not cite the old
  sprint figures as live.
- EPIC-VALID (ADR-0064) governs the conditional horizon: RT-03+ stays conditional until its gates
  pass.

## Alternatives considered

- **Keep ADR-0054 and edit it in place.** Rejected: it is the authoritative record for the S91–S99
  arc; superseding via a new ADR preserves that history while making the cadence change explicit.
- **No ADR; rely on `RELEASE_TRAIN_MASTER.md` alone.** Rejected: the architecture decision log would
  still formally ratify sprints, contradicting the live model and leaving agents without an anchor.
