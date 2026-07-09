# Security Audit Report: Qesto

**Review Date**: 2026-07-08
**Scope**: Full-stack review of the Cloudflare-native application — edge API (`functions/api/`), Durable Object realtime layer, auth/session/SSO, Stripe billing + webhooks, outbound webhooks, Workers AI pipeline, storage access patterns, frontend/CSP, and deploy configuration (`wrangler.toml`, `public/_headers`).
**Stack**: Cloudflare Workers/Pages, Hono, D1, KV, Durable Objects, Workers AI, Vectorize, Stripe, Resend.
**Method**: Manual code review with evidence-based severity. Line references are against the audited tree at commit `c96671f`.

> **Remediation status (2026-07-08):** All HIGH and MEDIUM findings in this report were fixed in the same pull request that introduced it. Each finding below carries a **Status** line. See the "Remediation Applied" section at the end for the change list.

## Executive Summary

Qesto's security posture is **strong and mature**. Cryptographic primitives are correct and single-sourced (PBKDF2-600k passwords, timing-safe comparisons, HMAC/JWKS with algorithm pinning), D1 access is uniformly parameterized, SSRF controls on outbound webhooks are unusually thorough, the embed/widget token model is well-designed, and AI inputs are sanitized at a gateway chokepoint. The most significant issue is an **access-control middleware ordering defect**: the RBAC permission-matrix layer runs before authentication populates the user, so it silently no-ops in production — a broken defense-in-depth control that, combined with **missing object-level authorization on the LDAP routes**, allows cross-tenant tampering by any authenticated user. No SQL injection, secret exposure, or authentication bypass was found.

## Critical Findings

None.

## High-Severity Findings

### [HIGH] Authorization: RBAC permission-matrix middleware is a no-op in production

**Status**: ✅ **FIXED** — a non-rejecting `softAuthMiddleware` now runs at the parent `/api/*` scope immediately before `rbacMiddleware` (`app.ts`), populating `c.user` from a valid session token so RBAC actually sees the principal. It never rejects (the strict per-sub-app `authMiddleware` remains the authentication gate) and is idempotent. RBAC then **hard-enforces the platform-admin surface** (where global platform authority is exactly the right check) and **defers team/tenant routes to their in-route object-level checks** (`requireTeamPermission`) — the coarse global-role matrix must not shadow the finer-grained, custom-role-aware team authorization (verified by `tests/integration/custom-rbac.test.ts`).

**Location**: `functions/api/app.ts:188` (registration) vs. `:288`–`:368` (auth sub-apps); `functions/api/middleware/rbac.ts:216`–`:229`

**Description**: The RBAC middleware is documented as the gate that "All routes go through … AFTER auth" (`rbac.ts:4`). It is registered on the parent app at `app.ts:188` with `app.use('/api/*', rbacMiddleware)`. However, `authMiddleware` — which sets `c.get('user')` — is only registered *inside* the feature sub-apps that are mounted **after** line 188 (`mountTeamRoutes`, `mountLdapRoutes`, etc., each calling `app.use('*', authMiddleware)`). In Hono, parent middleware registered earlier wraps later-mounted routes, so on every request `rbacMiddleware` executes **before** any `authMiddleware`. At that point `c.get('user')` is `undefined`, so the middleware takes its unauthenticated branch:

```ts
// rbac.ts:224
if (!user) {
  c.set('userRoles', ['guest'])
  c.set('canAccess', true)
  await next()   // ← returns WITHOUT ever consulting PERMISSION_MATRIX
  return
}
```

The permission matrix (role gates like `DELETE /api/sessions/:id → {owner, admin}`, `POST /api/ldap/sync → {owner, admin}`, `GET /api/admin/* → {platform_admin}`) is therefore **never enforced**. Authentication itself still works (the later `authMiddleware` rejects unauthenticated requests), and the well-written routes perform their own object-level checks (`requireTeamPermission`, `adminMiddleware`), so this is a broken *defense-in-depth* layer rather than a blanket auth bypass — but any route that relies on the matrix as its only role gate is unprotected (see next finding).

