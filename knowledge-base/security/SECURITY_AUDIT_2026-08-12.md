# Security Audit Report: Qesto

**Review Date**: 2026-08-12
**Scope**: Extended full-stack review of the Cloudflare-native application — edge API (`functions/api/`, ~62k LOC across 80+ route modules), Durable Object realtime layer, auth/session/SSO/impersonation, Stripe billing + webhooks, outbound webhooks, public API + embed widget planes, Workers AI pipeline, storage access patterns, frontend (`src/`, ~40k LOC), and deploy configuration.
**Stack**: Cloudflare Workers/Pages, Hono, D1, KV, Durable Objects, Workers AI, Vectorize, Stripe, Resend.
**Method**: Manual review of the security primitives, automated pattern sweeps for injection/XSS/weak-randomness/unscoped-object-access across every route module, and **executable proof-of-concept exploits** for each finding before remediation. Line references are against the audited tree at commit `04da6f5`.

> **Remediation status (2026-08-12):** All findings below were fixed in the pull request that introduced this report. Each finding carries a **Status** line and a regression test in `tests/unit/security-audit-authz.test.ts`. Every finding was demonstrated exploitable against `createApp()` before the fix and demonstrated blocked after.

## Executive Summary

The posture confirmed by the [2026-07-08 audit](./SECURITY_AUDIT_2026-07-08.md) holds: cryptographic primitives are correct and single-sourced, D1 access is uniformly parameterized (**no SQL injection found** — every dynamically-assembled `WHERE`/`SET` clause is built from static fragments with bound parameters), there is **no `dangerouslySetInnerHTML`, `eval`, or `innerHTML` sink anywhere** in 100k LOC, SSRF controls are thorough, Stripe webhook verification is correct including the replay window, and the SAML SP's missing XML-DSig is correctly contained behind two independently-verified kill-switches that both default off.

This audit found four issues, in two clusters:

1. **A cross-tenant authorization gap on the tournament routes** — the entire `/api/tournaments` router shipped with no object-level authorization. Any authenticated user could read, seed, and overwrite any other tenant's bracket. This is the concrete realization of the risk the previous audit's RBAC finding described: `rbacMiddleware` deliberately defers non-platform routes to "the route's authoritative in-route check", and on this router that check did not exist.
2. **Session termination was not authoritative.** `POST /api/auth/logout` revoked only a token presented in the `Authorization` header — but the session cookie is the primary credential, and magic-link/SSO logins never populate the SPA's in-memory bearer token. Logging out therefore wrote nothing to the revocation list, and the clearing cookie lacked the attributes needed for a browser to accept it cross-site. The 14-day JWT survived logout intact. The WebSocket presenter path and "stop impersonating" had the same class of defect.

A fifth issue — a CSRF `Origin` allowance for `http://localhost:*` that was live in production — is included below.

## Critical Findings

None.

## High-Severity Findings

### [HIGH] Authorization: no object-level authorization on the tournament routes (cross-tenant read + write)

**Status**: ✅ **FIXED** — every route now resolves the object to a session and calls `requireSessionAccess` before touching a row.

**Location**: `functions/api/routes/tournaments.ts` (all four routes, pre-fix)

**Description**: `bracket_matches` rows key only on `energizer_id`, and an energizer id carries no tenant. The router authenticated the caller (`authMiddleware`) and checked their plan (`planMiddleware`) but never checked whether the caller had any relationship to the session being addressed:

```ts
// pre-fix — the sessionId path param was never even read
app.get('/sessions/:sessionId/bracket/:energizerId', async (c) => {
  const energizerId = c.req.param('energizerId')
  const { results } = await c.env.DB.prepare(
    `SELECT ... FROM bracket_matches WHERE energizer_id = ?1 ...`,
  ).bind(energizerId).all()
  return c.json({ ok: true, data: { matches: results ?? [] }, ... })
})

// pre-fix — no session lookup at all before the write
app.patch('/matches/:matchId', async (c) => {
  const id = c.req.param('matchId')
  await c.env.DB.prepare(
    `UPDATE bracket_matches SET winner_id = ?1, ..., state = 'completed' WHERE id = ?4`,
  ).bind(body.data.winnerId, ..., id).run()
```

The `PERMISSION_MATRIX` in `middleware/rbac.ts` lists these paths as `{owner, admin, member}`, which reads like coverage — but `rbacMiddleware` hard-enforces **only** entries requiring `platform_admin` and explicitly defers everything else to the route's own check (`rbac.ts:251`–`:275`, a deliberate decision so the coarse global-role matrix cannot shadow finer-grained team authorization). With no in-route check, nothing was enforced.

