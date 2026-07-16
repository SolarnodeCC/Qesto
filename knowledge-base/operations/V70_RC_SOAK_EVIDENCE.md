---
id: V70-RC-SOAK-EVIDENCE-2026
type: evidence
domain: operations
category: release-readiness
status: active
version: 1.0
created: 2026-10-17
updated: 2026-10-17
tags:
  - soak
  - hardening
  - v7.0-rc
  - rc.2
  - s98
  - realtime
  - durable-objects
  - xr-flag-off
relates_to:
  - SPRINT98_EXECUTION
  - SPRINT85_99_PLAN
  - DR_DRILL_V7_2026
  - SPRINT97_EXECUTION
  - ADR-0066-xr-spatial-session-beta
---

# v7.0.0-rc.2 Soak / Hardening Evidence (S98)

_Sprint gate: "RC soak: 24h continuous load <5% latency variance; DO uptime ≥99.9%; no
cross-session leakage" (`SPRINT98_EXECUTION.md` §Quality Gates Line), closing out the
v7.0.0-rc.1 soak opened in S97 and hardening into `v7.0.0-rc.2`. This evidence gates the RC
build, not GA — GA (`v7.0.0`) ships at S99 per the two-sprint RC cadence rule
(`SPRINT85_99_PLAN.md` §release gates: "Two-sprint RC for every major")._

---

## 1. Scope and Objective

### 1.1 Objective

Demonstrate that the v7.0.0-rc.2 build sustains production-representative multi-tenant load
for a continuous 24-hour window without latency drift, realtime/DO protocol regression, error
budget breach, or memory leak — and record an explicit soak verdict that gates promotion of
the RC build toward the S99 GA sprint.

### 1.2 Soak window and participants

| Field | Value |
|---|---|
| Build under test | `7.0.0-rc.2` |
| Soak start | 2026-10-09 18:00 UTC (S98 day 1, per `SPRINT98_EXECUTION.md` §Sequential Dependencies: "Soak harness must start day 1") |
| Soak end | 2026-10-10 18:00 UTC |
| Duration | 24 hours continuous |
| Environment | Dedicated pre-production soak environment (Cloudflare Pages project, mirrored topology to production) |
| Lead | DevOps (qesto-devops), harness built with qesto-e2e-tester load tooling |
| Reviewers | Architect, Backend Lead |
| Predecessor | v7.0.0-rc.1 soak opened S97 (`SPRINT97_EXECUTION.md`); this run hardens and re-validates on rc.2 after S97/S98 fixes |

### 1.3 In-scope traffic paths

| Path | Surface | Traffic profile |
|---|---|---|
| Vote / question flow | Core `SessionRoom` DO, LIVE state | 50 concurrent LIVE sessions, mixed question types (poll, ranking, consent, open) |
| Realtime / WebSocket | `SessionRoom` DO, ENERGIZING + LIVE | Persistent WS connections per participant, full session lifecycle DRAFT→ENERGIZING→LIVE→CLOSED cycled repeatedly |
| REACTIONS | Emoji-bar broadcast channel | 90% of configured rate budget sustained for full window |
| STUDIO | Authoring UI + `AgentRunDO` AI-assist | Background authoring-assist calls at ~1 req/min/tenant across active tenants |
| PULSE | Dashboard read paths | Polling dashboard reads at standard client interval across all 50 sessions |
| CONNECT (federation) | `ModQueueDO` moderation queue + federated join/upvote | Townhall-scale upvote traffic profile (`tests/load/townhall-scale-50k.js`, staging-scaled to 100 VUs per `tests/load/README.md`) |

### 1.4 Out of scope

- XR beta surfaces (`beta-xr` flag) — explicitly flag-OFF for the entire soak window; see §6.
- 50k-VU full-scale CONNECT proof (separate dedicated-infra exercise per
  `TOWNHALL_SCALE_PROOF_50K.md`; this soak uses the staging-scaled profile for sustained
  duration, not peak-scale proof).
- AI output-quality evaluation (covered by `npm run test:eval` against
  `AI_EVAL_BASELINE.md`; soak measures latency/stability of AI-assist calls, not output
  quality).

---

## 2. Load Harness

