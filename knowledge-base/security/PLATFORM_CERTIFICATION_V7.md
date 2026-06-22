---
id: PLATFORM_CERTIFICATION_V7
type: security
domain: security
category: certification
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - v7.0
  - certification
  - ga
  - sprint-99
  - pentest-6
  - federation
  - dr-drill
relates_to:
  - ADR-0063-v7-platform-certification
  - ADR-0062-federation-trust-isolation-model
  - SEC_PEN6_RESULTS
  - SOC2_ANNUAL_EVIDENCE_2026
  - DR_DRILL_V7_2026
  - WCAG_AAA_REATTEST_V70_S98
  - V70_RC_SOAK_EVIDENCE
  - BACKLOG_MASTER
---

# Qesto v7.0 — Platform Certification Bundle

_`PLATFORM-CERTIFICATION-V7-01` (ADR-0063), Sprint 99 / v7.0 GA. Evidence index behind
`GET /api/platform/certification`. Internal self-attestation — not a third-party grant._

## What "v7.0 certified" means — and does not mean

**Means:** v7.0-rc soak (S98), DR drill RTO ≤ 2h, Pentest #6 closed (crit/high = 0),
cross-tenant isolation proof (ADR-0062), and bounded WCAG AAA on v7 surfaces are documented
and queryable. GA epics: REACTIONS, PULSE, COPILOT, LEARN, SOVEREIGN+, CONNECT, STUDIO.

**Does not mean:** XR is GA (beta behind `BETA_XR_ENABLED` only); FedRAMP ATO granted;
app-wide AAA; production AE SLO attestation at ship time (see open ops items in
[`SPRINT99_EXECUTION.md`](../product/releases/SPRINT99_EXECUTION.md)).

## Evidence index

| # | Control area | Status | Evidence artifact | Verifier |
|---|---|---|---|---|
| 1 | Platform certification self-attestation | ✅ `certifiedVersion: 7.0.0` | ADR-0063; this bundle | architect + PO |
| 2 | Pentest #6 (agent L2/L3 + aggregation + egress + federation) | ✅ crit/high = 0 | `SEC_PEN6_RESULTS.md` (if present), ADR-0063 §evidence | security |
| 3 | Cross-tenant isolation proof | ✅ `isolationProof: verified` | ADR-0062, `QA-CONNECT-SCALE-01`, `lib/region-isolation.ts` | security + backend |
| 4 | SOC 2 Type II + 2026 annual evidence | ✅ closed / refreshed | `SOC2_ANNUAL_EVIDENCE_2026.md` | security |
| 5 | DR drill RTO ≤ 2h (pre-GA) | ✅ documented | `DR_DRILL_V7_2026.md` | devops |
| 6 | v7.0 RC soak (24h, <5% drift) | ✅ documented | `V70_RC_SOAK_EVIDENCE.md` | devops + e2e |
| 7 | WCAG AAA re-attest (v7 surfaces) | ✅ bounded partial | `WCAG_AAA_REATTEST_V70_S98.md` | e2e + frontend |
| 8 | v6.x deprecation policy | ✅ additive | ADR-0063 §3, `/api/platform/v6-sunset` | architect |
| 9 | XR beta | ✅ flag-gated, excluded from cert claim | ADR-0066, `XR_BETA_SECURITY_REVIEW.md` | security |

## API surface

- `GET /api/platform/version` → `api: 7.0.0`
- `GET /api/platform/releases` → GA row `{ version: '7.0.0', sprint: 99, status: 'ga' }`
- `GET /api/platform/certification` → bundle fields (see `tests/unit/platform-v7-ga.test.ts`)
- `GET /api/platform/v6-sunset` → `currentGa: 7.0.0`, `v6MaintenanceEnd: 2029-11-03`

_Note:_ S99 planning referenced `/api/platform/deprecation-notice`; shipped contract is
**`/api/platform/v6-sunset`** (additive, same purpose).

## Residuals (non-gating at GA)

- DR Gap 1 (KV export backup) + Gap 2 (R2 snapshot cadence) — carried since S90/S91; see
  `DR_DRILL_ANNUAL_V6_2026.md`, [`BACKLOG_ACTIVE.md`](../product/backlog/BACKLOG_ACTIVE.md) RT-01.
- SAML XML-DSig implementation (`SEC-SAML-01`) — dual kill-switch enforced; see
  [`JANURAI_REVERIFY_2026_06_19.md`](./JANURAI_REVERIFY_2026_06_19.md).
- Production deploy smoke + AE SLO proof — open at S99 closeout; RT-01.

## Sign-off

| Role | Outcome | Date |
|---|---|---|
| Architect | ADR-0063 accepted; bundle indexed | 2026-11-03 (plan) / code verified 2026-06-19 |
| Security | Pentest #6 scope closed per ADR-0063 | per ADR |
| DevOps | DR + soak evidence linked | per `DR_DRILL_V7_2026.md` |
| Product Owner | v7.0 GA narrative in `v7.0.0.md` | 2026-11-03 (plan) |
