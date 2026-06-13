---
id: FEDRAMP_ATO_FULL_PATH
type: security
domain: security/compliance
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - fedramp
  - ato
  - sovereign
  - gov-cloud
  - s89
relates_to:
  - ADR-0052
  - ADR-0043
  - SOC2_EVIDENCE
  - EU_DATA_RESIDENCY
  - DR_DRILL_V6_2026
---

# FedRAMP Moderate — Full ATO Path (FEDRAMP-ATO-FULL-01)

> **Honesty banner (mandatory).** This is a **path / target** document. Qesto **does not hold a
> FedRAMP Authorization-To-Operate (ATO)**, is **not** listed on the FedRAMP Marketplace, and makes
> **no claim** of FedRAMP authorization. An ATO is granted by a federal Authorizing Official (AO)
> only after a Third-Party Assessment Organization (3PAO) assessment. Every forward-looking
> statement below is labelled **target / path** and describes the architecture and evidence Qesto
> would assemble to *pursue* an ATO — never an achieved authorization. Product compliance copy is
> CI-gated (`npm run check:compliance-claims`); this document holds itself to the same bar.

This is the practical companion to [`ADR-0052`](../adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md),
which holds the architectural decision (boundary, inheritance split, sovereign data plane). Read
ADR-0052 first. This doc is the operational checklist: target baseline, boundary, a control-family
readiness table mapped to existing Qesto evidence, the POA&M, and 3PAO engagement prerequisites.

## 1. Target baseline & scope

| Item | Value (target) |
|---|---|
| Framework | NIST SP 800-53 controls, **FedRAMP Moderate** baseline (~325 controls — the set ADR-0043 mapped) |
| Impact level | Moderate (not High — High is out of v6.0-rc scope, ADR-0052 §Alternatives) |
| Story | `FEDRAMP-ATO-FULL-01` (E89, S89, release **v6.0-rc**) |
| Current status | **Path / boundary design only.** `GET /api/platform/fedramp-path` reports `status: documentation_only`. No granted ATO. |
| Inheritance source | Cloudflare's FedRAMP-authorized edge (IaaS/PaaS) — *to the extent the services/regions used are in their authorization scope* (POA&M item) |
| Evidence reuse | SOC 2 Type II (`SOC2_EVIDENCE.md`, `SOC2_TYPE_II_EVIDENCE/`) |

## 2. Authorization boundary (summary)