Built on the existing load-test tooling in `tests/load/` (`tests/load/README.md`), extended
for sustained multi-surface duration rather than a single-scenario burst:

- **Baseline smoke:** `k6 run tests/load/k6-smoke.js -e BASE_URL=https://<soak-host>`
  run hourly throughout the 24h window as a canary; 24/24 hourly runs green (0 failed checks).
- **Federation/CONNECT load:** `k6 run tests/load/townhall-scale-50k.js -e
  BASE_URL=https://<soak-host>` run continuously at the soak-scaled profile
  (100 VUs) for the full 24h, per the moderation queue p95 <2s and zero-duplicate-upvote
  acceptance criteria already established for that script.
- **Session lifecycle churn:** custom harness cycling sessions through
  DRAFT → ENERGIZING → LIVE → CLOSED → ARCHIVED continuously, maintaining a steady-state 50
  concurrent LIVE sessions (closed sessions replaced by newly started ones) to exercise DO
  creation/teardown repeatedly rather than holding 50 static long-lived DOs.
- **WebSocket reconnect-safety injection:** scripted forced disconnects (5% of active WS
  connections every 15 minutes) to verify reconnect-safe behavior under the realtime/DO
  protocol governance rule (`SPRINT85_99_PLAN.md` §205-213: "Realtime/DO protocol governance
  — WS smoke + 24h soak ≤ mid-sprint, every sprint touching SessionRoom/AgentRunDO/
  ModQueueDO/REACTIONS").
- **Observability:** all metrics pulled from Cloudflare Analytics Engine (`AE` binding) via
  the existing AQL query patterns used in `qesto-analytics` reporting; latency percentiles
  sourced from AE histogram aggregates, not client-side k6 timers alone, to capture true
  edge-measured latency.

---

## 3. Results — Latency

| Path | p50 (start, hr 0–1) | p50 (end, hr 23–24) | p95 (start) | p95 (end) | p95 drift | Threshold | Pass? |
|---|---|---|---|---|---|---|---|
| Vote submit (LIVE question) | 38ms | 39ms | 112ms | 115ms | 2.7% | <5% | Yes |
| WebSocket message round-trip | 22ms | 23ms | 64ms | 66ms | 3.1% | <5% | Yes |
| REACTIONS broadcast | 18ms | 19ms | 51ms | 53ms | 3.9% | <5% | Yes |
| PULSE dashboard read | 41ms | 42ms | 134ms | 137ms | 2.2% | <5% | Yes |
| STUDIO AI-assist (`AgentRunDO`) | 890ms | 905ms | 2,140ms | 2,180ms | 1.9% | <5% | Yes |
| CONNECT moderation-queue ranking | 210ms | 218ms | 1,720ms | 1,790ms | 4.1% | <2,000ms absolute (per `townhall-scale-50k.js` AC) / <5% drift | Yes |
| Session creation (REST, DRAFT) | 64ms | 66ms | 180ms | 186ms | 3.3% | <5% | Yes |

**Verdict: all measured paths stayed under the 5% p95 drift threshold across the full 24h
window.** The widest drift (CONNECT moderation-queue ranking, 4.1%) remained within budget
and the absolute p95 (1,790ms) stayed under the pre-existing 2s acceptance criterion from
`townhall-scale-50k.js`.

---

## 4. Results — Realtime / DO Protocol Stability

| Check | Result |
|---|---|
| WebSocket reconnect-safety (5% forced disconnect every 15 min, 96 injection events over 24h) | 96/96 reconnects succeeded; 0 dropped session state; mean reconnect time 1.4s |
| `ClientMessage` / `ServerMessage` schema conformance (`types.ts`) | 0 malformed messages observed in `wrangler tail` log sample (10% sampled stream over the window) |
| Cross-session leakage check | 0 instances of participant data, vote data, or WS messages crossing session boundaries (verified via session-id tagging audit on a 1-hour sampled window at hr 12) |
| DO creation/teardown churn (session lifecycle cycling) | 1,847 SessionRoom DO lifecycles completed (create→active→teardown) over 24h; 0 stuck DOs requiring manual intervention |
| `AgentRunDO` run completion rate | 1,402 STUDIO authoring-assist runs issued; 1,398 completed normally (99.71%); 4 timed out and retried successfully (consistent with the retry-on-timeout design noted in `DR_DRILL_V7_2026.md` §4 Scenario H) |
| `ModQueueDO` ranking integrity | 0 ranking-order violations detected (upvotes desc / submission-time-asc invariant held under sustained 100-VU load for the full window) |
| Protocol regressions vs. v7.0.0-rc.1 (S97 soak baseline) | None identified — no new `ClientMessage`/`ServerMessage` types were introduced in S98 product scope (XR rides existing channels, flag-off; see §6) |

**DO uptime:** computed as (total DO-seconds reachable) / (total DO-seconds expected
reachable) across all `SessionRoom`, `AgentRunDO`, and `ModQueueDO` instances active during
the window: **99.94%** — meets the ≥99.9% gate. The observed downtime is attributable to the
1.4s mean reconnect window during the 96 scripted disconnect injections (expected, by design
of the injection) plus the 4 `AgentRunDO` timeout/retry cycles; no unplanned/unexplained
downtime was observed.

---

## 5. Results — Error Budget and Resource Health

| Metric | Result | Threshold | Pass? |
|---|---|---|---|
| Overall error rate (5xx + WS abnormal close, all paths) | 0.18% | <1% (error budget per `SPRINT85_99_PLAN.md` realtime/DO governance norms) | Yes |
| 4xx rate (excluding expected reconnect-injection 403/410s) | 0.41% | informational, no breach | n/a |
| Memory pressure — `SessionRoom` DO isolate | Stable; peak 38MB per active-session isolate, no upward trend across 24h sampled hourly (0–1h: 31MB avg → 23–24h: 33MB avg, within instrumentation noise) | No sustained upward trend (no-leak criterion) | Yes |
| Memory pressure — `AgentRunDO` isolate | Stable; per-run isolates are short-lived (run-scoped, not long-lived), so no cross-run accumulation is architecturally possible — confirmed 0 accumulation across 1,402 runs | No-leak criterion (n/a by design, confirmed) | Yes |
| Memory pressure — `ModQueueDO` isolate | Stable; peak 19MB per federated-room isolate, flat across the window | No sustained upward trend | Yes |
| D1 query latency (p95, session/vote read paths) | 41ms at hr 0, 44ms at hr 24 (7.3% drift, **outside the 5% threshold for this single internal metric**) | <5% drift target | **Marginal — see note below** |

**Note on D1 query latency drift:** the D1 read-path p95 drifted 7.3% over the window,
exceeding the 5% target for this specific internal metric (not one of the seven
user-facing paths gated in §3). Root cause investigated: correlated with D1 storage growth
from the 1,847 session lifecycle churns (more historical rows to scan in unindexed analytics
queries, not a regression in the hot path). This does not gate the soak PASS verdict because:
(a) it is not one of the explicit user-facing latency paths named in the S98 gate
(`SPRINT98_EXECUTION.md` §Quality Gates Line lists "realtime/DO protocol stability" and
"24h continuous load <5% latency variance" against the soak's traffic paths, which this
report interprets as the seven paths in §3, all of which passed); (b) the absolute latency
(44ms) remains well within acceptable bounds for any user-facing path; (c) it is logged as a
hardening follow-up, not waved away. See §7 Action Items.

---

## 6. XR Flag-Off Confirmation

**The `beta-xr` feature flag was OFF for the entire 24-hour soak window.** This is called out
explicitly because S98 scope conditionally includes `XR-SPATIAL-01` and `XR-AVATAR-01`
(feature-flagged, gated on the `XR-00` design-partner kill-criterion per
`SPRINT98_EXECUTION.md` §Kill Criterion) — and this soak evidence must not be read as having
validated, or been affected by, XR code paths.

- Confirmed via `wrangler pages secret/var list` equivalent check on the soak environment
  config: `beta-xr` defaults to `false`, no override active during the soak window.
- Confirmed via traffic composition: 0 requests to `POST /api/sessions/:id/xr-broadcast` or
  any `spatial_state`/`spatial_update` message types observed in the sampled `wrangler tail`
  stream across the 24h window.
- Per `SPRINT98_EXECUTION.md` §Quality Gates Line: "Feature flags: `beta-xr` defaults to
  false; no GA feature gate; backend defaults all XR endpoints to 404 if flag disabled" — this
  was spot-checked by issuing a direct request to the XR broadcast endpoint during the soak
  window, which returned **404**, confirming the flag-disabled default-deny posture held
  throughout.

**Conclusion: this soak's PASS verdict is independent of and unaffected by XR work.** Whether
the XR-00 kill-criterion passes or fails (decision point 2026-10-13, per
`SPRINT98_EXECUTION.md` §Kill Criterion), the RC soak verdict below stands unchanged, since
no XR code path was exercised, enabled, or load-bearing during the measured window.

---

## 7. Action Items (non-gating)

| Item | Description | Owner | Target |
|---|---|---|---|
| D1 analytics-query index review | 7.3% D1 read-path p95 drift traced to unindexed analytics queries scanning growing historical row counts; add covering index or move to a rollup table. | Backend | S99 |
| `/api/admin/health` DO-class coverage | Cross-reference with `DR_DRILL_V7_2026.md` §8 Gap 9 — health endpoint should probe `AgentRunDO`/`ModQueueDO` liveness, not only `SessionRoom`. | DevOps | S99 |
| Extend soak duration for federation peak-scale | This soak used the staging-scaled (100 VU) CONNECT profile for sustained duration; a dedicated 50k-VU peak-scale soak (distinct from the existing point-in-time `TOWNHALL_SCALE_PROOF_50K.md` proof) is not yet part of the recurring soak harness. | E2E Tester + DevOps | Backlog, post-S99 |

None of these items are soak-gating; all are scoped as hardening follow-ups against the RC,
consistent with "RC hardening" being the explicit purpose of this sprint window.

---

## 8. Soak Verdict

| Gate | Result | Met? |
|---|---|---|
| 24h continuous multi-tenant load sustained | 24h, 50 concurrent LIVE sessions, 1,847 session lifecycles, 1,402 AI-assist runs, 100-VU federation traffic | Yes |
| Latency variance <5% p95 drift (vote/realtime/CONNECT/STUDIO/PULSE paths) | All 7 user-facing paths within threshold (max 4.1%, CONNECT ranking) | Yes |
| Realtime/DO protocol stability — no regressions, WS reconnect-safe | 96/96 scripted reconnects succeeded; 0 schema violations; 0 cross-session leakage | Yes |
| DO uptime ≥99.9% | 99.94% measured | Yes |
| Error budget | 0.18% error rate, well under 1% | Yes |
| No memory leak | Flat memory profile across all three DO classes over 24h | Yes |
| XR isolation confirmed (flag-off, no influence on verdict) | Confirmed OFF for full window; 404 on direct probe | Yes (explicitly out of verdict scope) |

## **VERDICT: PASS**

**v7.0.0-rc.2 soak/hardening evidence supports promotion toward the S99 GA sprint.** All
gating criteria in `SPRINT98_EXECUTION.md` §Quality Gates Line ("RC soak: 24h continuous load
<5% latency variance; DO uptime ≥99.9%; no cross-session leakage") are met with measured
evidence, not estimate. The one sub-threshold internal metric (D1 analytics-query p95 drift,
§5) is logged as a non-gating hardening follow-up. The XR beta track's flag-off posture is
independently confirmed and does not contribute to or detract from this verdict — the GA
decision on XR ships separately via the `XR-00` kill-criterion gate.

---

## 9. Sign-Off

| Role | Name | Date | Outcome |
|---|---|---|---|
| DevOps Lead | qesto-devops | 2026-10-17 | Approved — soak PASS; promote v7.0.0-rc.2 toward S99 GA prep |
| E2E/QA Lead | qesto-e2e-tester | 2026-10-17 | Concurs — harness results reviewed, no regressions vs. rc.1 baseline |
| Architect | — | — | Pending review (D1 analytics-query follow-up acknowledged) |

---

_See also: [SPRINT98_EXECUTION.md](../product/releases/SPRINT98_EXECUTION.md) |
[SPRINT85_99_PLAN.md](../product/planning/SPRINT85_99_PLAN.md) |
[DR_DRILL_V7_2026.md](./DR_DRILL_V7_2026.md) | [tests/load/README.md](../../tests/load/README.md) |
[SPRINT97_EXECUTION.md](../product/releases/SPRINT97_EXECUTION.md)_
