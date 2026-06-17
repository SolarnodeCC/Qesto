---
id: ADR-0059
status: accepted
created: 2026-08-14
accepted: 2026-08-14
deciders: architect, product-owner, security, dpo
relates_to: ADR-0058, ADR-0050, ADR-0062, SPRINT85_99_PLAN, SPRINT91_99_STORIES
---

# ADR-0059: Ecosystem Depth — Extension Data Contracts & Partner Egress Governance

## Status

Accepted (S94). Governs every path where Qesto data **leaves the platform boundary** to a
third party — LMS grade passback (E94 LEARN), the verifiable audit export (E95 SOVEREIGN+),
and the partner/extension egress surfaces that CONNECT (E96, S95+) and STUDIO (E97, S96+)
will open. Prepares the Pentest #6 egress-governance scope (run S95–S96, closed by S97).

## Context

Until S94 every Qesto feature was inbound or self-contained. S94 opens the first deliberate
**data-out** paths:

- **LMS grade passback (LEARN-GRADE-01):** an assessment score is POSTed to an LMS-owned
  outcomes endpoint.
- **Audit export (SOVEREIGN-AUDIT-API-01):** a compliance audit log is handed to a tenant's
  scoped third-party auditor.

S95+ widens this further with cross-tenant federation (CONNECT) and AI authoring (STUDIO).
Egress is the highest-risk surface in the v7.0 arc, so its governance must be decided **once,
now**, as a shared contract — not re-litigated per feature. Two non-negotiables frame it:

1. **Sovereign exclusion is absolute.** A sovereign tenant (ADR-0058) must never egress data
   to a partner or join cross-tenant federation — enforced as a hard boundary, not a setting.
2. **Egress must be traceable.** Every byte that leaves the boundary is audit-logged with
   enough context for a DPO to answer "what left, to whom, when, on whose authority".

## Decision

### 1. Egress is gated by a single pure boundary

`lib/sovereign-exclusion.ts` owns the decision. `assertEgressAllowed(config)` and
`assertFederationAllowed(config)` return a typed `{ ok }` / violation that every egress and
federation call site MUST deny on — no call site re-implements the rule. Sovereign tenants
and tenants with an explicit `egressOptOut` are denied. The federation-eligibility D1 query
also ANDs `FEDERATION_ELIGIBLE_SQL_FRAGMENT` so the exclusion holds at the query layer even
if an app-layer guard is missed (defence in depth for CONNECT-SOVEREIGN-01, S96).

### 2. Outbound integrations are signed and body-bound

LMS grade passback (`lib/lms-grade-passback.ts`) signs each POST with OAuth 1.0a **body-hash**
(`oauth_body_hash = base64(sha1(body))`), reusing the OAuth primitives from `lib/lti.ts`. The
signature binds the exact POX body, so a tampered score cannot be replayed. Network failures
and non-success POX codes return a typed failure (the caller audits + may retry); the helper
never throws.

### 3. Exported data is tamper-evident and provenance-signed

The audit export (`lib/sovereign-audit-export.ts`) is a hash chain
(`chainHash = sha256(prevHash + canonical(entry))`) signed with HMAC-SHA256 over the chain
head, team id, region, entry count, and timestamp. A third party can verify integrity
(no reorder/insert/delete) and provenance (correct team + region) offline. Scope is decided
by the route (team-owner only, session subjects) and never widened downstream.

### 4. Every egress is audit-logged

New audit actions `learn.grade.passback` and `sovereign.audit.export` capture each data-out
event with its outcome and a non-PII snapshot (score fraction + sourcedId, or region + entry
count + chain head). This is the DPO-readable trail Pentest #6 will audit.

## Consequences

- **Positive:** one egress decision point; sovereign exclusion is structurally impossible to
  bypass; exported/pushed data is cryptographically verifiable; full audit trail before any
  federation surface opens.
- **Cost:** egress call sites must thread `SovereignTenantConfig`; the audit-export signing key
  (`SOVEREIGN_AUDIT_SIGNING_KEY`) and LTI credentials must be provisioned (DevOps) or the
  surfaces fail closed (503).
- **Follow-up (S95–S97):** CONNECT join (CONNECT-SOVEREIGN-01) and STUDIO authoring egress
  must call the same guards; Pentest #6 validates no egress path bypasses them.

## Compliance / security notes

- Fail-closed everywhere: unconfigured signing key or LTI credentials ⇒ 503, never an
  unsigned export or an unsigned passback.
- No PII in egress observability events — score fractions and entry counts only.
- Sovereign hard boundary re-confirmed against ADR-0058 `assertSameRegion`.
