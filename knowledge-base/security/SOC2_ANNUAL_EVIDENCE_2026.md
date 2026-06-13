---
id: SOC2_ANNUAL_EVIDENCE_2026
type: security
domain: security
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - soc2
  - compliance
  - evidence
  - annual-refresh
  - v6.0
relates_to:
  - SOC2_EVIDENCE
  - SOC2_TYPE1_STATUS
  - SOC2_TYPE2_ROADMAP
  - SEC_PEN5_01_RESULTS
  - SEC_V60_RC_GATE
  - SECRET_ROTATION_POLICY
---

# SOC 2 Annual Evidence Refresh — v6.0 Cycle (2026)

**Story:** COMPLIANCE-SOC2-ANNUAL-01 · **Cycle:** v6.0 (2026) · **Owner:** security + platform lead
**Date:** 2026-06-13 · **Cadence:** annual refresh (interim monthly per `SOC2_TYPE2_ROADMAP.md`)

> **WHAT THIS IS — read first.** This is an **internal evidence-tracking artifact** that records which SOC 2
> control evidence was refreshed during the v6.0 cycle and which items remain open. It is **NOT** an auditor's
> report, **NOT** a SOC 2 attestation, and does **NOT** assert that Qesto holds a SOC 2 certificate. No SOC 2
> Type I or Type II attestation has been granted as of this date — see `SOC2_TYPE1_STATUS.md` (target certificate
> 2026-12-31) and `SOC2_TYPE2_ROADMAP.md` (target 2027 Q3). All control "status" values below describe the state of
> **implementation and internally-collected evidence**, not an external opinion. Public/marketing compliance claims
> are CI-gated (`npm run check:compliance-claims`) and must reference on-disk evidence under
> `knowledge-base/security/`.

This refresh stays consistent with and supersedes nothing in the source-of-truth control inventory
(`SOC2_EVIDENCE.md`, COMPLIANCE-01); it is the v6.0-cycle snapshot layered on top of it.

---

## 1. Control inventory status snapshot — v6.0 cycle

Mapped to the COMPLIANCE-01 control inventory in `SOC2_EVIDENCE.md`. Status = implementation + evidence state.

| TSC area | Control | v6.0 status | Notes / change since COMPLIANCE-01 |
|---|---|---|---|
| **CC6.1** | Authentication on all routes | ✓ Implemented | JWT magic-link + SAML SSO; `authMiddleware` on `/api/*`. No change. |
| **CC6.2** | Access provisioning / deprovisioning | ✓ Implemented | Team invite/remove + token revocation. No change. |
| **CC6.3** | RBAC | ✓ Implemented | `BUILTIN_ROLE_PERMISSIONS` + `rbacMiddleware`. No change. |
| **CC6.6** | Encryption in transit | ✓ Implemented | TLS 1.2+, WSS. No change. |
| **CC6.7** | Encryption at rest | ⚠ Partial → improved | D1/KV encrypted at rest by Cloudflare; integration tokens via EncryptedTokenStore / `OAUTH_TOKEN_MEK`. Tracked against COMPLIANCE-02. |
| **CC6.8** | Security-event monitoring | ✓ Implemented | `audit_log` D1 table; `safeLogContext()` PII sanitisation (CI gate). |
| **CC7.1** | Malware / vuln monitoring | ✓ Platform | Cloudflare WAF; GitHub Dependabot. |
| **CC7.2** | Anomaly detection | ✓ Implemented | Analytics Engine rate-limit, circuit-breaker-open, `error.api` events. |
| **CC7.3** | Incident response | ✓ Documented | Runbooks in `knowledge-base/operations/incidents/`. |
| **CC7.4** | Breach notification | ⚠ Gap (carried) | GDPR Art. 33 72h commitment documented; runbook still being finalised. |
| **CC8.1** | Authorised changes only | ✓ Process | PR review required; `wrangler` deploy gated on CI. |
| **CC8.2** | Regression testing before prod | ✓ Implemented | Full unit suite green (1774 tests this cycle per S89 handoff), `tsc` clean, AI eval 86 green. |
| **CC8.3** | Rollback capability | ✓ Implemented | Pages revision rollback; feature flags; circuit-breaker reset via KV delete. |
| **CC9.1** | Risk assessment | ✓ Addressed | Pentest #5 (3-surface) completed; see §2 + `SEC_PEN5_01_RESULTS.md`. |
| **CC9.2** | Vendor risk management | ✓ Documented | Sub-processor registry refreshed §4. |
| **A1.1** | Availability commitments | ✓ Implemented | Cloudflare Workers SLA; circuit breakers (Stripe/Resend/AI/JWKS). |
| **A1.2** | Capacity planning | ✓ Implemented | SessionRoom participant cap; token-bucket + KV rate limits, now extended to the embed read plane (§2 / PEN5-E1). |
| **A1.3** | Environmental protection | ✓ Platform | Cloudflare global network; DO geographic distribution. |
| **P1.1–P8.1** | Privacy controls | ✓ Implemented / Documented | Privacy notice, consent posture, voter-id hashing, retention TTLs, GDPR delete, PII-violation monitoring. No regression this cycle. |

No control regressed during the v6.0 cycle. Encryption-at-rest (CC6.7) and breach-notification runbook (CC7.4) remain
the two carried partial/gap items (see §5).

---

## 2. Evidence refreshed this period (v6.0 cycle)

Each item below cites a real on-disk artifact or shipped code.

