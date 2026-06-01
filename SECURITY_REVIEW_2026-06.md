# Qesto — Deep Security Review (2026-06)

**Scope:** Backend (`functions/api/**`, ~34.7k LOC, 250 files), realtime Durable Object,
worker, configuration (`wrangler.toml`, `public/_headers`). Methodology: OWASP Top 10 +
STRIDE, focused on the highest-risk surfaces — authentication/session, authorization &
multi-tenancy, billing/Stripe, injection/input-validation, SSRF/outbound integrations,
the WebSocket Durable Object, and secrets/crypto/headers.

**Overall posture: solid.** No remotely-exploitable authentication bypass, SQL injection,
or cross-tenant data-read was found. Database access is consistently parameterized, tokens
are hashed at rest, the JWT scheme resists `alg` confusion, and the realtime DO enforces
per-message authorization. The findings below are real but mostly **High/Medium hardening
gaps** rather than open doors.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ Good practice. All findings
were code-verified (file:line cited); none are speculative unless marked *(suspected)*.

---

## Remediation status (this branch)

| ID | Finding | Status |
|----|---------|--------|
| H-1 | Login rate limiting | ✅ Fixed — per-IP/per-email gates on `password/login` |
| H-2 | Webhook SSRF (redirects + IP-encoding + rebinding) | ✅ Fixed — `redirect: 'manual'`, delivery-time re-validation, numeric-IP parsing |
| M-4 | Constant-time SCIM token compare | ✅ Fixed — `timingSafeEqual` |
| M-6 | Rate-limit IP spoofing | ✅ Fixed — trust only `cf-connecting-ip` |
| L-1 | PBKDF2 work factor | ✅ Fixed — 600k iterations + rehash-on-login (legacy hashes still verify) |
| M-1 | SAML hardcoded `team` plan | ⏳ Open — changes provisioning; needs product decision |
| M-2 | Signature-verified Stripe webhook | ⏳ Open — net-new endpoint; needs billing design |
| M-3 | CSRF custom-header requirement | ⏳ Open — requires coordinated frontend change |
| M-5 | Remove `'unsafe-inline'` from CSP | ⏳ Open — needs nonce/hash rollout to avoid breaking the SPA |
| L-2 | Fail closed on missing `ACTIONS_KV` revocation | ⏳ Open |
| L-3 | JWT `aud`/`iss` | ⏳ Open (low priority) |
| L-4 | RBAC allow-by-default / mount-order | ⏳ Open (tracked as ARCH-HONO-01/02) |

---

## 🟠 High

### H-1 — No rate limiting on password login (credential brute-force / stuffing)
- **Where:** `functions/api/routes/auth/password.ts:77` (`POST /api/auth/password/login`);
  rate-limit wiring in `functions/api/app.ts:136-143`.
- **Issue:** Only `/api/auth/request` (magic-link request) and session-create/join are
  rate-limited. `password/login`, `password/reset-confirm`, and `password/signup` have **no
  throttle**. An attacker can brute-force passwords or run credential-stuffing at full speed;
  failed logins are audit-logged but not blocked.
- **Exploit:** Automated password spraying against `/api/auth/password/login` with a leaked
  email list.
- **Fix:** Add per-IP **and** per-email rate limiting to login (mirror the magic-link gate in
  `magic-link.ts:36-57`), e.g. `rateLimit({ namespace: 'auth', limit: 10, windowSec: 600 })`
  plus an account-scoped counter with exponential lockout.

### H-2 — Outbound webhook SSRF: validation only at registration; redirects followed; IP-encoding bypass
- **Where:** validator `functions/api/lib/webhook-url.ts:39`; delivery
  `functions/api/lib/webhooks.ts:179`; retry `functions/api/lib/webhook-dlq.ts:126`.
- **Issues:**
  1. **Time-of-check/time-of-use + DNS rebinding:** the URL is validated only when the
     webhook is created/patched (`webhooks.ts:123,197`). At delivery time `fetch(url, …)` runs
     with no re-validation, so a hostname that resolved to a public IP at registration can
     resolve to a private/loopback address at delivery.
  2. **Redirects are followed by default:** `singleAttempt`/DLQ `fetch` use the default
     `redirect: 'follow'`. A registered "allowed" host can `302` to an internal target.
  3. **Decimal/integer IP bypass:** `isPrivateIpv4` splits on `.` and bails when there aren't
     4 octets, so `https://2130706433/` (= `127.0.0.1`) and similar decimal/hex forms pass the
     filter.
- **Impact (Workers-adjusted):** Cloudflare Workers have no VM metadata endpoint
  (`169.254.169.254` is unreachable), which lowers the classic cloud-metadata impact, but the
  platform can still be abused as an SSRF proxy and to reach services reachable from CF egress.
