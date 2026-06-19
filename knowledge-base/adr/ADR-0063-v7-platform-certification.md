---
id: ADR-0063
status: accepted
created: 2026-10-23
accepted: 2026-11-03
deciders: architect, security, product-owner, devops, dpo
relates_to: ADR-0062, ADR-0060, ADR-0066, ADR-0053, ADR-0052, ADR-0050, ADR-0043, SPRINT85_99_PLAN, SPRINT91_99_STORIES, BACKLOG_MASTER, SEC_PEN6_RESULTS, SOC2_ANNUAL_EVIDENCE_2026, DR_DRILL_ANNUAL_V7_2026, AAA_CONFORMANCE_S98, QA-CONNECT-SCALE-01
---

# ADR-0063: v7.0 Platform Certification & v6.x Deprecation Policy

## Status

Accepted (S99 / v7.0 GA). Gate ADR for `ADR-0063` (v7.0 certification),
`V70-GA-RELEASE-01`, and the **v6.x sunset notice** per
[`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md) §S99 (Sprint 99 — v7.0 GA —
Engagement Intelligence Network) and the ADR-0054→0063 ladder in §"ADRs".

## Context

S97 cut **v7.0-rc** ([`v7.0.0-rc`](../product/releases/) registry rows `7.0.0-rc.1` / S97 and
`7.0.0-rc.2` / S98): CONNECT promoted to GA, Pentest #6 closed crit/high = 0, and the
cross-tenant isolation proof landed under ADR-0062. S98 was the protected RC soak/harden window
— it carries the **DR drill RTO ≤ 2h** evidence, the **WCAG AAA re-attestation** on the new v7
surfaces, the XR demand kill-gate (`XR-00`), and final hardening. S99 promotes that RC to
**v7.0 GA — the "Engagement Intelligence Network."**

This ADR is the certification gate: it records what "**v7.0 is certified**" means (the evidence
bundle and its bounds), enumerates which v7.0 epics ship **GA vs. beta** at this release, and
sets the **v6.x deprecation policy** so the GA can publish a sunset notice without breaking
integrators. It is the direct v7.0 analogue of [ADR-0053](./ADR-0053-v6-platform-certification.md)
(v6.0 certification).

S91→S99 is the **net-new horizon** sprint arc: unlike S81→S90, it does **not** open a fresh set
of trust boundaries — it deepens and operationalizes shipped surfaces (REACTIONS → GA, the agent
runtime → supervised autonomy COPILOT GA, results/insights → PULSE, new-business epics → LEARN
and SOVEREIGN+, the platform → a federated network CONNECT and a privacy-native authoring studio
STUDIO). The one genuinely new trust boundary of the arc — **cross-tenant federation (CONNECT)**
— was decided up front and once in ADR-0062 and proven at v7.0 scale before this gate. This ADR
**certifies and freezes** what already shipped; it introduces no new trust boundary.

**Honesty constraint (inherited from ADR-0043 / ADR-0052 / ADR-0053).** "Certification" here means
*Qesto's internal platform-certification bundle* — an evidence inventory and self-attestation,
**not** a third-party-granted authorization. SOC 2 evidence is internal-tracking; the FedRAMP
posture is a documented **path/target**, never an achieved ATO; AAA is a **bounded** claim. Every
product surface (`/api/platform/certification`, `/v6-sunset`, release notes) and all public copy
stays inside `npm run check:compliance-claims`.

## Decision

### 1. v7.0 certification bundle (`PLATFORM-CERTIFICATION-V7-01`)

v7.0 is certified GA on the following evidence, surfaced at
`GET /api/platform/certification`:

| Control area | v7.0 status | Evidence |
|---|---|---|
| Platform certification self-attestation | `platformCertification: true`, `certifiedVersion: '7.0.0'` | This ADR + [`PLATFORM_CERTIFICATION_V7.md`](../security/PLATFORM_CERTIFICATION_V7.md) |
| Pentest #6 (agent L2/L3 + analytics aggregation + ecosystem egress + federation) | `pentest6: 'complete'` — crit/high = 0, closed by S97 | [`SEC_PEN6_RESULTS.md`](../security/SEC_PEN6_RESULTS.md), [`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md) §Pentest #6 |
| Pentest #5 (v6.0 governance + embed + agent) | `pentest5: 'complete'` | prior cycle (ADR-0053) |
| Pentest #3 (v5.0 platform) | `pentest3: 'complete'` | prior cycle |
| Cross-tenant isolation proof (federation + aggregation + egress) | `isolationProof: 'verified'` — `QA-CONNECT-SCALE-01`: 5 tenants × 50k × 100 queries, zero leakage | [ADR-0062](./ADR-0062-federation-trust-isolation-model.md) |
| SOC 2 Type II | `soc2Type2: 'closed'` + `soc2AnnualEvidence: '2026'` | [`SOC2_ANNUAL_EVIDENCE_2026.md`](../security/SOC2_ANNUAL_EVIDENCE_2026.md) |
| DR drill (S98, pre-GA) | `drDrillRtoHours: 2` | [`DR_DRILL_ANNUAL_V7_2026.md`](../operations/DR_DRILL_ANNUAL_V7_2026.md) |
| WCAG AAA (bounded) | `aaaConformance: 'partial'` | [`AAA_CONFORMANCE_S98.md`](../quality/accessibility/AAA_CONFORMANCE_S98.md) |
| FedRAMP Moderate | `fedRampAto: 'path_documented'` | ADR-0052, [`FEDRAMP_ATO_FULL_PATH.md`](../security/FEDRAMP_ATO_FULL_PATH.md) |
| Sovereign tenant tier | `sovereignTier: 'available'` | ADR-0052, ADR-0062 (sovereign exclusion from federation) |