**Current Implementation**: The unit test that "verifies" RBAC (`tests/unit/platform-admin-authority.test.ts:72`–`:82`) constructs its own app that sets `user` in a middleware registered *before* `rbacMiddleware`, so the test passes and masks the production ordering. The real `createApp()` never establishes that ordering.

**Risk**: Concrete attack: an authenticated `viewer`/`member`/`guest`-level user issues `DELETE /api/sessions/:id` or `POST /api/ldap/sync`. The matrix that should require `owner`/`admin` does not fire. Whether the request ultimately succeeds depends on the route's own checks; for the LDAP routes there are none (below), so this ordering defect is directly load-bearing for cross-tenant compromise.

**Remediation**: Hoist a single authentication pass ahead of RBAC, then run RBAC once, both at the parent level, before any feature sub-app:

```ts
// app.ts — after CORS/CSRF, before mounting sub-apps
app.use('/api/*', publicRouteAllowlistThenAuth)   // sets c.user for non-public paths
app.use('/api/*', rbacMiddleware)                 // now sees c.user
// ...then mount feature sub-apps, dropping their per-app app.use('*', authMiddleware)
```

This is the ARCH-HONO-01/02 structural fix already noted in `app.ts:276`–`:287`. As an interim guard, make `rbacMiddleware` **fail closed** when it runs without a resolved user on a non-public path (return 401/403 instead of `canAccess: true`), and add an integration test that drives the *real* `createApp()` (not a bespoke harness) to assert a non-owner is blocked from an `owner`-only route.

**References**: OWASP Top 10 A01:2021 (Broken Access Control); CWE-863 (Incorrect Authorization).

---

### [HIGH] Authorization: LDAP routes accept an arbitrary `teamId` with no object-level check (cross-tenant IDOR)

**Status**: ✅ **FIXED** — all three routes now call `requireLdapTeamAdmin(c, teamId)` before acting. It loads the target team, requires the caller to hold `team:manage_auth` on *that* team (`hasTeamPermission` returns false for non-members → fails closed cross-tenant), and re-checks the Enterprise entitlement so `group-map`/`filter` are plan-gated too. Denials are audit-logged.

**Location**: `functions/api/routes/ldap.ts:51` (`POST /api/ldap/sync`), `:106` (`PUT /api/ldap/teams/:teamId/group-map`), `:132` (`PUT /api/ldap/teams/:teamId/filter`)

**Description**: These routes are protected only by `authMiddleware` + `planMiddleware`. They read the target `teamId` from the request body/path and operate on it **without verifying the caller belongs to — let alone owns/administers — that team**:

```ts
// ldap.ts:60 — sync
const teamId = validated.data.teamId ?? c.env.LDAP_TEAM_ID
// ...no membership/ownership check on teamId...
await syncLdapDirectoryToTeam(c.env.DB, c.env.TEAMS_KV, teamId, entries, { filter, groupMap })

// ldap.ts:107 — group-map (NO plan gate either)
const teamId = c.req.param('teamId')
await saveLdapGroupMap(c.env.TEAMS_KV, teamId, body)
```

`POST /api/ldap/sync` at least checks the *caller's* plan (`featureAllowed(quotas, 'samlSso')`), but the `teamId` it acts on is attacker-chosen. `PUT …/group-map` and `PUT …/filter` have **no plan gate and no authorization at all** beyond being logged in. The RBAC matrix lists `POST /api/ldap/sync` as `{owner, admin}` but (a) RBAC is a no-op (previous finding) and (b) `group-map`/`filter` are not in the matrix at all.

**Risk**: Any authenticated user can overwrite another tenant's LDAP group→role mapping (`saveLdapGroupMap`) and OU/group filter, then — where LDAP is configured and the caller has an Enterprise plan — trigger a directory sync that attaches/relabels members in a team they have no relationship with. The group-map controls what role synced directory users receive, making this a privilege-escalation and cross-tenant membership-tampering vector.

