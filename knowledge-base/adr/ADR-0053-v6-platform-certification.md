---
id: ADR-0053
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, security, product-owner, devops
relates_to: ADR-0052, ADR-0050, ADR-0051, ADR-0043, ADR-0036, ADR-0027, SPRINT85_99_PLAN, SPRINT81_90_PLAN, BACKLOG_MASTER, SEC_V60_RC_GATE, SOC2_ANNUAL_EVIDENCE_2026, DR_DRILL_V6_2026
---

# ADR-0053: v6.0 Platform Certification & v5.x Deprecation Policy

## Status

Accepted (S90 / v6.0 GA). Gate ADR for `V60-GA-RELEASE-01`,
`PLATFORM-CERTIFICATION-V6-01`, and `V5X-SUNSET-NOTICE-01` per
[`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md) §S90 and
[`SPRINT81_90_PLAN.md`](../product/planning/SPRINT81_90_PLAN.md) §Sprint 90.

## Context

S89 cut **v6.0-rc** ([`v6.0.0-rc.md`](../product/releases/v6.0.0-rc.md)): the EMBED
read-plane Pentest #5 gate closed (`PEN5-E1/E3/E4`), CAPTIONS GA WER sign-off, WCAG AAA
re-attestation, ADR-0052 (FedRAMP full-ATO path + sovereign data plane), the SOC 2 annual
evidence refresh, and a DR drill establishing RTO ≤ 2h. The security gate
([`SEC_V60_RC_GATE.md`](../security/SEC_V60_RC_GATE.md)) **CLEARS** with Pentest #5 overall
crit/high = 0.

S90 promotes that RC to **v6.0 GA**. This ADR is the certification gate: it records what
"v6.0 is certified" means (the evidence bundle and its bounds), ratifies the one remaining
RC architecture carry-forward (PEN5-E2, via ADR-0050 Amendment 1), and sets the **v5.x
deprecation policy** so the GA can publish a sunset notice without breaking integrators.

This is the first major version since **v5.0 GA (S80)**. The do-not-co-land discipline of
ADR-0049/0050/0052 was held through the RC; this ADR does not introduce new trust
boundaries — it certifies and freezes the ones already shipped.

**Honesty constraint (inherited from ADR-0043 / ADR-0052).** "Certification" here means
*Qesto's internal platform-certification bundle* — an evidence inventory and self-attestation,
**not** a third-party-granted authorization. SOC 2 evidence is internal-tracking; the FedRAMP
posture is a documented **path/target**, never an achieved ATO; AAA is a **bounded** claim.
Every product surface (`/api/platform/certification`, `/v5-sunset`, release notes) and all
public copy stays inside `npm run check:compliance-claims`.

## Decision

### 1. v6.0 certification bundle (`PLATFORM-CERTIFICATION-V6-01`)

v6.0 is certified GA on the following evidence, surfaced at
`GET /api/platform/certification`:

| Control area | v6.0 status | Evidence |
|---|---|---|
| Platform certification self-attestation | `platformCertification: true`, `certifiedVersion: '6.0.0'` | This ADR + [`PLATFORM_CERTIFICATION_V6.md`](../security/PLATFORM_CERTIFICATION_V6.md) |
| Pentest #5 (governance + embed + agent) | `pentest5: 'complete'` — crit/high = 0 | [`SEC_V60_RC_GATE.md`](../security/SEC_V60_RC_GATE.md), `SEC_PEN5_01_RESULTS.md` |
| Pentest #3 (v5.0 platform) | `pentest3: 'complete'` | prior cycle |
| SOC 2 Type II | `soc2Type2: 'closed'` + `soc2AnnualEvidence: '2026'` | [`SOC2_ANNUAL_EVIDENCE_2026.md`](../security/SOC2_ANNUAL_EVIDENCE_2026.md) |
| DR drill | `drDrillRtoHours: 2` | [`DR_DRILL_ANNUAL_V6_2026.md`](../operations/DR_DRILL_ANNUAL_V6_2026.md) |
| WCAG AAA (bounded) | `aaaConformance: 'partial'` | [`AAA_CONFORMANCE_S89.md`](../quality/accessibility/AAA_CONFORMANCE_S89.md) |
| FedRAMP Moderate | `fedRampAto: 'path_documented'` | ADR-0052, [`FEDRAMP_ATO_FULL_PATH.md`](../security/FEDRAMP_ATO_FULL_PATH.md) |
| Sovereign tenant tier | `sovereignTier: 'available'` | ADR-0052 |

**AAA is a bounded claim and must stay bounded.** AAA conformance covers the **core flows +
captions overlay + canvas themes**; the broader application is **AA**. The endpoint reports
`aaaConformance: 'partial'` precisely so the GA does not over-claim. Marketing copy must say
"AAA on core flows / captions / canvas; AA across the app", never "AAA-conformant platform".

### 2. PEN5-E2 ratified (not migrated)

The sole open RC architecture carry-forward — the embed `tid`/`team_id` tenancy-model
divergence — is **resolved by ratification** in [ADR-0050 Amendment 1](./ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing.md#amendment-1--embed-tenancy-model-ratified-pen5-e2-s90--v60-ga):
the embed tenancy key is intentionally the session-owner's user id; isolation is enforced
fail-safe on that same value at both planes. No data-model migration ships in the
certification sprint. PEN5-E2 closes; no Medium remains open against v6.0 GA.

### 3. v5.x deprecation policy (`V5X-SUNSET-NOTICE-01`)

v6.0 GA starts the v5.x deprecation clock. The policy is **additive-only at GA** — v6.0
introduces **no breaking API change** vs. v5.x (the `RELEASES` list and the version string
are additive; realtime v3 remains the GA wire format; public API `v3` stays GA, `v2`
maintained, `v1` deprecated). Concretely:

| API surface | v6.0 GA posture | End-of-support |
|---|---|---|
| Public API `v3` | GA (current) | — |
| Public API `v2` | maintained | with v5.x window |
| Public API `v1` | deprecated (`Sunset-Date` header) | `2027-12-31` |
| Realtime v3 (`results_delta`) | GA default when enabled | — |
| v5.x platform behaviours | **maintenance** (security + critical fixes only) | `2028-12-31` |
| v4.x | maintenance | `2028-09-16` (unchanged) |

Surfaced at `GET /api/platform/v5-sunset` (`currentGa: '6.0.0'`, `v5MaintenanceEnd`,
`policyDoc` → this ADR). No customer action is required at GA; the notice exists so
integrators can plan. Any *future* breaking change requires a new ADR and a ≥12-month notice
on the deprecated surface via `Sunset-Date` headers (continuing the v1/v4 precedent).

### 4. Annual DR drill at GA cadence (`DR-DRILL-ANNUAL-V6-01`)

The S89 RC drill (tabletop) is repeated and dispositioned for GA in
[`DR_DRILL_ANNUAL_V6_2026.md`](../operations/DR_DRILL_ANNUAL_V6_2026.md), which carries the
S89 drill's open gaps (R2 snapshot cadence, D1 restore escalation path) forward with explicit
GA disposition and owners. The next full (live-traffic) drill is **S98**, pre-v7.0.

## Consequences

**Positive.** v6.0 GA ships with a single, queryable certification surface and an honest,
bounded evidence bundle; integrators get a no-action, no-break sunset notice; the one open
RC architecture item is closed without taking migration risk in a certification sprint.

**Negative / accepted.** "Certification" is self-attestation, not third-party authorization —
positioning must remain disciplined (CI-gated). The v5.x maintenance window (through
2028-12-31) is a support commitment. PEN5-E2's ratification defers a possible real-team embed
tenancy model to a future, deliberate migration.

**Do-not-co-land (carried).** ADR-0052 (sovereign/ATO boundary) ✗ marketplace/agent GA in
the same sprint; ADR-0049 (verifiable-vote crypto) ✗ agent-runtime GA. v6.0 GA introduces no
new feature GA that would violate these — it is a certification/release sprint.

## References

- [`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md) §S90 (release map, ADR-0053 row, gates)
- [`SPRINT81_90_PLAN.md`](../product/planning/SPRINT81_90_PLAN.md) §Sprint 90 (story table)
- [`v6.0.0-rc.md`](../product/releases/v6.0.0-rc.md) / [`SPRINT89_EXECUTION.md`](../product/releases/SPRINT89_EXECUTION.md) (RC + carry-forwards)
- [`SEC_V60_RC_GATE.md`](../security/SEC_V60_RC_GATE.md) (Pentest #5 gate, PEN5-E2 disposition)
- ADR-0052 (FedRAMP full-ATO + sovereign), ADR-0051 (captions), ADR-0050 (embed + Amendment 1), ADR-0043 (FedRAMP path)
- `functions/api/routes/platform.ts` (`/version`, `/releases`, `/certification`, `/v5-sunset`)
- Hard rule: `npm run check:compliance-claims` gates all public certification/compliance copy
