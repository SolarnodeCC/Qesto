---
id: SECURITY_AUDIT_BACKLOG
type: security
domain: security
category: audit-follow-ups
status: active
version: 1.0
created: 2026-07-09
updated: 2026-07-09
tags:
  - security
  - audit
  - backlog
  - follow-ups
relates_to:
  - SECURITY_AUDIT_2026-07-08
  - BACKLOG_ACTIVE
  - BACKLOG_MASTER
---

# Security Audit Follow-up Backlog (2026-07-08)

**Audit Date**: 2026-07-08  
**Audit Report**: [`SECURITY_AUDIT_2026-07-08.md`](./SECURITY_AUDIT_2026-07-08.md)  
**Status**: All HIGH and MEDIUM findings **FIXED and shipped** in PR #712 (commit `0b47f38`, merged to `main` 2026-07-09).

---

## Remediation Summary

| Finding | Severity | Status | PR | Evidence |
|---|---|---|---|---|
| RBAC middleware is a no-op in production | HIGH | ✅ FIXED | #712 | `softAuthMiddleware` populates principal at parent `/api/*` before `rbacMiddleware`; RBAC hard-enforces platform-admin, defers team routes to in-route checks (`middleware/auth.ts`, `middleware/rbac.ts`, `app.ts`) |
| LDAP routes accept arbitrary `teamId` (cross-tenant IDOR) | HIGH | ✅ FIXED | #712 | `requireLdapTeamAdmin` gate on `/sync`, `/group-map`, `/filter`; verifies `team:manage_auth` on target team + Enterprise plan (`routes/ldap.ts`) |
| CSP allows `script-src 'unsafe-inline'` | MEDIUM | ✅ FIXED | #712 | Theme bootstrap extracted to `public/theme-bootstrap.js` (same-origin external file); `'unsafe-inline'` removed from `script-src` in `public/_headers` |
| Stripe webhook replay window omitted | MEDIUM | ✅ FIXED | #712 | ±300 s timestamp tolerance + multi-`v1` signature comparison in `verifyStripeSignature` (`routes/billing.ts:432–469`) |

---

## Follow-up Items (LOW/INFO)

**All items below are documented in [`BACKLOG_ACTIVE.md`](../product/backlog/BACKLOG_ACTIVE.md) §Security Follow-ups (Audit 2026-07-08)** for PO prioritization in future release trains.

### SEC-SAML-VERIFY-01 (LOW, P1 — SAML GA blocker)

**Severity**: LOW (feature-gated fail-closed today)  
**Location**: `functions/api/lib/saml.ts:19–29`, `functions/api/routes/auth/saml.ts:32–51`, `wrangler.toml:93,95`  
**Current State**: SAML routes are disabled unless **both** `SAML_SSO_ENABLED` and `SAML_SIGNATURE_VERIFY_ENABLED` are `'true'`. Both default to `'false'` in `wrangler.toml`, failing closed on unset.

**Issue**: The SP does not verify the XML signature on `<saml:Assertion>`. A party who knows the entityID and target team could forge an unsigned assertion (CWE-347).

**Why Acceptable Today**: The gate is closed by default and well-documented. Enabling SAML GA requires shipping XML-DSig verification first.

**Remediation**: Before SAML GA, implement XML-DSig verification against an IdP-published signing certificate. Prefer certificate-based verification over the existing regex assertion parser (which is brittle against XML wrapping/comment tricks). Reference: existing backlog item #529.

**Backlog**: `SEC-SAML-VERIFY-01`, backlog priority **P1** (blocks SAML GA ship), horizon **TBD per product cadence**.

---

### SEC-APIKEY-LIMITER-ATOMIC-01 (LOW, P2 — soft quota)

**Severity**: LOW (bounded impact; soft quota, not security boundary)  
**Location**: `functions/api/middleware/public-api-auth.ts:52–67`

**Issue**: The 120-req/min per-API-key limit reads the KV counter, checks it, then writes `count+1` without atomicity. Concurrent requests in the same window can each read the same value and all pass. KV has no strong consistency, so the counter under-counts under burst.

**Why Acceptable**: This is an **abuse/cost control**, not a security boundary. Impact is bounded to modest quota overage under concentrated attack. The limit is soft and documented.