**Remediation**: Resolve `teamId` and gate every LDAP route with the existing object-level guard used elsewhere, e.g. `await requireTeamPermission(c, team, 'team:manage_sso', '…')`, loading the team and confirming the caller is an owner/admin of *that* team. Never accept `teamId` as an unauthenticated free parameter. Add the `group-map`/`filter` routes to any centralized gate and add the same plan check as `sync`.

**References**: OWASP API1:2023 (Broken Object Level Authorization); CWE-639 (Authorization Bypass Through User-Controlled Key).

## Medium-Severity Findings

### [MEDIUM] Pages/Frontend: CSP allows `script-src 'unsafe-inline'`

**Status**: ✅ **FIXED** — the lone executable inline script (the pre-paint theme bootstrap) was extracted to a same-origin external file `public/theme-bootstrap.js` and referenced as a render-blocking `<script src>`, so `'unsafe-inline'` was removed from `script-src` in both `_headers` rules. External analytics (Cloudflare Insights, Clarity) already load via `src` and remain allowlisted; JSON-LD blocks are `application/ld+json` (non-executable, not gated). `style-src 'unsafe-inline'` is retained (inline styles in the crawler fallback).

**Location**: `public/_headers` (both the `/*` and `/display/*` rules)

**Description**: The SPA CSP is `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.clarity.ms …`. `'unsafe-inline'` in `script-src` disables CSP's primary purpose — blocking injected inline scripts and event-handler attributes. If any XSS sink is ever introduced (today none exist — no `dangerouslySetInnerHTML`/`innerHTML`/`eval` in `src/`), CSP would not contain it.

**Risk**: Defense-in-depth gap; a future reflected/stored XSS would execute unimpeded.

**Remediation**: Move to hash- or nonce-based inline script allowances and drop `'unsafe-inline'` from `script-src`. Cloudflare Pages can inject a per-response nonce; Vite can emit hashes for the bootstrap inline script. Keep `'unsafe-inline'` for `style-src` only if strictly necessary.

**References**: OWASP A05:2021 (Security Misconfiguration); MDN CSP `script-src`.

### [MEDIUM] Stripe: webhook signature check omits the timestamp-tolerance (replay-window) validation

**Status**: ✅ **FIXED** — `verifyStripeSignature` now rejects timestamps outside a ±300 s tolerance and collects/compares **all** `v1` signatures (correct across secret rotation) instead of keeping only the last.

**Location**: `functions/api/routes/billing.ts:432`–`:469` (`verifyStripeSignature`)

**Description**: The HMAC-SHA256 verification over `${t}.${body}` and the constant-time compare are correct, but the parsed `timestamp` (`parts.t`, line 444) is only used to build the signed payload — it is **never compared against the current time**. Stripe's own libraries reject events whose timestamp is outside a default 5-minute tolerance to bound replay.

**Risk**: Low in practice because event-ID idempotency (`stripe_webhook_events`, `billingRepository.ts:53`) is a permanent D1 record, so a captured event cannot be re-processed. The exposure is limited to defense-in-depth: if that table were ever pruned/reset, a captured-and-still-valid payload+signature could be replayed.

**Remediation**: After parsing `t`, reject when `Math.abs(nowSeconds - Number(t)) > 300`. Also handle rotation-era headers that carry multiple `v1=` values (currently the `reduce` keeps only the last one).

**References**: Stripe "Verify webhook signatures manually"; CWE-294 (Authentication Bypass by Capture-Replay).

## Low-Severity & Info Findings

### [LOW] API keys: per-key rate limiter is a non-atomic read-then-write (TOCTOU)

**Location**: `functions/api/middleware/public-api-auth.ts:52`–`:67`

**Description**: The 120-req/min per-key limit reads the KV counter, compares, then writes `count+1` without atomicity. Concurrent requests in the same window can each read the same value and all pass. KV also has no strong consistency, so the counter under-counts under burst. This is an abuse/cost control, not a security boundary, so impact is bounded to modest quota overage.