**Impact**: Any authenticated user — every free-tier signup — could, against any other tenant:

- read a bracket, disclosing participant identifiers (`GET .../bracket/:energizerId`);
- export the same via a Markdown download (`GET .../bracket/:energizerId/export`);
- write rows into another tenant's session (`POST .../bracket/seed`);
- **declare the winner of any match** (`PATCH /matches/:matchId`) — integrity loss on a live, audience-facing activity.

**Proof of concept (pre-fix)**: an attacker JWT for a user owning nothing returned `200` with the victim's participant ids, and the `PATCH` executed `UPDATE bracket_matches` and returned `{"ok":true,"data":{"updated":true}}`.

**Fix**: `authorizeEnergizer()` performs a two-legged check — `requireSessionAccess(db, sessionId, userId)` proves the caller may act on the session, and `getEnergizerById(db, sessionId, energizerId)` proves the energizer belongs to *that* session, so a caller cannot pair their own `sessionId` with a foreign `energizerId`. `PATCH /matches/:matchId` walks match → energizer → session before authorizing. All denials answer **404, not 403**, so the endpoints cannot be used to probe which ids exist in other tenants. The two authorization lookups live in `repositories/energizerRepository.ts` per ADR-0069.

### [HIGH] Session management: logout does not invalidate the session

**Status**: ✅ **FIXED** — every token presented on the request is revoked, and the clearing cookie now matches the issuing attributes.

**Location**: `functions/api/routes/auth/session-routes.ts:39`–`:66` (pre-fix)

**Description**: Two independent defects combined so that logout was a no-op server-side **and** client-side.

1. **Wrong credential revoked.** The handler read the token only from the `Authorization` header:
   ```ts
   const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? null
   if (token && c.env.ACTIONS_KV) { /* write revocation entry */ }
   ```
   The session cookie is the primary credential (`SESSION_COOKIE`, HttpOnly, 14-day TTL). `src/api/client.ts` sends a bearer header only when `setAuthToken` has been called, which happens **only** on the password login/signup/reset paths (`src/hooks/useAuth.tsx:64,78,99`) — never on magic link (the documented primary auth method) or SSO. For those users `token` was `null` and **nothing was written to the revocation list**.

2. **Clearing cookie rejected cross-site.** `deleteCookie(c, SESSION_COOKIE, { path: '/' })` emitted `qesto_session=; Max-Age=0; Path=/`. The cookie was issued `Secure; SameSite=None` (`routes/auth/cookie.ts`) precisely because the SPA and API are different origins. A `Set-Cookie` without `Secure; SameSite=None` is rejected outright by browsers in a third-party context, so the real cookie survived.

**Impact**: "Log out" ended the session in the SPA's local state only. A token captured beforehand — from a shared or public machine, a synced browser profile, a proxy log, or a session-fixation vector — remained valid for the full remaining 14 days, with no operator control to shorten it. This also silently defeats the incident-response assumption behind the existing revocation list.

**Proof of concept (pre-fix)**: after `POST /api/auth/logout` with the cookie, the revocation entry was `null` and replaying the same JWT against `/api/auth/me` returned `200`. Observed `Set-Cookie: qesto_session=; Max-Age=0; Path=/` — no `Secure`, no `SameSite`.

**Fix**: revoke the union of `{cookie token, header token, impersonation cookie}`, and delete both cookies with `{ path: '/', secure: true, sameSite: 'None' }`. Post-fix the replayed token returns `401`.

## Medium-Severity Findings

### [MEDIUM] Session management: the WebSocket presenter path ignores the revocation list

**Status**: ✅ **FIXED** — the upgrade route now consults the shared `isSessionTokenRevoked()` helper.

**Location**: `functions/api/routes/sessions/public.ts:103`–`:120` (pre-fix)

**Description**: `GET /api/sessions/:id/ws` verifies the session JWT itself rather than going through `authMiddleware` — it must also serve anonymous voters. It called `verifyJwtWithSecrets()` and, on a valid signature, granted `role: 'presenter'`, but never performed the revocation lookup that `authMiddleware` does (`middleware/auth.ts:103`–`:112`). Signature validity alone is not authorization.

**Impact**: a logged-out or explicitly revoked token still bought full presenter control of a LIVE session — launch, close, advance questions, activate energizers — for the remainder of the JWT lifetime. Combined with the logout finding above, revocation had almost no reachable enforcement point on this path.