**AAA is a bounded claim and must stay bounded.** Per ADR-0053, AAA conformance covers the
**core flows + captions overlay + canvas themes**; the S98 re-attestation extends 0-violation AAA
coverage to the new v7 surfaces in scope (**REACTIONS, PULSE, STUDIO, CONNECT**). The broader
application remains **AA**. The endpoint reports `aaaConformance: 'partial'` precisely so the GA
does not over-claim. Marketing copy must say "AAA on core flows / captions / canvas / REACTIONS /
PULSE / STUDIO / CONNECT; AA across the app", never "AAA-conformant platform".

### 2. Epic GA vs. beta posture at v7.0 GA

v7.0 GA certifies the following epic surfaces. Their GA was earned across S91–S98; this gate
freezes the set:

| Epic | v7.0 posture | Certified by |
|---|---|---|
| **REACTIONS** (live reaction stream) | **GA** | S91–S92; AAA re-attest S98 |
| **PULSE** (first-class analytics product) | **GA** | S93–S95; ADR-0060 AI narration (eval-gated) |
| **COPILOT** (supervised agent autonomy) | **GA** | S93; EVAL-02/EVAL-03 + Pentest #6 surface |
| **LEARN** (education vertical / LTI) | **GA** | S93–S95 |
| **SOVEREIGN+** (sovereign regions + audit export) | **GA** | S93–S95; hard federation exclusion (ADR-0062) |
| **CONNECT** (cross-tenant federated anonymous events) | **GA** | S97; ADR-0062 trust model + `QA-CONNECT-SCALE-01` proof |
| **STUDIO** (privacy-native AI authoring) | **GA** | S96–S98; ADR-0060; prompt-injection hardening (Pentest #6) |
| **XR** (spatial / hybrid session mode) | **beta only — NOT certified GA** | S98–S99; ADR-0066, behind `beta-xr` flag |

**XR ships beta only and is excluded from the GA certification claim.** XR is gated behind the
`beta-xr` feature flag (`BETA_XR_ENABLED`, conditional on the `XR-00` demand kill-gate per
ADR-0066). It is the innovation flag of the arc, not a certified surface: its evidence bundle
(Pentest scope, AAA, scale) is **not** part of v7.0 GA. The certification endpoint and all GA copy
must position XR as **"beta"**. If the S98 kill-criterion fired, XR pivots to the v7.1 backlog and
is absent from GA entirely — either way v7.0 GA does **not** certify XR.

### 3. v6.x deprecation policy (`V6X-SUNSET-NOTICE-01`)

v7.0 GA starts the v6.x deprecation clock. The policy is **additive-only at GA** — v7.0
introduces **no breaking API change** vs. v6.x (the `RELEASES` list and the version string are
additive; realtime v3 remains the GA wire format; public API `v3` stays GA, `v2` maintained, `v1`
deprecated). Concretely:

| API surface | v7.0 GA posture | End-of-support |
|---|---|---|
| Public API `v3` | GA (current) | — |
| Public API `v2` | maintained | with v6.x window |
| Public API `v1` | deprecated (`Sunset-Date` header) | `2027-12-31` (unchanged) |
| Realtime v3 (`results_delta`) | GA default when enabled | — |
| **v6.x platform behaviours** | **maintenance** (security + critical fixes only) | `2029-11-03` |
| v5.x | maintenance | `2028-12-31` (unchanged, per ADR-0053) |
| v4.x | maintenance | `2028-09-16` (unchanged) |

Surfaced at `GET /api/platform/v6-sunset` (`currentGa: '7.0.0'`, `v6MaintenanceEnd`, `policyDoc`
→ this ADR). **No customer action is required at GA**; the notice exists so integrators can plan.
v6.x APIs enter maintenance at v7.0 GA and are supported for a **24-month** window
(through `2029-11-03`); they sunset only at the end of that window, never as a breaking change at
GA. Any *future* breaking change requires a new ADR and a ≥12-month notice on the deprecated
surface via `Sunset-Date` headers (continuing the v1/v4/v5 precedent).

### 4. Annual DR drill at GA cadence (`DR-DRILL-ANNUAL-V7-01`)

The DR drill is run in **S98** (not the GA sprint — same discipline as v6.0's S89/S90 split) and
dispositioned for GA in [`DR_DRILL_ANNUAL_V7_2026.md`](../operations/DR_DRILL_ANNUAL_V7_2026.md),
establishing **RTO ≤ 2h**. It carries any prior-cycle open gaps (R2 snapshot cadence, D1 restore
escalation path) forward with explicit GA disposition and owners. The next full drill is **pre-v8.0**.

## Consequences

**Positive.** v7.0 GA ships with a single, queryable certification surface and an honest, bounded
evidence bundle; the federation trust boundary (the only new boundary of the arc) is certified
with a real scale/isolation proof rather than an assertion; integrators get a no-action, no-break
v6.x sunset notice; XR's speculative surface is cleanly isolated behind a flag and excluded from
the certified claim.

**Negative / accepted.** "Certification" is self-attestation, not third-party authorization —
positioning must remain disciplined (CI-gated via `npm run check:compliance-claims`). The v6.x
maintenance window (through 2029-11-03) is a 24-month support commitment. AAA remains a bounded
("partial") claim by design. XR beta ships uncertified, which means its surface carries explicit
"beta" labelling obligations and is not covered by GA SLAs.

**Do-not-co-land (carried).** Per the S85–S99 architecture notes, ADR-0062 (scale/isolation
proof) and ADR-0063 (v7.0 cert) are deliberately one sprint apart (S97 vs S99) — scale evidence is
an *input* to certification, not bundled with it. v7.0 GA introduces **no new feature GA** that
would violate the arc's no-co-land pairs — it is a certification/release sprint; CONNECT and STUDIO
reached GA in earlier, separated sprints (S97 vs S96).

### Backend platform-endpoint changes (`functions/api/routes/platform.ts`)

`qesto-backend` must wire the platform endpoints to match this ADR. Required changes (handler
data only — no new trust logic):

1. **`/version`** — flip GA contract to `api: '7.0.0'`; `publicApi` map unchanged
   (`v1: 'deprecated', v2: 'maintained', v3: 'ga'`).
2. **`/certification`** — set `certifiedVersion: '7.0.0'`; add `pentest6: 'complete'`; add
   `isolationProof: 'verified'`; keep `soc2Type2: 'closed'`, `soc2AnnualEvidence: '2026'`,
   `drDrillRtoHours: 2`, `aaaConformance: 'partial'`, `fedRampAto: 'path_documented'`,
   `sovereignTier: 'available'`; repoint
   `deprecationPolicy: 'knowledge-base/adr/ADR-0063-v7-platform-certification.md'`. Do **not** add
   any `xr*` certification field — XR is excluded from the certified claim.
3. **Add `/v6-sunset`** — `currentGa: '7.0.0'`, `v6MaintenanceEnd: '2029-11-03'`,
   `v5MaintenanceEnd: '2028-12-31'`, `v4MaintenanceEnd: '2028-09-16'`, `v3End: '2027-12-31'`,
   `notice: 'Sunset-Date headers on deprecated API versions; v6.x enters maintenance at v7.0 GA'`,
   `policyDoc: 'knowledge-base/adr/ADR-0063-v7-platform-certification.md'`. Keep `/v5-sunset` and
   `/v4-sunset` for back-compat (they remain accurate).
4. **`/releases`** — append the `7.0.0` / S99 GA row (`status: 'ga'`) to `RELEASES`; the existing
   `7.0.0-rc.1` / `7.0.0-rc.2` rows are retained.
5. **No code edited by the architect** — the backend agent owns these handler-data changes; this
   ADR is the contract they implement.

## References

- [`SPRINT85_99_PLAN.md`](../product/planning/SPRINT85_99_PLAN.md) §S99 (release map, ADR-0063 row, gates), §Pentest #6, §DR/AAA gates
- [`SPRINT91_99_STORIES.md`](../product/planning/SPRINT91_99_STORIES.md) (CONNECT/STUDIO/XR stories, `QA-CONNECT-SCALE-01`)
- [ADR-0062](./ADR-0062-federation-trust-isolation-model.md) (CONNECT federation trust + cross-tenant isolation proof — certification input)
- [ADR-0060](./ADR-0060-analytics-insight-intelligence.md) (PULSE/STUDIO AI authoring, eval-gated)
- [ADR-0066](./ADR-0066-xr-spatial-session-beta.md) (XR beta — flagged, uncertified)
- [ADR-0053](./ADR-0053-v6-platform-certification.md) (v6.0 certification — direct precedent)
- ADR-0052 (FedRAMP full-ATO + sovereign), ADR-0050 (embed + Amendment 1), ADR-0043 (FedRAMP path)
- `functions/api/routes/platform.ts` (`/version`, `/releases`, `/certification`, `/v6-sunset`, `/v5-sunset`)
- Hard rule: `npm run check:compliance-claims` gates all public certification/compliance copy