| Evidence area | Artifact (on-disk) | What was refreshed |
|---|---|---|
| **Secret rotation** | `knowledge-base/security/SECRET_ROTATION_POLICY.md` | Rotation schedule + categories reviewed (high-risk 90-day cadence). Policy remains active; confirms CC6.7 / CC8 secret-handling posture. |
| **Disaster recovery drill** | `knowledge-base/operations/DR_DRILL_V6_2026.md` *(parallel deliverable this cycle — referenced; confirm on merge)* | v6.0-cycle DR drill record for availability (A1.x) and recovery evidence. Cross-referenced here as the cycle's DR evidence; this doc does not author it. |
| **Circuit breakers** | Implemented controls (Stripe/Resend/AI/JWKS) surfaced as AE `circuit_breaker` open events | A1.1 availability + CC7.2 anomaly-detection evidence; breaker-open events observable in Analytics Engine. |
| **PII gate** | `safeLogContext()` + PII-sanitisation CI gate; embed read plane structurally aggregate-only (`embedWidgetRepository.ts` COUNT/GROUP BY accessors) | CC6.8 / P8.1 — confirms no per-participant identifier crosses logging or the embed boundary. Verified in Pentest #5 (PE-1 de-anon STRUCTURALLY CLOSED). |
| **Penetration test** | `knowledge-base/security/SEC_PEN5_01_RESULTS.md` + `SEC_V60_RC_GATE.md` | Pentest #5 (governance / embed / agent) completed: overall **crit/high = 0**. EMBED carry-forwards E1/E3/E4 closed in shipped code; CC9.1 risk-assessment evidence for the cycle. |
| **Change-management / regression** | S89 build handoff (unit suite 1774 green, `tsc` clean, AI eval 86 green, build green) | CC8.2 regression-testing-before-prod evidence for the v6.0-rc gate. |

---

## 3. Pentest #5 outcome (CC9.1 evidence anchor)

- Surfaces tested: governance (DELIBERATE), embed widget API, agent/copilot runtime.
- **Overall Critical = 0, High = 0 (sustained).** Source: `SEC_PEN5_01_RESULTS.md`.
- EMBED carry-forwards closed in shipped code this cycle: PEN5-E1 (read-plane rate limit), PEN5-E3 (handshake re-pin),
  PEN5-E4 (opaque token-failure reason). Regression coverage: `tests/unit/embed-rate-limit.test.ts`.
- v6.0-rc security gate: **CLEAR** (`SEC_V60_RC_GATE.md`).
- Open from pentest (none gating, tracked): PEN5-E2 (tenancy-model architecture decision, carried to ADR review — a
  model divergence, not a data leak) and Lows PEN5-D1 (ops secret), PEN5-D3, PEN5-D4, PEN5-A2 (backlog).

---

## 4. Sub-processor registry status

Registry source of truth: `SOC2_EVIDENCE.md` §"Sub-Processor Registry". Status this cycle: **no new sub-processor added**;
the v6.0 embed and agent surfaces introduce **no new external processor** (Workers AI is Cloudflare-internal; the embed
read plane is first-party). All listed processors retain accepted DPAs.

| Sub-processor | Purpose | DPA status | v6.0-cycle change |
|---|---|---|---|
| Cloudflare | Runtime, DO, D1, KV, R2, AE, Workers AI | Accepted | None |
| Resend | Transactional email | Accepted | None |
| Stripe | Payments | Accepted (PCI DSS) | None |
| Slack *(opt-in)* | Aggregate result notifications | Accepted | None |
| Microsoft *(opt-in)* | Aggregate result notifications | Accepted | None |

Data-minimisation note (unchanged): integration providers receive only session titles + aggregate vote counts — never
participant identifiers, raw responses, or emails.

---

## 5. Open items with owners

| Item | Control | Owner | Status / target |
|---|---|---|---|
| Integration token encryption-at-rest completion (EncryptedTokenStore `TODO`) | CC6.7 | qesto-backend + security | Carried (COMPLIANCE-02) |
| Breach-notification runbook (GDPR Art. 33, 72h) finalisation | CC7.4 | qesto-devops + security | Carried gap |
| External auditor engagement for Type I | — | platform lead | Open — target certificate 2026-12-31 (`SOC2_TYPE1_STATUS.md`) |
| Production key-rotation drill record | CC6.7 / CC8 | qesto-devops | Tracked against `SECRET_ROTATION_POLICY.md` |
| DR drill record merge (`DR_DRILL_V6_2026.md`) | A1.x | qesto-devops | Parallel deliverable this cycle — confirm reference on merge |
| PEN5-E2 tenancy-model ADR decision | CC9.1 / CC6 | qesto-architect + PO | Open (architecture decision; not a leak, not RC-gating) |
| Type II 6-month evidence window | all | security | Future — 2027 Q1–Q2 per `SOC2_TYPE2_ROADMAP.md` |

---

## 6. Defensibility notes

- All "status" entries describe **internal implementation/evidence state**, not an external auditor opinion.
- No claim in this document asserts a granted SOC 2 certificate or attestation.
- Public compliance claims live only where the CI gate (`scripts/check-compliance-claims.mjs`, scanning `src/pages`)
  can cross-check them against on-disk evidence; this internal artifact does not introduce any public claim.
- Where evidence is authored by a parallel deliverable (`DR_DRILL_V6_2026.md`), it is referenced, not asserted as
  complete, until merged.
