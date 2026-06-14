---
id: SPRINT90_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - sprint-90
  - v6.0-ga
  - certification
  - dr-drill
  - v5-sunset
  - pen5-e2
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT81_90_PLAN
  - SPRINT89_EXECUTION
  - v6.0.0
  - ADR-0053-v6-platform-certification
  - PLATFORM_CERTIFICATION_V6
  - BACKLOG_MASTER
---

# Sprint 90 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S90 /
[`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) §Sprint 90): **v6.0 GA; platform
certification; annual DR drill; AAA conformance; v5.x sunset.** P0 anchors
`V60-GA-RELEASE-01`, `PLATFORM-CERTIFICATION-V6-01`, `DR-DRILL-ANNUAL-V6-01`. Release:
**v6.0 GA**._

_Final sprint of the S81–S90 expansion arc. A certification/release sprint: promote the S89
`v6.0-rc` to GA, ship the certification bundle and v5.x deprecation policy, repeat the DR
drill at GA cadence, and close the one open RC architecture carry-forward (PEN5-E2). No new
feature GA, no new trust boundary._

## Outcome

Sprint 90 ships **v6.0.0 GA** — the first major version since v5.0 (S80). The platform
version advances to **`6.0.0`**, the v6.0 **certification bundle** is published behind a
single queryable surface, the **v5.x deprecation policy** is set (additive, no break), the
**annual DR drill** is repeated at GA cadence with RTO ≤ 2h confirmed, and **PEN5-E2** — the
sole open RC architecture item — is **resolved by ratification** (ADR-0050 Amendment 1), so
no Medium remains open against the GA.

The release is deliberately additive: the only behavioural code change is the platform
version string and two new public read endpoints (`/certification` fields + `/v5-sunset`).
Everything else is governance evidence and the doc-only embed tenancy ratification. The DR
recovery profile is therefore unchanged from the RC.

**Quality gates:** `tsc --noEmit` clean · full Vitest green (1778: prior 1774 + 4 new in
`tests/unit/platform-v6-ga.test.ts`) · `npm run build` green · Pentest #5 overall crit/high
= 0 (sustained) · compliance claims flagged for `check:compliance-claims`.

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| `V60-GA-RELEASE-01` (v6.0 GA release) | P0 | ✅ | `functions/api/routes/platform.ts` — `/version` api → `6.0.0`; `RELEASES` += `{ version: '6.0.0', codename: 'v6.0', status: 'ga', sprint: 90 }`. Release notes `knowledge-base/product/releases/v6.0.0.md`. |
| `PLATFORM-CERTIFICATION-V6-01` (ADR-0053) | P0 | ✅ | `knowledge-base/adr/ADR-0053-v6-platform-certification.md` (accepted); evidence index `knowledge-base/security/PLATFORM_CERTIFICATION_V6.md`; `/api/platform/certification` extended (`certifiedVersion`, `pentest5`, `soc2AnnualEvidence`, `fedRampAto`, `sovereignTier`, `deprecationPolicy`). |
| `V5X-SUNSET-NOTICE-01` | P0 | ✅ | `GET /api/platform/v5-sunset` (`currentGa: '6.0.0'`, `v5MaintenanceEnd: '2028-12-31'`, additive — no v5.x break); policy in ADR-0053 §3. |
| `DR-DRILL-ANNUAL-V6-01` | P0 | ✅ | `knowledge-base/operations/DR_DRILL_ANNUAL_V6_2026.md` — RTO ≤ 2h confirmed on GA build; S89 RC-drill gaps (R2 cadence, D1 restore escalation) dispositioned as accepted residuals with owners/targets, none GA-gating; live drill scheduled S98. |
| PEN5-E2 resolution | P0 | ✅ | ADR-0050 **Amendment 1** ratifies the session-ownership embed tenancy model; clarifying contracts in `routes/embed.ts` (`callerTeamId`) + `lib/embed-token.ts` (`MintTokenInput.tid`); `SEC_V60_RC_GATE.md` PEN5-E2 row → resolved-by-ratification. No data-model migration (wrong risk for a certification sprint). |
| AAA conformance (bounded) | P1 | ✅ | Held at `aaaConformance: 'partial'` (core + captions + canvas AAA; broader app AA) per `AAA_CONFORMANCE_S89.md`; ADR-0053 §1 forbids over-claiming. |
| `tests/unit/platform-v6-ga.test.ts` | P0 | ✅ | 4 tests: version `6.0.0`, GA `RELEASES` entry, certification bundle fields, v5.x sunset notice. |

## Exit-criteria status

- [x] Platform version → `6.0.0`; GA `RELEASES` entry added (RC retained in history).
- [x] v6.0 certification bundle published + queryable (`/api/platform/certification`, ADR-0053, `PLATFORM_CERTIFICATION_V6.md`).
- [x] v5.x deprecation policy set; `/api/platform/v5-sunset` live; additive (no breaking API change vs v5.x).
- [x] Annual DR drill repeated at GA cadence; RTO ≤ 2h; RC gaps dispositioned, none GA-gating.
- [x] PEN5-E2 closed (resolved-by-ratification, ADR-0050 Amendment 1); no Medium open against GA.
- [x] AAA bounded claim held; FedRAMP stays path/target; SOC 2 stays internal-evidence — all inside `check:compliance-claims`.
- [x] `tsc --noEmit` clean; full Vitest green; `npm run build` green; Pentest #5 crit/high = 0.
- [x] v6.0.0 GA release notes published.

## S89 carry-forwards resolved

- **PEN5-E2** (embed tenancy model) — ✅ resolved-by-ratification (ADR-0050 Amendment 1).
- **v6.0 GA gate** (`V60-GA-RELEASE-01`, `PLATFORM-CERTIFICATION-V6-01`, `DR-DRILL-ANNUAL-V6-01`, v5.x sunset) — ✅ delivered.

## Carry-forwards → S91 (net-new horizon opens)

- **DR Gap 2** (R2 snapshot cadence) + **Gap 1** (KV export backup): Backend + DevOps, S91.
- **Residual Pentest #5 Lows** (`PEN5-D1` secret provisioning, `D3`, `D4`, `A2`): backlog/ops.
- **CAPTIONS runtime pair-toggle** (KV/D1, eval-gate-fenced): post-GA ops enhancement.
- **S91 opens** the v6.x→v7.0 net-new arc: `REACTIONS-CHANNEL-01`, `PULSE-STORE-01`,
  ADR-0054 (cadence-9 governance), ADR-0055 (REACTIONS), ADR-0057 (PULSE aggregation) per
  [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S91.

## Quality gates line

`tsc --noEmit` clean · Vitest green (1778 = 1774 + 4 new) · `npm run build` green · Pentest #5
overall crit/high = 0 · compliance claims flagged for `check:compliance-claims`.
