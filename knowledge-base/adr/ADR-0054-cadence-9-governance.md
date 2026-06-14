---
id: ADR-0054
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, product-owner, devops
relates_to: ADR-0053, SPRINT85_99_PLAN, SPRINT85_99_ARCH_NOTES, BACKLOG_MASTER
---

# ADR-0054: v6.x Post-GA Stabilization & Cadence-9 Governance

## Status

Accepted (S91). Process backbone for the S91–S99 net-new arc toward v7.0 GA.

## Context

S90 shipped **v6.0.0 GA** (ADR-0053). The product arc re-bases onto a **9-working-day**
sprint cadence while retaining **120–150 pts/sprint** committed capacity. The compression
lands on serial windows (RC soak, pentest remediation, DO soak) unless governance rules
absorb it explicitly.

S91 opens the v6.x→v7.0 horizon with net-new feature work (REACTIONS, PULSE). This ADR
ratifies the process rules that every subsequent sprint in the arc must follow.

## Decision

### 1. Nine-day sprint cadence (retained capacity)

| Rule | Value |
|------|--------|
| Sprint length | **9 working days** |
| Committed capacity | **120–150 pts** product/engineering per sprint |
| Story size cap | ≤ 13 pts per story |
| QA / security / i18n / AI | Parallel tracks (~20–30% overhead), budgeted in role plans |

### 2. Two-sprint RC for every major release

| Major | RC cut | GA |
|-------|--------|-----|
| v6.1 | S93 | S92 (REACTIONS GA) / partial COPILOT |
| v6.2 | — | S95 |
| v7.0 | S97 | S99 |

No major GA ships from a single sprint without a prior `-rc` soak sprint when the release
introduces a new trust boundary or scale claim.

### 3. Continuous per-PR gates (not end-of-sprint-only)

These gates run on every PR touching the relevant surface:

- `npm run test:eval` — AI prompt/model/schema changes
- `check:compliance-claims` — public copy and certification fields
- Realtime/DO protocol smoke — any PR touching `SessionRoom` or reaction/copilot surfaces
- Tenant isolation contract tests — aggregation/egress/federation routes

### 4. v6.x hotfix / backport lane

- **Patch** releases (`6.0.x`) may ship between sprint boundaries for P0 production fixes.
- **Minor** releases (`6.x.0`) align to sprint close milestones only.
- v5.x maintenance continues per ADR-0053 until `2028-12-31`; no v5.x feature backports.

### 5. Pentest cadence

- **Pentest #6** (agent L2/L3 + analytics aggregation + federation) opens S94 prep, runs
  S95–S96, must close crit/high = 0 before v7.0-rc (S97).

## Consequences

- S91–S99 planning docs (`SPRINT85_99_PLAN.md`, `SPRINT91_99_STORIES.md`) are the
  authoritative story registry; sprint closeouts (`SPRINT91_EXECUTION.md`, …) record evidence.
- ADR acceptance at sprint kickoff is mandatory before P0 implementation on governed surfaces.
- Capacity-forcing cuts: XR beta first, then REACTIONS stretch; keep PULSE/COPILOT spine.

## References

- [`SPRINT85_99_ARCH_NOTES.md`](../product/planning/SPRINT85_99_ARCH_NOTES.md) §1–2
- [`SPRINT90_EXECUTION.md`](../product/releases/SPRINT90_EXECUTION.md) — v6.0 GA baseline