- **Fix:** Re-validate the **resolved** target at delivery; set `redirect: 'manual'` and reject
  3xx (or re-validate each hop); normalise/parse IP literals (decimal/octal/hex, IPv6) before
  the private-range check; consider an allowlist for enterprise webhooks.

---

## 🟡 Medium

### M-1 — SAML JIT provisioning grants the paid `team` plan to every SSO user
- **Where:** `functions/api/routes/auth/saml.ts:110`
  `INSERT INTO users (… plan) VALUES (…, 'team')`.
- **Issue:** Any user who completes SAML login on a configured team is created on the **paid
  `team`** tier regardless of entitlement. Combined with M-2 (no Stripe reconciliation), plan
  state is not tied to billing.
- **Fix:** Provision SSO users at the team's actual entitlement (look up the team's plan) or
  default to `free`/`member` and let entitlement flow from billing.

### M-2 — No inbound Stripe webhook handler / signature verification (billing integrity)
- **Where:** No `constructEvent`/`Stripe-Signature` handler exists anywhere (grep across
  `functions/`). `billing.ts` only makes **outbound** Stripe calls.
- **Issue:** There is no server-side reconciliation of subscription lifecycle events
  (`checkout.session.completed`, `customer.subscription.updated/deleted`). `users.plan` is only
  ever written by admin routes (`admin/users.ts:149-157`) and the SAML path (M-1). Today this
  is a *correctness/billing* gap (paid checkouts don't auto-upgrade); it becomes a
  *security* issue the moment a webhook handler is added without strict signature + timestamp
  verification.
- **Fix:** Add a dedicated, **unauthenticated-but-signature-verified** Stripe webhook endpoint:
  verify `Stripe-Signature` over the **raw** body with the endpoint secret using a constant-time
  compare and a timestamp tolerance (replay protection); make handling idempotent on event id;
  derive `plan` only from verified subscription state.

### M-3 — CSRF check fails open when both `Origin` and `Referer` are absent
- **Where:** `functions/api/middleware/csrf.ts:67-90`; session cookie is `SameSite=None`
  (`functions/api/routes/auth/cookie.ts:14`).
- **Issue:** When neither header is present the request is allowed (documented residual risk in
  the file). With `SameSite=None` cookies, the Origin header is the *primary* CSRF defence, so
  any context that can send a credentialed request without an Origin bypasses it. Additionally
  the preview-origin allowance `^https://[a-z0-9]+\.qesto\.pages\.dev$` (csrf.ts:87 and the
  matching CORS rule in `app.ts:113`) trusts every Pages preview subdomain.
- **Fix:** Require a custom header (e.g. `X-Qesto-Client`) on all state-changing requests
  (CORS blocks attacker-set custom headers cross-origin), or fail closed when Origin/Referer is
  missing on `POST/PATCH/PUT/DELETE`. Tighten the preview allowlist to known deployment hosts.

### M-4 — SCIM bearer token compared non-constant-time
- **Where:** `functions/api/routes/scim.ts:18` `return auth === \`Bearer ${expected}\``.
- **Issue:** Direct `===` on the secret enables a timing side-channel; the SCIM surface also
  lists all user emails (`scim.ts:33`), so the token guarding it is high-value.
- **Fix:** Use the existing `timingSafeEqual` (`lib/shared/crypto`) for the token comparison.

### M-5 — CSP allows `'unsafe-inline'` scripts; one variant uses `frame-ancestors *`
- **Where:** `public/_headers:8` and `:13`.
- **Issue:** `script-src 'self' 'unsafe-inline' …` substantially weakens the CSP against XSS
  (any injected inline script executes). The second policy block uses `frame-ancestors *`
  (clickjacking exposure for the paths it covers) vs. `'none'` in the first.
- **Fix:** Remove `'unsafe-inline'` from `script-src` (use nonces/hashes); scope
  `frame-ancestors` to the minimum required origins.

### M-6 — Rate-limit client-IP derivation trusts spoofable forwarded headers
- **Where:** `functions/api/middleware/rate-limit.ts:33-40`; also `magic-link.ts:34`.
- **Issue:** `clientIp()` falls back to client-controlled `x-forwarded-for` / `x-real-ip` when
  `cf-connecting-ip` is absent. On Cloudflare `cf-connecting-ip` is normally present (so risk is
  reduced), but the fallback means any path where it is missing allows per-request bucket
  rotation, defeating the limiter.
- **Fix:** Trust **only** `cf-connecting-ip` (it is set by the edge and unspoofable); drop the
  `x-forwarded-for`/`x-real-ip` fallbacks or fail closed.

---

## ⚪ Low

- **L-1 — PBKDF2 iteration count below current guidance.** `functions/api/lib/password.ts:7`
  uses 100,000 iterations of PBKDF2-HMAC-SHA256; OWASP (2023) recommends ≥600,000. Salt +
  timing-safe verify are correct. Plan a migration-on-login rehash to a higher cost (or Argon2id
  if available in-runtime).
- **L-2 — Session revocation silently skipped if `ACTIONS_KV` is unbound.**
  `functions/api/middleware/auth.ts:52` only checks the revocation list `if (c.env.ACTIONS_KV)`.
  If the binding is missing, logout/force-revoke becomes a no-op (revoked JWTs still validate
  until `exp`). Fail closed or alert when the binding is absent.
- **L-3 — JWT lacks `aud`/`iss` and future-`iat`/`nbf` checks.** `functions/api/lib/jwt.ts:38`
  validates signature + `exp` only. Acceptable for the current single-purpose token, but add
  `aud`/`iss` before issuing tokens for additional audiences.
- **L-4 — RBAC is an allow-by-default matrix.** `functions/api/middleware/rbac.ts`: routes not
  present in `PERMISSION_MATRIX` (the majority of the 60+ route files) pass the RBAC gate
  unrestricted and rely solely on each sub-app's own `authMiddleware` + in-route ownership
  checks. The path-normalisation in `getRouteKey` is heuristic and can fail to map a concrete
  path to its matrix key (→ unrestricted). This is defense-in-depth only today, but the
  mount-order fragility (documented at `app.ts:237-244`, ARCH-HONO-01/02) means a future public
  route mounted in the wrong place could be exposed. Track the structural fix.
- **L-5 — Public OpenAPI/Redoc & broad info endpoints.** `developer-portal.ts` serves the full
  API spec unauthenticated (by design); `/api/version` and `/api/admin/health` expose env +
  commit + multi-region routing. Informational; confirm intended.

---

## ✅ Good practices observed (keep these)

- **Parameterized D1 everywhere** reviewed (`.prepare().bind()`), incl. dynamic admin/auth
  paths — no string-concatenated SQL found.
- **Token hygiene:** magic-link tokens are 32 random bytes, only `sha256(raw)` persisted, and
  consumed atomically single-use (`magic-link.ts:116-123`); session tokens are hashed for the
  revocation list (`session-token.ts`).
- **JWT hardening:** fixed canonical header is byte-compared (`jwt.ts:42`), defeating
  `alg=none`/algorithm-confusion; HMAC verified with `timingSafeEqual`; supports dual-secret
  rotation.
- **No account enumeration:** login returns a generic error and reset-request always returns
  `202` (`password.ts:111,177`).
- **Realtime DO authorization is correct:** the WS route verifies the presenter JWT and checks
  `claims.sub === owner_id` or team permission before assigning the `presenter` role
  (`sessions/public.ts:117-134`); it constructs fresh `x-qesto-*` headers (does not forward
  client-supplied ones) to an internal-only DO stub; and the DO independently enforces
  `role !== 'presenter'` on every privileged message (`SessionRoom.ts:728,767,809,842`).
- **Authorization is self-scoped:** billing, GDPR export/delete, and webhook CRUD derive the
  subject from `user.sub`/team `owner_id`, not from attacker-controlled IDs
  (`billing.ts:181`, `gdpr.ts:93-114`, `webhooks.ts:115`).
- **Admin/forensics/breach** are gated by `authMiddleware` + `adminMiddleware` (DB-backed
  `user_roles`, fail-closed to 403).
- **Secrets hygiene:** no secrets in `wrangler.toml [vars]`, no hardcoded keys in source, no
  `env.X || 'fallback-secret'` antipatterns; log redaction patterns exist (`lib/log.ts`).
- **Resilience:** circuit breakers around Stripe; rate-limit headers (RFC 6585); audit events
  on auth-sensitive actions.

---

## Recommended remediation order

1. **H-1** add login rate limiting (small, high value).
2. **H-2** webhook SSRF: `redirect: 'manual'` + delivery-time re-validation + IP-literal parsing.
3. **M-2/M-1** introduce a signature-verified Stripe webhook and stop hardcoding the SAML plan.
4. **M-3/M-4/M-6** CSRF custom-header requirement, constant-time SCIM token, drop spoofable IP
   fallbacks.
5. **M-5/L-1** remove `'unsafe-inline'` from CSP; raise PBKDF2 cost (rehash-on-login).
6. **L-2/L-4** fail closed on missing `ACTIONS_KV`; track the RBAC/mount-order structural fix.

*Review method: static code analysis of the cited files. No dynamic testing or dependency-CVE
scan (`npm audit`) was run as part of this pass — recommend adding both to CI.*