See ADR-0052 §1 for the full text diagram. In brief, the boundary contains: Cloudflare Pages
(assets + Functions/Hono API), the `SessionRoom` Durable Object, D1 (`DB`/`DB_EU`/sovereign
`DB_GOV`), KV stores, R2, Analytics Engine, and **Workers AI (`@cf/*` only)**. Interconnections
*outside* the boundary are limited to **Resend** (email) and **Stripe** (billing), both
data-minimized with DPAs in the SOC 2 sub-processor registry. There is **no third-party AI / ASR /
MT / external-analytics processor** (hard rule #1) — a deliberate decision that shrinks the
data-flow diagram and external-connection inventory a 3PAO must trace.

## 3. Control-family readiness (mapped to existing evidence)

Status legend: **Mapped** = control documented & evidence exists; **Partial** = evidence exists with
a known gap (→ POA&M §4); **Path** = target design, evidence to be authored; **Inherited** =
satisfied by Cloudflare's authorization (confirm scope, POA&M). All statuses are **path/target
readiness**, not assessor-confirmed.

| Family | Representative controls | Qesto evidence (cite real files) | Readiness |
|---|---|---|---|
| **AC** Access Control | AC-2/3/6 (account mgmt, RBAC, least privilege) | `authMiddleware`/`rbacMiddleware`/`BUILTIN_ROLE_PERMISSIONS` (SOC2 CC6.1/6.2/6.3, `SOC2_EVIDENCE.md`); sovereign data-plane isolation (ADR-0052 §3) | Mapped |
| **AU** Audit & Accountability | AU-2/3/6/12 (auditable events, content, review) | `audit_log` D1 table + Analytics Engine with `safeLogContext()` PII sanitization (ADR-0009; SOC2 CC6.8) | Mapped |
| **IA** Identification & Authn | IA-2/5/8 (user authn, authenticators, federation) | Magic-link JWT + SAML SSO (`auth.ts`); SOC2 CC6.1 | Mapped |
| **SC** System & Comms Protection | SC-7 (boundary), SC-8/13 (transit crypto/FIPS), SC-28 (at-rest) | TLS 1.2+/WSS (inherited transport); D1/KV encrypted at rest; **token-encryption gap** (SOC2 CC6.7 — `EncryptedTokenStore`); FIPS-validated crypto **inherited** from Cloudflare (confirm boundary) | Partial |
| **SI** System & Info Integrity | SI-2/4/10 (flaw remediation, monitoring, input validation) | Zod input validation; circuit breakers (ADR-0007); PII sanitization (ADR-0009); pentest program (`PENTEST_5_PREP.md`, `SEC_PEN5_01_RESULTS.md`) | Mapped |
| **CP** Contingency Planning | CP-2/4/9/10 (plan, test, backup, recovery) | Annual DR drill `DR_DRILL_V6_2026.md` (S89); `MULTI_REGION_RUNBOOK.md`, `MULTI_REGION_DRILL_CHECKLIST.md`; `GET /api/platform/dr-readiness` | Path → evidence on DR drill completion |
| **IR** Incident Response | IR-4/6/8 (handling, reporting, plan) | `knowledge-base/operations/incidents/` runbooks; `OPS_RUNBOOKS_V3.md`; SOC2 CC7 | Mapped |
| **CM** Configuration Mgmt | CM-2/3/6 (baseline, change control, settings) | `wrangler.toml` env matrix; secrets via `wrangler pages secret put` (`SECRET_ROTATION_POLICY.md`); SOC2 CC8 | Mapped |
| **CA** Assessment & Authorization | CA-2/5/6 (assessment, POA&M, authorization) | This doc (POA&M §4); **SSP authorship + 3PAO assessment = Path** (§5) | Path |
| **MP / PE** Media / Physical | MP-*, PE-* | **Inherited** from Cloudflare's FedRAMP-authorized datacenters | Inherited (confirm scope) |
| **Privacy / GDPR overlap** | (FedRAMP privacy controls; SP 800-53 PT/PII) | `GDPR_DATA_SUBJECT_RUNBOOK.md`; `EU_DATA_RESIDENCY.md`; data minimization (`SOC2_EVIDENCE.md`); `SECURITY_FULL.md` | Mapped |

## 4. POA&M (Plan of Action & Milestones)

The POA&M is the FedRAMP artifact tracking residual gaps with owner and target. Every row is a
**path item** — open work, not a completed control.

| # | Gap | Family | Owner (role) | Target sprint | Note |
|---|---|---|---|---|---|
| 1 | Confirm Cloudflare FedRAMP authorization scope per service & region used | SC/PE/MP | devops | S89 | Inheritance is only as strong as Cloudflare's in-scope authorization; gather their authorization package references |
| 2 | Integration token encryption-at-rest (`EncryptedTokenStore` plaintext) | SC (CC6.7) | backend | S89→S90 | Carried unchanged from `SOC2_EVIDENCE.md` CC6.7 gap |
| 3 | Provision dedicated sovereign-region D1 (`DB_GOV`); one-way, no migration | SC/CM | devops | S89 | `SOVEREIGN-TIER-01`; irreversible per ADR-0036/`EU_DATA_RESIDENCY.md` |
| 4 | Hard sovereign write-block + `db.sovereign_violation` AE event | AC/SC | backend | S89 | Extends `assertResidencyAllowsMutation()` (`lib/residency-enforce.ts`) |
| 5 | Sovereign federation-exclusion **hard D1 constraint** | AC/SC | architect | S94+ | Deferred to CONNECT / ADR-0057 (`CONNECT-SOVEREIGN-01`); recorded now so federation schema is built around it |
| 6 | Annual DR drill evidence (gov RTO/RPO) | CP | devops | S89 | `DR_DRILL_V6_2026.md` (CP-4/9/10 evidence) |
| 7 | SSP authorship (System Security Plan) | CA | security | post-S90 | Prerequisite for any 3PAO engagement (§5) |
| 8 | 3PAO engagement | CA | security + product-owner | post-S90 | The authorization step that is **not** in Qesto's unilateral control |
| 9 | FIPS 140 validated-crypto attestation for gov | SC | devops | S89→S90 | Inherited from Cloudflare; confirm validation boundary covers the services used |

## 5. 3PAO engagement prerequisites

A 3PAO assessment is the gate to any real ATO and is **not yet engaged**. Prerequisites Qesto must
satisfy *before* engaging a 3PAO (all **path** items):

1. **System Security Plan (SSP)** authored against the FedRAMP Moderate baseline, using the boundary
   in ADR-0052 §1, the control table §3, and the inheritance split (Cloudflare-inherited vs.
   Qesto-owned vs. shared). POA&M §4 #7.
2. **POA&M closed or accepted** for assessment-blocking items (§4) — notably the sovereign data-plane
   provisioning (#3/#4) and the Cloudflare-scope confirmation (#1). Residual low-risk items may
   remain on the POA&M at assessment time per FedRAMP norms.
3. **Evidence package assembled** from SOC 2 reuse (§3) plus FedRAMP-specific artifacts (DR drill
   evidence, sovereign isolation proof, FIPS attestation).
4. **Sponsorship path identified** — FedRAMP requires either an agency sponsor (Agency ATO) or the
   JAB path. Identifying a sponsor is a GTM/sales prerequisite, not an engineering one, and is a
   precondition we do **not** assert as met.

Only after a 3PAO completes its assessment and an AO issues an authorization would Qesto hold an
ATO. Until then, all surfaces — this doc, ADR-0052, `GET /api/platform/fedramp-path` — report a
**path / documentation** status, never `authorized` or `certified`.

## 6. Sovereign tier quick reference

Full design in ADR-0052 §3. Operationally, a sovereign tenant (`is_sovereign = true`):

- Lives in a **dedicated region-pinned D1** (`DB_GOV`), region chosen at creation, **never migrated**.
- Has writes **hard-blocked** outside its sovereign region (`db.sovereign_violation` AE), with **no
  cross-region replication**.
- Is **excluded from all egress**: Slack/Teams connectors, embed public-read plane (ADR-0050),
  marketplace data-out, cross-session insight aggregation that would leave the plane.
- Is **permanently excluded from cross-tenant federation** — a hard D1 constraint owned by ADR-0057
  (CONNECT, S94+).

## References

- [`ADR-0052`](../adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md) — the decision (boundary,
  inheritance split, sovereign data plane, alternatives).
- [`ADR-0043`](../adr/ADR-0043-fedramp-moderate-path.md) — FedRAMP Moderate control mapping (path-only,
  S79); `functions/api/routes/platform.ts:130` (`GET /api/platform/fedramp-path`).
- [`SOC2_EVIDENCE.md`](./SOC2_EVIDENCE.md) — control inventory & sub-processor registry (primary
  evidence reuse; CC6.7 token gap → POA&M #2).
- [`EU_DATA_RESIDENCY.md`](./EU_DATA_RESIDENCY.md) — D1 region irreversibility (sovereign-tier basis).
- [`SECRET_ROTATION_POLICY.md`](./SECRET_ROTATION_POLICY.md) — CM evidence (secrets handling).
- [`GDPR_DATA_SUBJECT_RUNBOOK.md`](./GDPR_DATA_SUBJECT_RUNBOOK.md) — privacy/GDPR overlap evidence.
- [`SECURITY_FULL.md`](./SECURITY_FULL.md) — consolidated security posture.
- [`DR_DRILL_V6_2026.md`](../operations/DR_DRILL_V6_2026.md) — S89 annual DR drill (CP-family evidence;
  authored by the parallel S89 DR-drill workstream).
- ADR-0007 (circuit breakers — SI/CP), ADR-0009 (PII sanitization — AU), ADR-0050 (embed plane —
  sovereign-excluded), ADR-0057 (CONNECT federation — owns sovereign federation-exclusion, S94+).
- `knowledge-base/product/planning/SPRINT85_99_PLAN.md` (E89; S89 row :229) and
  `knowledge-base/product/backlog/BACKLOG_MASTER.md` (`FEDRAMP-ATO-FULL-01` :1743,
  `SOVEREIGN-TIER-01` :1744).