**Fix**: extracted `isSessionTokenRevoked(env, token)` into `lib/session-token.ts` so routes that verify JWTs themselves cannot drift from middleware behaviour, and applied it before the presenter-role grant.

### [MEDIUM] CSRF: `http://localhost:*` was an accepted Origin in production

**Status**: ✅ **FIXED** — the allowance is now keyed on the API itself being served from loopback.

**Location**: `functions/api/middleware/csrf.ts:93`–`:98` (pre-fix)

**Description**: The Origin check exempted loopback origins whenever `PAGES_URL` was remote:

```ts
const pagesIsRemote = expected ? !/^http:\/\/(localhost|127\.0\.0\.1)/.test(expected) : false
const allowLocalDev = isLocalDevOrigin &&
  (c.env.ENV === 'dev' || c.env.ENV === 'staging' || pagesIsRemote)
```

`pagesIsRemote` is true on **every** production deploy (`PAGES_URL = "https://qesto.cc"`), so `http://localhost:<port>` was an accepted Origin against production.

**Impact**: the session cookie is `SameSite=None`, so the browser attaches it to cross-site requests. A `POST`/`PATCH` with `Content-Type: text/plain` is a CORS *simple request* — no preflight fires, so the CORS layer (which does reject localhost in production) is never consulted, and the CSRF middleware was the only control in the path. Hono's `c.req.json()` parses the body regardless of `Content-Type`, so a plain-text body of JSON reaches handlers normally. Any page a victim loaded from `http://localhost:<port>` — a local dev server, an Electron app, a malicious package's preview server — could therefore drive credentialed state-changing requests against production. The response is unreadable to the attacker, but the state change lands.

**Proof of concept (pre-fix)**: a `text/plain` `PATCH` from `Origin: http://localhost:3000` with `ENV=production` returned `200` and performed the write.

**Fix**: loopback origins are accepted only when `ENV` is `dev`/`staging` **or the API is itself answering on loopback**. This preserves the split-stack local-dev workflow (Vite on `:5173` → `wrangler dev` on `:8787`) while making the branch unreachable on a deployed API — which matters because `wrangler.toml` ships `ENV = "production"` and local `wrangler dev` inherits it, so an `ENV`-only condition would have broken local development. The pre-existing test that asserted the vulnerable behaviour (`tests/unit/csrf.test.ts`, "split-stack local dev") was rewritten to cover both the permitted and the rejected case.

### [MEDIUM] Impersonation: stopping was not authoritative

**Status**: ✅ **FIXED** — the impersonation token is now revoked server-side.

**Location**: `functions/api/routes/admin/user-support.ts:198` (pre-fix)

**Description**: `POST /admin/impersonation/stop` cleared the impersonation cookie with `deleteCookie(c, IMPERSONATION_COOKIE, { path: '/' })` and wrote an audit event, but performed no server-side revocation. The cookie is issued `Secure; SameSite=None`, so — exactly as in the logout finding — the clearing cookie is rejected on this cross-site response.

**Impact**: "stop impersonating" could fail to drop the elevated context, leaving an admin acting as another user for the remainder of the 15-minute TTL while the audit log records the session as ended.

**Fix**: revoke the impersonation token into the shared revocation list (TTL-matched) before clearing, and clear with matching attributes. `authMiddleware` already consults that list, so the stop takes effect regardless of what the browser does with the `Set-Cookie`.

## Verified Sound (no action required)

Reviewed with intent to break; found correct:

| Area | Evidence |
|---|---|
| **SQL injection** | Every dynamic `WHERE`/`SET` in the tree (`templates-kv.ts`, `video-assets.ts`, `townhall/index.ts`, `marketing/*`, `engagement-analytics.ts`, `help-prompts.ts`) assembles static fragments with `?n` placeholders; no user value reaches the SQL string. No `ORDER BY`/`LIMIT` interpolation anywhere. |
| **XSS** | Zero `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, or `new Function` across `src/`, `functions/`, `worker/`. API CSP is `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`. |
| **JWT** | HS256 with the encoded header pinned by equality before verification (`jwt.ts:42`) — `alg: none` and algorithm-confusion are structurally impossible. Timing-safe signature compare; rotation via `JWT_SECRET_PREV`. |
| **Passwords** | PBKDF2-SHA256 at 600k iterations (OWASP 2023), 16-byte salt, self-describing work factor, upgrade-on-login for legacy hashes, timing-safe compare. |
| **Stripe webhooks** | Raw-body HMAC, ±300s replay window, all `v1` signatures checked during rotation, constant-time compare, plus event-id idempotency. |
| **SSRF** | `webhook-url.ts` normalizes every IPv4 notation (decimal/hex/octal/short-form) before range checks and handles IPv4-mapped IPv6 in both compressed and dotted forms. Unusually thorough. |
| **DO header trust** | `handleUpgrade` trusts `x-qesto-role`/`x-qesto-voter`/`x-qesto-ip-hash`, but `routes/sessions/public.ts:127` builds a **fresh** `Headers` object for the stub fetch — client-supplied values cannot pass through. |
| **Voter identity** | Anchored on `cf-connecting-ip` only; `x-forwarded-for`, `x-real-ip`, and the client `X-Qesto-Fingerprint` are deliberately excluded from the dedupe identity (#583/#584). |
| **Embed widget plane** | HMAC envelope, origin-pinned allowlist with reflected (never `*`) CORS, revocation read, opaque failure reasons to avoid an oracle. |
| **SAML** | XML-DSig verification is genuinely absent — and genuinely contained: `samlDisabled()` gates **every** route on two independent flags, both shipping `"false"` in `wrangler.toml`, verified enforced. |
| **Secrets** | No live credentials in the tree; all `sk_live_`/`whsec_` hits are documentation placeholders and the secret-scanner's own patterns. |
| **AI inputs** | Sanitized at the `runAI` gateway chokepoint — control chars, zero-width, and bidi-override stripping plus length bounds. |
| **API keys** | 122-bit `crypto.randomUUID()` entropy, SHA-256 at rest, format-gated, per-key rate limited. |
| **OAuth** | id_token verified against JWKS with pinned audience + issuer and `email_verified` enforced. |

Weak randomness (`Math.random`) appears only in non-security contexts — display ids and participant shuffles — with no authentication or authorization dependency.

## Residual Risk / Follow-ups

1. **`isPreview` CSRF/CORS allowance.** `/^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/` lets any Pages preview deployment of this project drive credentialed requests against production. Acceptable while preview deploys are trusted (they build from this repo), but it is a lateral path worth narrowing if preview builds ever run untrusted PR code. Not changed here — narrowing it would break the preview workflow and is a product decision.
2. **RBAC matrix is documentation, not enforcement**, for every non-`platform_admin` entry. This is a deliberate, well-reasoned design (`rbac.ts:251`–`:275`), but the tournaments finding shows the failure mode: a matrix entry reads like coverage during review. Consider a CI check asserting every `PERMISSION_MATRIX` path has a corresponding in-route object-level check, so the gap cannot recur silently.
3. **`verifyJwt(token, c.env.JWT_SECRET)` in `routes/help/register-ask.ts:30` and `register-feedback.ts:29`** uses the single current secret rather than `jwtVerificationSecrets()`. Low impact — these routes treat auth as optional and degrade to anonymous — but during a secret rotation, previous-secret holders are silently downgraded. Worth aligning for consistency.

## Remediation Applied

| File | Change |
|---|---|
| `functions/api/routes/tournaments.ts` | Two-legged `authorizeEnergizer()` on all four routes; match → energizer → session walk for `PATCH /matches/:matchId`; 404-on-deny. |
| `functions/api/repositories/energizerRepository.ts` | `getSessionIdForEnergizer()`, `getEnergizerIdForBracketMatch()` (ADR-0069 layering). |
| `functions/api/routes/auth/session-routes.ts` | Revoke cookie + header + impersonation tokens on logout; clear cookies with issuing attributes. |
| `functions/api/lib/session-token.ts` | Shared `isSessionTokenRevoked()`. |
| `functions/api/routes/sessions/public.ts` | Revocation check before granting presenter role on WS upgrade. |
| `functions/api/routes/admin/user-support.ts` | Server-side revocation on impersonation stop; matching cookie attributes. |
| `functions/api/middleware/csrf.ts` | Loopback Origin allowed only when the API itself is on loopback. |
| `tests/unit/security-audit-authz.test.ts` | 12 regression tests (new). |
| `tests/unit/csrf.test.ts` | Rewrote the test that asserted the vulnerable localhost behaviour; added the rejection case. |

**Verification**: `npm test` — 307 files, 2625 tests passing. `tsc --noEmit` clean. `check:kv-access`, `check:d1-access`, `check:error-response`, `check:no-any` at baseline with no regression. (`check:baseline` reports 5 pre-existing design-token violations, unrelated to and unchanged by this work.)
