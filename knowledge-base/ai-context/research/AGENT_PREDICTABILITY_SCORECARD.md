---
id: AGENT_PREDICTABILITY_SCORECARD
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - agents
  - release-train
  - metrics
  - predictability
relates_to:
  - RELEASE_TRAIN_MASTER
  - BACKLOG_ACTIVE
  - AGENT_SKILL_SCORECARD
---

# Agent Planning Predictability Scorecard

_Tracks whether release trains close on committed exit criteria — Phase 1 agent-system improvement target._

---

## North-star metric

**Predictability** = weighted % of committed trains that meet all P0 exit criteria by merge date on `main`.

| Phase | Target | Baseline (pre-RT) |
|-------|--------|-------------------|
| After RT-01 | ≥ 55 | 42 |
| After RT-02 | **≥ 65** | 42 |

### Formula

```
Predictability = (Σ train_score) / (committed_trains) × 100

train_score = 1.0   if all P0 exit criteria met at closeout
              0.5   if train merged but ≥1 P0 criterion waived with PO sign-off
              0.0   if train missed committed scope or slipped without re-baseline
```

P0 criteria source: [`BACKLOG_ACTIVE.md`](../../product/backlog/BACKLOG_ACTIVE.md) exit checklists per train.

---

## Supporting KPIs (monthly)

| KPI | Source | Green threshold |
|-----|--------|-----------------|
| CI green rate (last 10 `main` pushes) | GitHub Actions `ci.yml` | 100% |
| Stories without `BACKLOG_ACTIVE` row at merge | PR review / PO audit | 0 |
| Forward-dated active planning headers | KB grep / PO audit | 0 |
| Train capacity adherence (pts committed vs delivered) | `BACKLOG_ACTIVE` changelog | ±15% |

---

## Scorecard ledger

| Train | Committed close | Actual merge | P0 exit | train_score | Running predictability |
|-------|-----------------|--------------|---------|-------------|------------------------|
| RT-2026-06 (RT-01) | 2026-07-03 | _in progress_ | _open_ | — | **42** (baseline) |
| RT-2026-07 (RT-02) | 2026-07-17 | — | blocked on RT-01 | — | — |
| RT-2026-08 (RT-03) | conditional | — | EPIC-VALID | — | — |

_Update this table at each train closeout; knowledge agent owns the row._

---

## Escalation

| Predictability | Action |
|----------------|--------|
| < 50 | PO freezes new train commits; RT-01 stabilization only |
| 50–64 | RT-02 may proceed; RT-03 stays conditional |
| ≥ 65 | RT-03 promotion eligible after EPIC-VALID gates |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-19 | Baseline 42; RT-01/02/03 targets per [`RELEASE_TRAIN_MASTER.md`](../../product/planning/RELEASE_TRAIN_MASTER.md) |