**Remediation**: If tighter enforcement is ever needed, back the counter with a Durable Object or Cloudflare's native rate-limiting binding. Accept as-is otherwise.

**Backlog**: `SEC-APIKEY-LIMITER-ATOMIC-01`, backlog priority **P2** (nice-to-have), horizon **conditional on abuse patterns**.

---

### SEC-DISPLAY-FRAMING-01 (LOW, P2 — monitoring only)

**Severity**: LOW (safe today; monitoring item)  
**Location**: `public/_headers` (`/display/*` rule)

**Issue**: Display pages are intentionally embeddable (PowerPoint Web Viewer, Canva iframe), so `frame-ancestors *` is by design. However, the headers carry mixed signals: `X-Frame-Options: SAMEORIGIN` conflicts with CSP `frame-ancestors *` (modern browsers honor CSP). Risk is minimal today because no state-changing controls render on `/display/*`.

**Why Acceptable**: The design is correct for read-only display pages. The risk emerges only if interactive/state-changing controls are ever added to display pages.

**Remediation**: If display pages ever gain interactive controls (e.g., presenter-controlled playback, voting), scope `frame-ancestors` to the specific embedding origins (e.g., `PowerPoint Online domain`, `Canva domain`) rather than `*`.

**Backlog**: `SEC-DISPLAY-FRAMING-01`, backlog priority **P2** (monitoring), horizon **if `/display/*` gains interactivity**.

---

### CSRF-INFO-01 (INFO — no action)

**Severity**: INFO (documented deliberate decision)  
**Location**: `functions/api/middleware/csrf.ts:74–99`

**Issue**: CSRF validation is permissive when both Origin and Referer headers are absent. The code includes a documented decision: a browser cross-site attacker **cannot** suppress Origin on a credentialed cross-origin fetch, so allowing the absence of both headers is safe for traditional browser callers.

**Residual Risk**: A cookie-bearing non-browser client (e.g., a desktop app, mobile native app, or IoT device) could make requests without Origin/Referer headers. This is mitigated by the fact that:
1. Qesto's primary UX is browser-first (SPA, WebSocket).
2. Non-browser callers should use API keys or bearer tokens, not session cookies.

**Why No Action Required**: The risk is documented and acceptable. The follow-up is conditional: if server-to-server cookie callers are ever added, re-evaluate and possibly add additional mitigations (e.g., a hardened endpoint allowlist or SameSite cookie attribute review).

**Backlog**: No backlog item needed; monitoring note only. If non-browser cookie callers are introduced in the future, review this section before shipping.

---

## Quality Baseline (Post-Remediation)

| Check | Status |
|---|---|
| **Critical findings** | ✅ 0 |
| **High findings** | ✅ 0 (2 fixed) |
| **Medium findings** | ✅ 0 (2 fixed) |
| **Low findings** | ✅ 4 documented (3 conditional, 1 soft quota) |
| **Info findings** | ✅ 2 documented (no action) |
| **All tests passing** | ✅ 2483/2483 Vitest |
| **TypeScript strict** | ✅ tsc --noEmit clean |
| **Build** | ✅ npm run build passing |
| **Deployment** | ✅ All changes merged to `main` (commit `0b47f38`) |

---

## Next Steps (PO Discretion)

1. **SEC-SAML-VERIFY-01**: Schedule XML-DSig implementation for SAML GA release train (currently blocked behind SAML_SSO_ENABLED feature gate).
2. **SEC-APIKEY-LIMITER-ATOMIC-01**: Monitor real-world abuse patterns; escalate to DO-backed counter if quota abuse observed.
3. **SEC-DISPLAY-FRAMING-01**: Add to tech-debt checklist; act if `/display/*` interactivity is ever planned.
4. **CSRF-INFO-01**: Review if non-browser session-cookie callers are ever added.

---

## References

- **Audit Report**: [`SECURITY_AUDIT_2026-07-08.md`](./SECURITY_AUDIT_2026-07-08.md)
- **Active Backlog**: [`knowledge-base/product/backlog/BACKLOG_ACTIVE.md`](../product/backlog/BACKLOG_ACTIVE.md) §Security Follow-ups (Audit 2026-07-08)
- **PR #712**: Merged 2026-07-09 (all HIGH and MEDIUM fixes)
- **OWASP Top 10 & CWE**: Cited in the audit report for each finding