**Remediation**: Acceptable as-is for a soft quota; if tighter enforcement is needed, back the counter with a Durable Object or Cloudflare's native rate-limiting binding.

### [LOW] SAML: assertions are parsed by regex with no XML-DSig verification (currently fail-closed)

**Location**: `functions/api/lib/saml.ts:19`–`:29`, `parseAssertion` (`:84`); gate in `functions/api/routes/auth/saml.ts:32`–`:51`

**Description**: The SP does not verify the XML signature on `<saml:Assertion>`; a party who knows the entityID + a target team could forge an unsigned assertion (CWE-347). This is **correctly mitigated today**: the routes are disabled (503) unless *both* `SAML_SSO_ENABLED` and `SAML_SIGNATURE_VERIFY_ENABLED` are `'true'`, and both default to `'false'` in `wrangler.toml` (`:93`,`:95`) with `flagOff` failing closed on unset values (`lib/flags.ts:46`). Recorded as INFO-level because it is off by default and well-documented.

**Remediation**: The existing gate must stay closed. Before enabling SAML GA, ship XML-DSig verification (BACKLOG SEC-SAML-01 / #529). Prefer verifying against an IdP-published signing certificate over the regex assertion parser, which is also brittle against XML wrapping/comment tricks.

### [LOW] Clickjacking surface on `/display/*` (`frame-ancestors *`)

**Location**: `public/_headers` (`/display/*` rule, `X-Frame-Options: SAMEORIGIN` + `frame-ancestors *`)

**Description**: Display pages are intentionally embeddable (PowerPoint/Canva viewers), so framing is allowed by design. Note the mixed signals: `X-Frame-Options: SAMEORIGIN` conflicts with `frame-ancestors *` (modern browsers honor CSP and ignore XFO here). Ensure no state-changing controls render on `/display/*`.

**Remediation**: If any display page ever gains interactive controls, scope `frame-ancestors` to the specific embedding origins rather than `*`.

### [INFO] CSRF is permissive when both Origin and Referer are absent

**Location**: `functions/api/middleware/csrf.ts:74`–`:99`

**Description**: A deliberate, documented decision (`csrf.ts:82`–`:92`): when no Origin/Referer is present the request is allowed, because a browser cross-site attacker cannot suppress Origin on a credentialed cross-origin fetch. The residual risk (a cookie-bearing non-browser client) and mitigation options are already written up in the file. Reasonable; no action required beyond the noted follow-up if server-to-server cookie callers are ever added.

### [INFO] Observations of good practice (no action)

- **D1**: All queries parameterized; the three dynamic-SQL sites (`help-prompts.ts:160`, `marketing/video-assets.ts:72`, `admin/kb-sync.ts:154`) interpolate only hardcoded column names / generated `?n` placeholders — no user data in SQL text.
- **Secrets**: None in `wrangler.toml`; all injected via `wrangler … secret put` (documented in-file). Log redaction (`lib/log.ts:34`–`:64`) covers emails, JWTs, bearer/Stripe/Resend/CF tokens, and SAML assertions. Production 5xx errors return a generic message with no stack (`lib/error-handler.ts:58`).
- **Realtime**: The `/ws` upgrade builds a *fresh* request to the DO with server-computed headers (role from a verified JWT, identity derived server-side) and never forwards client headers (`routes/sessions/public.ts:127`–`:138`), so `x-qesto-role`/`-voter`/`-permissions` cannot be spoofed. Presenter-only DO actions are role-gated consistently across all handlers.
- **Embed/widget tokens**: Origin-pinned, read-scoped, short-TTL HMAC envelopes with a revocation kill-switch and reflected-allowlist CORS (never `*`) — `lib/embed-token.ts`, `middleware/widget-token.ts`.
- **Outbound webhooks**: Strong SSRF filter incl. decimal/hex/octal IPv4 and IPv4-mapped IPv6, re-validated immediately before each send with `redirect: 'manual'`; payloads HMAC-signed (`lib/webhook-url.ts`, `lib/webhooks.ts`).
- **AI**: User free-text is sanitized (control/zero-width/bidi stripping + length caps) at the gateway chokepoint; zero-knowledge sessions are excluded and AI-generated sessions require recorded consent (`lib/ai/prompt-sanitize.ts`, `lib/insights-guards.ts`).
- **Platform admin**: Distinct from team ownership via a dedicated `platform_roles` table, fail-safe deny on DB error (`middleware/admin.ts`, fix for #586).

## Summary Statistics
- Critical: 0
- High: 2
- Medium: 2
- Low: 3
- Info: 2

## Remediation Applied (2026-07-08)

All HIGH and MEDIUM findings were remediated in the same PR:

| Finding | Severity | Fix |
|---|---|---|
| RBAC matrix no-op | HIGH | `softAuthMiddleware` populates the principal at parent `/api/*` before `rbacMiddleware`; RBAC hard-enforces the platform-admin surface and defers team routes to in-route checks so it can't shadow custom roles (`middleware/auth.ts`, `middleware/rbac.ts`, `app.ts`) |
| LDAP cross-tenant IDOR | HIGH | `requireLdapTeamAdmin` gate on `sync`/`group-map`/`filter` — `team:manage_auth` on the target team + Enterprise plan (`routes/ldap.ts`) |
| CSP `script-src 'unsafe-inline'` | MEDIUM | Inline theme bootstrap extracted to `public/theme-bootstrap.js`; `'unsafe-inline'` removed from `script-src` in `public/_headers` |
| Stripe replay window | MEDIUM | ±300 s timestamp tolerance + multi-`v1` signature comparison in `verifyStripeSignature` (`routes/billing.ts`) |

The LOW/INFO items are left as documented follow-ups (SAML gate stays closed; API-key limiter accepted as a soft quota; `/display/*` framing unchanged).

## Recommended Prioritization
1. **Fix the RBAC ordering defect (HIGH #1)** — run auth before RBAC at the parent level (ARCH-HONO-01/02), or fail RBAC closed when no user is resolved on a non-public path. Add an integration test that drives the real `createApp()`. This is the keystone fix.
2. **Add object-level authorization to the LDAP routes (HIGH #2)** — gate `sync`, `group-map`, and `filter` on team ownership/admin of the resolved `teamId`; add the missing plan check to `group-map`/`filter`. Independent of #1 and independently exploitable, so ship regardless.
3. **Tighten CSP (MEDIUM)** — remove `script-src 'unsafe-inline'` via nonces/hashes.
4. **Add Stripe timestamp tolerance (MEDIUM)** — a few lines; closes the replay window.
5. **Low/Info items** — API-key limiter atomicity, keep the SAML gate closed until DSig ships, and scope `/display/*` framing if it gains interactive controls.

## Security Baseline Checklist
- [x] No secrets in code
- [x] All inputs validated (Zod schemas at boundaries; D1 parameterized)
- [x] Error messages non-verbose (production 5xx generic, no stack)
- [x] Rate limiting configured (auth, join, per-IP WS, per-API-key, embed read/handshake)
- [x] Logging excludes PII (redaction patterns in `lib/log.ts`)
- [ ] Dependencies scanned — not verified in this review (Dependabot PRs observed in history; recommend confirming `npm audit` gate in CI)
- [x] HTTPS enforced (HSTS 2y + preload on API; `upgrade-insecure-requests` on SPA)
- [x] CSP headers set (`script-src 'unsafe-inline'` removed after remediation)
- [x] Webhook signatures verified (Stripe HMAC + constant-time + replay window; outbound HMAC-signed)
- [x] D1 queries parameterized
- [x] **Access-control layer effective end-to-end** — HIGH #1 (RBAC ordering) and HIGH #2 (LDAP IDOR) remediated
