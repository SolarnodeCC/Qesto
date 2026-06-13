---
id: PLATFORM_CERTIFICATION_V6
type: security
domain: security
category: certification
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - v6.0
  - certification
  - ga
  - soc2
  - pentest-5
  - fedramp
  - dr-drill
  - wcag-aaa
  - sprint-90
relates_to:
  - ADR-0053-v6-platform-certification
  - ADR-0052-fedramp-full-ato-sovereign-data-plane
  - SEC_V60_RC_GATE
  - SOC2_ANNUAL_EVIDENCE_2026
  - DR_DRILL_ANNUAL_V6_2026
  - FEDRAMP_ATO_FULL_PATH
  - BACKLOG_MASTER
---

# Qesto v6.0 — Platform Certification Bundle

_`PLATFORM-CERTIFICATION-V6-01` (ADR-0053), Sprint 90 / v6.0 GA. This is the evidence
index behind `GET /api/platform/certification`. It is an **internal self-attestation
bundle**, not a third-party-granted authorization._

## What "v6.0 certified" means — and does not mean

**Means:** every control area below has current, code- or document-verified evidence, and
the v6.0-rc security gate cleared (Pentest #5 crit/high = 0). The platform ships GA with a
queryable certification surface.

**Does not mean:** a third party has *granted* an authorization. SOC 2 evidence is an
internal control-tracking artifact (not an auditor's report); FedRAMP is a documented
**path/target**, never an achieved ATO; WCAG AAA is a **bounded** claim (core flows +
captions + canvas, not the whole app). All public copy stays inside
`npm run check:compliance-claims`.

## Evidence index

| # | Control area | Status | Evidence artifact | Verifier |
|---|---|---|---|---|
| 1 | Platform certification self-attestation | ✅ `certifiedVersion: 6.0.0` | ADR-0053; this bundle | architect + PO |
| 2 | Pentest #5 (governance + embed + agent) | ✅ crit/high = 0 | `SEC_V60_RC_GATE.md`, `SEC_PEN5_01_RESULTS.md` | security |
| 3 | EMBED read-plane hardening (`PEN5-E1/E3/E4`) | ✅ closed in code | `middleware/widget-token.ts`, `tests/unit/embed-rate-limit.test.ts` | security |
| 4 | Embed tenancy model (`PEN5-E2`) | ✅ resolved-by-ratification | ADR-0050 Amendment 1 | architect + security |
| 5 | SOC 2 Type II + 2026 annual evidence | ✅ closed / refreshed | `SOC2_ANNUAL_EVIDENCE_2026.md` | security |
| 6 | DR drill RTO ≤ 2h (annual, GA cadence) | ✅ met (estimate) | `DR_DRILL_ANNUAL_V6_2026.md` | devops |
| 7 | WCAG AAA (bounded: core + captions + canvas) | ✅ partial (intended) | `AAA_CONFORMANCE_S89.md` | frontend + a11y |
| 8 | CAPTIONS GA WER sign-off (REV-10) | ✅ behind `CAPTION_WER_BAR=0.25` | `CAPTIONS_WER_SIGNOFF_S89.md` | AI |
| 9 | FedRAMP Moderate full-ATO **path** | ✅ documented (not granted) | ADR-0052, `FEDRAMP_ATO_FULL_PATH.md` | security + architect |
| 10 | Sovereign tenant data plane | ✅ available (region-pinned, no replication) | ADR-0052 | architect |
| 11 | Circuit breakers / PII gate / secret rotation | ✅ in place (prior cycles) | ADR-0007, ADR-0009, `SECRET_ROTATION_POLICY.md` | security + devops |
| 12 | v5.x deprecation policy | ✅ additive, no break at GA | ADR-0053 §3, `/api/platform/v5-sunset` | architect |

## Bounds and residuals carried into GA (none gating)

- **PEN5-E2** — closed by ratification (ADR-0050 Amendment 1); a real-team embed tenancy
  model is a deliberate future migration, not a v6.0 gap.
- **Residual Pentest #5 Lows** — `PEN5-D1` (devops secret provisioning), `D3`, `D4`, `A2`:
  backlog/ops, none gating (`SEC_V60_RC_GATE.md`).
- **DR gaps** — R2 snapshot cadence + D1 restore escalation path: carried with disposition
  in `DR_DRILL_ANNUAL_V6_2026.md`; next live drill S98.
- **AAA** — bounded to core/captions/canvas; broader app AA. Do not over-claim.

## API surface

`GET /api/platform/certification` returns the machine-readable bundle:
`{ platformCertification, certifiedVersion: '6.0.0', soc2Type2, soc2AnnualEvidence,
pentest3, pentest5, drDrillRtoHours, aaaConformance: 'partial', fedRampAto, sovereignTier,
deprecationPolicy, certifiedAt }`. `GET /api/platform/v5-sunset` returns the deprecation
notice. Both are public, unauthenticated, additive (no v5.x break).

## Sign-off

| Role | Outcome | Date |
|---|---|---|
| Security | RC gate cleared; Pentest #5 crit/high = 0; PEN5-E2 ratified | 2026-06-19 |
| Architect | ADR-0053 accepted; certification bundle complete | 2026-06-19 |
| DevOps | DR drill RTO ≤ 2h evidence; gaps dispositioned | 2026-06-19 |
| Product Owner | v6.0 GA approved; bounded claims acknowledged | 2026-06-19 |
