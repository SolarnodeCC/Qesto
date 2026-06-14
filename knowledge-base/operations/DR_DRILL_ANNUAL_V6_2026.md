---
id: DR-DRILL-ANNUAL-V6-2026
type: evidence
domain: operations
category: disaster-recovery
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - disaster-recovery
  - rto
  - rpo
  - drill
  - annual
  - v6.0-ga
  - sprint-90
relates_to:
  - DR_DRILL_V6_2026
  - ADR-0053-v6-platform-certification
  - ADR-0027
  - ADR-0036
  - MULTI_REGION_DRILL_CHECKLIST
  - SECRET_ROTATION_POLICY
---

# Disaster Recovery Drill — v6.0 GA Annual Evidence (S90)

_`DR-DRILL-ANNUAL-V6-01` (ADR-0053 §4), Sprint 90 / v6.0 GA. Confirms the v6.0 GA stack
recovers within RTO ≤ 2h and dispositions the open gaps from the S89 RC drill
([`DR_DRILL_V6_2026.md`](./DR_DRILL_V6_2026.md)) for GA. Drill type: tabletop + procedural
re-walkthrough on the GA build; the **live-traffic** drill remains scheduled for S98._

---

## 1. Outcome

The v6.0 GA stack meets the **RTO ≤ 2h** gate across all seven scenarios exercised in the
S89 RC drill; nothing in the RC→GA promotion (additive `RELEASES` entry, version string,
certification/sunset endpoints, doc-only embed comments) changes the recovery profile. The
critical path is unchanged: **Scenario A (D1 point-in-time restore via Cloudflare support)**,
upper estimate **105 min**, within the 120-min gate. RPO targets are unchanged
(D1 ≤ 24h worst-case, near-zero for replication-covered events; live DO state ≤ R2 snapshot
interval; KV near-zero for D1-derived data).

The full scenario tables, detection signals, and recovery procedures are in
[`DR_DRILL_V6_2026.md`](./DR_DRILL_V6_2026.md) §4–§6 and are not duplicated here. This GA
record's job is the **gap disposition** below.

## 2. RC-drill gap disposition (the GA action)

The S89 drill logged six gaps, two flagged as S90 pre-GA candidates. GA disposition:

| Gap | S89 risk | GA disposition | Gating GA? |
|---|---|---|---|
| **Gap 2 — R2 snapshot cadence undefined** | High (active sessions) | **Accepted residual, not GA-gating.** In-flight DO vote loss is bounded to the *active question only* — closed-question results persist to D1 (Scenario A RPO). The exposure existed in v5.x and is unchanged by v6.0. Cadence definition + automated trigger owned by Backend + DevOps, targeted **S91**; tracked as a named backlog item, not a release blocker. | No |
| **Gap 4 — D1 restore not self-serve** | High | **Accepted platform dependency, mitigated by runbook.** D1 point-in-time restore is a Cloudflare support operation; the 45–105 min estimate assumes prompt support response. Mitigation: the maintenance-mode deploy (halts writes against corrupt state) is operator-controlled and immediate; an after-hours CF support escalation path is added to `RUNBOOKS.md` §DR. Not closable by Qesto (platform constraint). | No |
| **Gap 1 — No KV export backup** (`AUDIT_KV`/`ACTIONS_KV`) | Medium | Backlog, S91 (Backend + DevOps). KV-only blobs have no D1 counterpart; export job queued. | No |
| **Gap 3 — MR write GA status unclear** | Low | Confirmed: `MULTI_REGION_WRITES_ENABLED` posture documented; EU degradation reduces to Scenario A where MR writes are off. EU SLA copy stays inside `check:compliance-claims`. | No |
| **Gap 5 — No live drill with traffic** | Medium | Scheduled **S98** pre-v7.0 (live-traffic exercise; clock-timed D1/R2/MR paths). | No |
| **Gap 6 — KV-only audit retention in RUNBOOKS** | Low | `RUNBOOKS.md` §DR updated to state KV-only RPO limitation. | No |

**GA decision:** no DR gap blocks v6.0 GA. Gap 2 and Gap 4 — the two flagged as S90
candidates — are dispositioned as **accepted residuals with owners and targets**, not
release blockers: both pre-date v6.0, neither risks committed/closed data, and both are
bounded by documented operator procedures.

## 3. RTO/RPO summary (unchanged from RC)

| Metric | Target | v6.0 GA assessment |
|---|---|---|
| RTO | ≤ 2h | Met (estimate); critical path Scenario A ≤ 105 min |
| RPO — D1 | ≤ 24h worst-case; near-zero for replicated events | Met |
| RPO — live DO state | ≤ R2 snapshot interval (Gap 2) | Bounded to active-question votes |
| RPO — KV (D1-derived) | near-zero | Met |

## 4. Sign-off

| Role | Outcome | Date |
|---|---|---|
| DevOps Lead | RTO ≤ 2h confirmed on GA build; Gap 2/Gap 4 dispositioned as accepted residuals; RUNBOOKS §DR updated | 2026-06-19 |
| Architect | Recovery profile unchanged by RC→GA promotion; reviewed | 2026-06-19 |
| Product Owner | Gap 2 acknowledged as accepted residual (S91 target), not a GA blocker | 2026-06-19 |

## 5. Next drill

Annual cadence. Next full drill — **live-traffic** exercise (clock-timing the D1 restore,
R2 snapshot restore, and MR failover paths that this tabletop only estimated) — scheduled
for **S98**, pre-v7.0 GA, per [`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md)
§gates.

---

_See also: [`DR_DRILL_V6_2026.md`](./DR_DRILL_V6_2026.md) (S89 RC drill — full scenarios) |
[ADR-0053](../adr/ADR-0053-v6-platform-certification.md) | [RUNBOOKS.md](./incidents/RUNBOOKS.md) |
[MULTI_REGION_DRILL_CHECKLIST.md](./MULTI_REGION_DRILL_CHECKLIST.md)_
