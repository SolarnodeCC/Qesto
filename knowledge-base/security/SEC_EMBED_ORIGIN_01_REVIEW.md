# SEC-EMBED-ORIGIN-01 — EMBED Widget Origin-Sandboxing Security Review

**Story:** SEC-EMBED-ORIGIN-01 (Sprint 87, P0) · **ADR:** ADR-0050 · **Reviewer:** security
**Date:** 2026-06-12 · **Surface:** Pentest #5 EMBED slice (de-anonymization / token forgery / origin spoofing / embed-as-CSRF-pivot / clickjacking)
**Methodology:** OWASP Top 10 + STRIDE, ADR-0050 threat model, code-verified (file:line cited). DOCUMENTATION/REVIEW ONLY — no code modified.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ Good practice.

---

## Verdict

**CLEAR-WITH-FOLLOWUPS.**

The shipped EMBED backend implements the ADR-0050 spine faithfully and the **headline Pentest #5 guarantee holds**: the public read plane is **aggregate-only by construction** — every read accessor selects `COUNT(*)`/`GROUP BY option_id` exclusively, with no query shape and no response field capable of emitting per-participant identity. Token security (timing-safe HMAC verify, expiry, TTL clamp, per-call origin pin, revocation kill-switch, no PII in claims, fail-closed 503) is sound. Origin/CORS/CSRF posture is correct: reflected-allowlist CORS (never `*`), `Vary: Origin`, and a tightly-scoped CSRF exemption that does not open the cookie-authed surface.

No Critical or High finding blocks the surface. However, **three Medium findings must be closed before EMBED GA / before SEC-PEN5-01 sign-off**, the most important being the **absence of the per-token/per-origin rate limit (M-1)** that ADR-0050 §5 mandates as a structural Pentest #5 deliverable — the read plane is unthrottled today. M-2 (cross-tenant widget-config creation via the `team_id = user.sub` tenancy shortcut) and M-3 (a non-token-pinned session resolution on `/handshake`) are correctness/defence-in-depth gaps that the pentest will probe.

**One item to route back to the backend agent now: M-1 (rate limit) and M-3 (handshake token-pin)** — both are in files the backend agent owns and both are named Pentest #5 abuse cases. Details and fix recommendations below; I did not patch them (documentation-only scope + other agents editing these files).

---

## Files audited

| File | Lines reviewed |
|---|---|
| `functions/api/routes/embed.ts` (mint plane) | 1–218 (full) |
| `functions/api/routes/embed-widget-v1.ts` (read plane) | 1–154 (full) |
| `functions/api/middleware/widget-token.ts` (token + origin + revocation) | 1–79 (full) |
| `functions/api/lib/embed-token.ts` (HMAC sign/verify, TTL, origin) | 1–137 (full) |
| `functions/api/repositories/embedWidgetRepository.ts` (D1 accessors) | 1–204 (full) |
| `functions/api/middleware/csrf.ts` (the `/api/embed/v1/` exemption) | 1–108 (full) |
| `migrations/0055_embed_widgets.sql` | 1–27 (full) |
| `functions/api/lib/shared/crypto.ts` (`hmacSign`, `timingSafeEqual`) | 1–35 (full) |
| Supporting: `functions/api/app.ts` mount order (259–341), `routes/sessions/shared.ts:fetchSession` (169–185) | targeted |

---

## Threat-model findings (the 4 required audit axes)

### 1. De-anonymization (the headline Pentest #5 guarantee) — ✅ STRUCTURALLY CLOSED

The read plane cannot emit per-participant identity, and the guarantee is **structural, not a runtime filter**:

- The read plane (`embed-widget-v1.ts`) calls **only** aggregate accessors:
  `widgetResponseCount` (`embedWidgetRepository.ts:174-180`, `SELECT COUNT(*)`),
  `widgetResultsAggregate` (`:190-204`, `SELECT option_id, COUNT(*) … GROUP BY option_id`),
  `fetchEmbedActiveQuestion` (`:160-171`, question metadata only), and
  `fetchEmbedSession` (`:134-145`, public session fields only). **No accessor on the read path
  has a `votes`-row projection**; there is no `SELECT voter_id`, `voter_hash`, `ip`, `fingerprint`,
  `name`, or `email` anywhere in the repository's public-read section. The de-anon guarantee
  therefore rests on absence-of-capability, not on a filter that could be bypassed.
- The handshake `participant_token` is generated as a fresh random UUID
  (`embed-widget-v1.ts:85`, `ept_${crypto.randomUUID()}`) with **no identity derivation** — it
  carries no user id, no PII, and is never persisted to a voter row. Anonymous-by-construction,
  matching the ADR-0050 §2 contract.
- `EmbedSessionView` (`embedWidgetRepository.ts:125-131`) exposes only `id, code, title, status,
  anonymity` — all team-authored, non-participant fields. `anonymity_mode` is surfaced to the
  embed (`embed-widget-v1.ts:95`) which is correct (display config), not a leak.
- ZK (ADR-0010) and town-hall (ADR-0044) modes are preserved: the embed never touches a
  per-author projection; in every mode the widget sees only `COUNT`/`GROUP BY` output.

**Residual risk (LOW, documented, not blocking):** the results endpoint emits
`counts_by_option` + `total` (`embed-widget-v1.ts:142-150`). For a question with a **very small
respondent pool** (e.g. `total = 1`, or all votes on a single option) the aggregate itself is a
weak signal — combined with an out-of-band observation ("only Alice voted"), a single-vote tally
narrows the choice to a known individual. This is the generic **small-cell aggregate-correlation**
de-anon vector, identical to the one PULSE/analytics must address with k-anonymity. It is *not* a
per-participant field leak (the ADR guarantee holds) and is out of SEC-EMBED-ORIGIN-01's structural
scope, but it **should be a named Pentest #5 probe** and is worth a k-anonymity floor (suppress/round
tallies below `n=k`) as a future hardening item. Flagged here, not blocking.

### 2. Token security — ✅ SOUND (one Low: error-string fidelity)

- **HMAC verify is timing-safe.** `verifyEmbedToken` re-signs the payload and compares with
  `timingSafeEqual` (`embed-token.ts:107-108`), which is the constant-time XOR-accumulate compare
  (`shared/crypto.ts:30-35`) over equal-length base64url MACs — the single shared primitive, no
  inline MAC. ✅ ADR-0049 single-sourced-crypto discipline honoured.
- **Signature-before-parse ordering is correct.** The MAC is verified *before* the payload JSON is
  decoded/parsed (`embed-token.ts:107` precedes the `JSON.parse` at `:113`), so a tampered payload
  cannot reach the parser — no parser-differential or injection surface on unauthenticated input.
- **Expiry enforced** server-side from a trusted clock: `now >= claims.exp → expired`
  (`embed-token.ts:122-123`). No `nbf`/`iat`-future check, but that is immaterial (mint sets `iat`
  server-side).
- **TTL clamped** to `[1, 86400]` with a 3600 default (`clampTtl`, `embed-token.ts:36-39`); a
  non-finite or non-positive request defaults, a too-large request is `Math.min`'d to the max. ✅
  A client cannot mint a long-lived token.
- **Origin (`ao`) bound on every call.** `widgetTokenMiddleware` calls `originAllowed(claims, origin)`
  unconditionally (`widget-token.ts:62`) before setting any CORS header or calling `next()`; a missing
  or non-allowlisted Origin → `403 origin_not_allowed` (`:62-64`). `originAllowed` returns `false` for a
  null/unparseable origin (`embed-token.ts:133-136`), so absent-Origin requests (curl, server-to-server)
  are **rejected**, not waved through — correct for this surface (unlike the cookie-CSRF middleware's
  deliberate permissiveness). ✅
- **Revocation kill-switch works.** After signature+origin pass, the middleware reads the `wid` row
  (`fetchEmbedWidgetById`, `widget-token.ts:67`) and rejects when the row is missing **or**
  `revoked_at !== null` (`:68-69`) — overriding a still-unexpired `exp`, exactly as ADR-0050 §6
  specifies. A previously-valid token is dead the instant `DELETE /widgets/:wid` runs. ✅ (Verify in
  regression — see checklist R-7.)
- **Read scope cannot be escalated.** `verifyEmbedToken` hard-rejects any `scp !== 'read'`
  (`embed-token.ts:118`) and `v !== 1` (`:117`); `signEmbedToken` only ever writes `scp:'read'`
  (`:71`). The read plane mounts no write routes (`embed-widget-v1.ts` has only `POST /handshake` +
  two `GET`s; handshake mutates nothing). ✅
- **No PII in claims.** Claims are `{v, wid, sid, code, tid, ao, scp, iat, exp}` (`embed-token.ts:64-74`)
  — tenant/session handles only, no `users.id`, email, or participant id. `created_by` is stored in
  D1 (`embed.ts:106`) but **never copied into the token**. ✅ Safe to ship to a public page and to log.
- **Secret sourced correctly + fail-closed.** Both planes read `c.env.EMBED_WIDGET_SECRET` and
  return **503** when unset (`embed.ts:136-139` mint; `widget-token.ts:42-48` read), never falling back
  to a default or a weaker check. Secret is a Pages secret per ADR-0050/hard-rule #2 (not in
  `wrangler.toml` — confirm in devops handoff; not in repo). ✅

**⚪ L-1 — verify-failure reason is reflected verbatim into the client error message.**
`widget-token.ts:55-56` builds `Widget token ${verified.reason}` where `reason ∈ {malformed,
bad_signature, expired, wrong_version, wrong_scope}`. These are non-sensitive enum values (no secret,
no stack), so impact is minimal, but it discloses *why* verification failed (oracle distinguishing
"bad signature" from "expired" from "wrong scope"). Best practice for an unauthenticated surface is to
collapse all non-expiry failures to a single opaque `invalid_token` and reserve the distinct
`token_expired` only (which the SDK legitimately needs for re-mint). Low; tighten at GA.

### 3. Origin / CORS / CSRF — ✅ SOUND

- **CORS reflects only from the token allowlist, never `*`.** The middleware sets
  `Access-Control-Allow-Origin` to the **normalised request Origin** and *only after*
  `originAllowed` has already proven that origin is in `claims.ao` (`widget-token.ts:62` gate →
  `:74-75` reflect). There is no `*` anywhere on this surface and no path that reflects an
  unvalidated origin. ✅
- **`Vary: Origin` is set on every response**, including early-return error paths — it is set first,
  before any branch (`widget-token.ts:40`). ✅ Correct cache-key hygiene for a reflected-allowlist API.
- **CSRF exemption is tightly scoped and safe.** The exemption matches **only**
  `pathname.startsWith('/api/embed/v1/')` (`csrf.ts:56`) — the public, token-authed, *cookie-less*
  read plane. The mint plane (`/api/embed/widgets…`) is **not** exempted and remains under full CSRF
  Origin-checking + `authMiddleware`. Because the read plane carries no session cookie, the
  Origin-must-equal-`PAGES_URL` CSRF model is inapplicable there and the per-token `ao` allowlist is
  the correct replacement gate. The exemption opens **no hole in any cookie-authed route**. ✅
  (See M-4 below for a path-prefix-matching hardening nit.)
- **Embed-as-CSRF-pivot is structurally closed.** The read plane is read-only (no state mutation;
  handshake allocates an ephemeral in-memory token only) and never accepts the session cookie, so a
  malicious embed cannot be used to drive a state-changing, credentialed request against Qesto. ✅
- **Clickjacking / `frame-ancestors`** — *not enforced in the audited backend files.* ADR-0050 §3d
  assigns `Content-Security-Policy: frame-ancestors <allowed_origins>` to **the embeddable page**
  (the iframe `src`, served from Pages — a frontend/SDK deliverable, EMBED-SDK-01), not to the JSON
  API. None of the audited files serve that page, so this is **out of scope for this backend review**
  but **must be verified in the SDK/frontend review** and in CONTRACT-EMBED-SDK-01. Flagged as M-5
  (tracking) so it is not silently assumed-done.

### 4. Mint-plane authz — ✅ MOSTLY SOUND (one Medium tenancy gap: M-2)

- **`embedWidgets` entitlement enforced at mint.** A single wildcard gate fronts the entire mint
  plane (`embed.ts:67-72`): `featureAllowed(planQuotas, 'embedWidgets')` → `403` otherwise, after
  `authMiddleware` + `planMiddleware` (`:63-64`). The read plane deliberately does **not** re-check the
  plan (trusts the token) per ADR-0050 §4 — correct, TTL+revocation bound the blast radius. ✅
- **Session ownership enforced at create + mint-config fetch.** Create resolves the session via
  `fetchSession(DB, …, user.sub)` which constrains `owner_id = user.sub`
  (`sessions/shared.ts:180`), and falls back to `fetchOwnedSessionByCode` which also pins
  `owner_id = ?2` (`embed.ts:207-216`). A host cannot register a widget against a session they do not
  own. ✅
- **IDOR on `:wid` is closed.** Both `fetchEmbedWidgetForTeam` (`embedWidgetRepository.ts:81-94`) and
  `revokeEmbedWidget` (`:109-119`) constrain `WHERE id = ?1 AND team_id = ?2`, so token-mint and
  revoke against another tenant's `:wid` return `404`/no-op. ✅
- **Audit coverage is complete** for create / mint / revoke (`embed.ts:111-116`, `:169-174`,
  `:188-193`), and the token-mint audit explicitly logs **no token material** (`:173` comment +
  payload). ✅
- **Parameterized D1 throughout** the repository (`.prepare().bind()`), no string concatenation. ✅

**🟡 M-2 (tenancy) — `team_id` is set to the minting *user's* id, not the user's team.**
`callerTeamId()` returns `c.get('user').sub` (`embed.ts:57-59`), and that value is written to
`embed_widgets.team_id` at create (`:100`) and used as the tenant key for list/fetch/revoke. The
inline comment (`:50-56`) acknowledges this as a deliberate "session-ownership-as-tenant" shortcut
because the session JWT carries no team claim. **Consequence:** the `tid` claim in the minted token
(`embed.ts:164` ← `widget.team_id`) is a *user* id, not a *team* id, contradicting ADR-0050's stated
"`tid: teamId — tenant binding". Two real impacts to assess:
  (a) **Cross-member sharing breaks tenant semantics** — if two users on the *same* team both manage
      embeds, each only sees their own widgets (`team_id = their own sub`), and one cannot revoke the
      other's widget even though both are the team's. That is *more* restrictive (fail-safe), not a
      leak, but it is a tenancy-model divergence the pentest will note.
  (b) **The `tid` claim is misleading for any downstream consumer** that trusts it as a team id
      (none today, but a future write-scope or analytics join keyed on `tid` would mis-attribute).
This is **not** a cross-tenant *read* hole (isolation is enforced, just on the wrong key), so it is
Medium not High. **Recommended fix:** resolve the true team via the team-membership lookup (as the
team routes do) and bind `team_id`/`tid` to that, with the session's `team_id` as the authorisation
anchor; or, if single-owner tenancy is the accepted S87 model, **amend ADR-0050's `tid` definition**
to say "owning user id" and add a code comment so a future maintainer does not key cross-tenant logic
on it. Architect + PO decision; not a security patch. **Route to backend + architect.**

---

## 🟡 Medium (close before EMBED GA / SEC-PEN5-01 sign-off)

### M-1 — The public read plane has NO rate limit (ADR-0050 §5 unmet) — **route to backend now**
- **Where:** `functions/api/routes/embed-widget-v1.ts` (no `rateLimit` middleware on the sub-app);
  `app.ts:274` mounts it with only `widgetTokenMiddleware`. A `rateLimit` middleware exists and is
  used elsewhere (`functions/api/middleware/rate-limit.ts`) but is **not** applied here.
- **Issue:** ADR-0050 §5 mandates a **per-token (`wid`) and per-origin** rate limit with
  `429 + Retry-After` as a *structural Pentest #5 deliverable* ("flood / abuse of the
  unauthenticated-looking read surface"). As shipped, a holder of one valid token can poll
  `/state` and `/results` without limit. Each `/results` call runs a `GROUP BY` aggregate over the
  `votes` table (`embedWidgetRepository.ts:190-204`) and each call also does a D1 revocation read
  (`widget-token.ts:67`) — an attacker with a single valid token (or a downgraded-but-not-revoked
  team's token, valid until `exp ≤ 24h`) can drive sustained D1 + Worker CPU load. The embed is the
  *highest-TAM read surface* (ADR-0050 context), so this is the most load-exposed plane in the product
  with no throttle.
- **STRIDE:** Denial of Service (availability); abuse-budget exhaustion across tenants.
- **Severity rationale:** Medium not High — it is an availability/cost issue, not a confidentiality or
  integrity breach (the aggregate-only guarantee and origin pin still hold under flood). But it is an
  **explicit ADR deliverable for this very story** and a named pentest abuse case, so it must close
  before the surface clears SEC-PEN5-01.
- **Recommended fix:** apply the existing `rateLimit` middleware to the `/api/embed/v1` sub-app keyed
  on `wid` (from verified claims) + request `Origin`, with `429`/`Retry-After`; additionally cap
  anonymous `participant_token` allocation per token+origin on `/handshake` (ADR-0050 §5 join-flood
  cap). Consider a short KV cache of the per-`(session, question)` tally to cut the `GROUP BY` cost on
  the hot poll path (ADR-0046 debounced-pull cost discipline). **Backend agent owns
  `embed-widget-v1.ts`.**

### M-3 — `/handshake` resolves the session from the token but does not re-pin the path/claim the way the GET routes do — **route to backend now**
- **Where:** `functions/api/routes/embed-widget-v1.ts:73-101`.
- **Issue:** `/handshake` reads `claims.sid` directly and calls `fetchEmbedSession(DB, claims.sid)`
  (`:76`) — which is correct (it uses the *token's* sid, not a caller param). **However**, the two GET
  routes go through `resolveTokenSession` (`:54-66`), which adds the defence-in-depth assertion that
  the resolved row's `id === claims.sid` and that the path `:idOrCode` matches the token by either
  handle (`:60`, `:64`). The handshake has no path param so the param-match is moot, but the
  asymmetry means the **session-pinning invariant lives in two places** with slightly different logic.
  More importantly, `fetchEmbedSession` resolves by `id = ?1 OR code = ?1` (`embedWidgetRepository.ts:140`)
  — passing `claims.sid` (a canonical id) is safe, but the `OR code` clause is a latent footgun: if a
  future caller ever passes a *code* that collides with another session's *id*, the `OR` resolves
  ambiguously. Today `claims.sid` is always an id so there is no live exploit, but the dual-handle
  `OR` query under a token-pinned plane is fragile.
- **STRIDE:** Tampering / Elevation (latent — session confusion if the resolution invariant drifts).
- **Severity rationale:** Medium — no live exploit (the handshake uses the trusted `claims.sid`), but
  it is a correctness/robustness gap on a security-critical pin that the pentest will fuzz.
- **Recommended fix:** route the handshake through the same `resolveTokenSession`-style assertion (or
  add an explicit `session.id === claims.sid` check post-fetch), and split `fetchEmbedSession` into a
  by-id and a by-code accessor so the token plane only ever resolves by the canonical id it pinned.
  **Backend agent owns `embed-widget-v1.ts` + the repository.**

---

## ⚪ Low / tracking

- **L-1 — verify-failure reason reflected to client** (`widget-token.ts:55-56`). Collapse non-expiry
  reasons to opaque `invalid_token`. See axis 2. Low.
- **M-4 (hardening) — CSRF exemption uses `startsWith('/api/embed/v1/')`** (`csrf.ts:56`). It is
  correct today (the read plane has no cookie-authed siblings under that prefix), but a *prefix*
  match is a future footgun: any later route mounted under `/api/embed/v1/` automatically inherits the
  CSRF exemption. Document that `/api/embed/v1/*` is a permanently cookie-less namespace, and never
  mount a cookie-authed route under it. Tracking, not blocking.
- **M-5 (out-of-scope tracking) — `frame-ancestors` CSP on the embeddable page** is an SDK/frontend
  deliverable (EMBED-SDK-01), not present in any audited backend file. Must be verified in the
  frontend review + CONTRACT-EMBED-SDK-01. Not a finding against this backend; tracked so it is not
  assumed-done. See axis 3.
- **L-2 (residual) — small-cell aggregate correlation** on `/results` (`total` near 1). Generic
  aggregate de-anon vector, not a field leak; consider a k-anonymity floor. See axis 1 residual risk.

---

## ✅ Good practices observed (keep these)

- **Aggregate-only by construction** — the read-plane repository section has no `votes`-row
  projection; de-anon is closed structurally, not by a runtime filter (`embedWidgetRepository.ts:122-204`).
- **Single-sourced, timing-safe HMAC** — sign/verify reuse `shared/crypto.ts` `hmacSign` +
  `timingSafeEqual`; no inline MAC (`embed-token.ts:13,107-108`). ADR-0049 lineage honoured.
- **Signature-before-parse** — MAC verified before the payload is JSON-parsed (`embed-token.ts:107` →
  `:113`); untrusted bytes never reach the parser.
- **Fail-closed on missing secret** — both planes 503 when `EMBED_WIDGET_SECRET` is unset
  (`embed.ts:136-139`, `widget-token.ts:42-48`), no default/fallback.
- **Origin pin rejects absent Origin** — `originAllowed` returns false for null/unparseable origin
  (`embed-token.ts:133-136`), so the read plane is not permissive to header-less callers (correctly
  *stricter* than the cookie-CSRF middleware).
- **No token material in audit logs** — token-mint audit logs `exp` + origins only (`embed.ts:173`).
- **No PII in claims**, `created_by` stored but never tokenised (`embed.ts:106`, `migration:22`).
- **Parameterized D1 throughout** the embed repository; no string-concatenated SQL.
- **Read plane mounts no write routes** and is registered above the auth sub-apps so it never inherits
  a stray `authMiddleware` (`app.ts:270-274`).

---

## Regression-test checklist for QA's CONTRACT-EMBED-SDK-01

| # | Test | Expected |
|---|---|---|
| R-1 | **De-anon — schema assertion:** snapshot every read-plane response (`/handshake`, `/state`, `/results`) and assert NO key matches `/voter|hash|ip|fingerprint|email|name|user_?id/i` at any depth | structural pass; counts/option_ids only |
| R-2 | **De-anon — repository guard:** static assertion that `embed-widget-v1.ts` imports only the aggregate accessors and never a raw-`votes`-row accessor | import allowlist holds |
| R-3 | **Token forgery:** flip one byte of payload, then of MAC → both rejected `401 invalid_token`; unsigned `payload.` (empty MAC) → `401` | forgery closed |
| R-4 | **Expiry:** token with `exp` in the past → `401 token_expired`; TTL request of `999999` clamps to `exp ≤ iat+86400` | expiry + clamp enforced |
| R-5 | **Scope/version escalation:** hand-craft a `scp:'write'` or `v:2` payload (re-MAC'd with the real secret if available, else assert the verifier rejects pre-MAC) → `401 invalid_token` | no escalation |
| R-6 | **Origin pin:** valid token + Origin NOT in `ao` → `403 origin_not_allowed`, NO `Access-Control-Allow-Origin` header; valid token + no Origin header → `403` | cross-origin replay closed |
| R-7 | **Revocation kill-switch:** mint token → `DELETE /widgets/:wid` → reuse the *same still-unexpired* token → `401 token_revoked` | kill-switch overrides exp |
| R-8 | **CORS reflection:** allowlisted Origin → `Access-Control-Allow-Origin: <that origin>` (exact, never `*`) + `Vary: Origin` present on success AND error paths | reflected-allowlist holds |
| R-9 | **Session pin:** token for session A + path `:idOrCode` = session B's id/code → `404`; token sid never resolvable to a foreign session | token-to-session binding |
| R-10 | **Fail-closed:** unset `EMBED_WIDGET_SECRET` → both planes `503 unavailable` | no insecure fallback |
| R-11 | **Mint authz:** non-Team-tier host → mint `403`; host minting for a session they don't own → create `404`; mint `:wid` of another tenant → `404` | entitlement + ownership + IDOR |
| R-12 | **Rate limit (after M-1 fix):** exceed per-token/per-origin budget on `/results` → `429 + Retry-After`; one token's flood does not 429 another token | abuse budget enforced |
| R-13 | **CSRF scope:** cross-origin credentialed POST to a mint route (`/api/embed/widgets`) → blocked by CSRF `403`; cross-origin token POST to `/api/embed/v1/handshake` → allowed (token-gated, exempt) | exemption scoped correctly |
| R-14 | **Malformed input:** non-JSON body to `/handshake` / create / mint → `400`, never `500` | no parse-to-500 |
| R-15 | **`frame-ancestors` (SDK/frontend slice):** the embeddable page sets `CSP: frame-ancestors <allowed_origins>`; framing from a non-allowlisted origin is blocked | clickjacking closed (verify in SDK review) |

---

## Items routed to other agents

| Item | Owner | Why |
|---|---|---|
| **M-1** (read-plane rate limit — ADR-0050 §5 unmet) | **qesto-backend** | `embed-widget-v1.ts`; named Pentest #5 abuse case; blocks SEC-PEN5-01 |
| **M-3** (handshake session-pin + dual-handle `OR` resolution) | **qesto-backend** | `embed-widget-v1.ts` + repository; security-critical pin robustness |
| **M-2** (`team_id = user.sub` tenancy model vs ADR `tid` = teamId) | **qesto-architect** + **qesto-backend** | ADR-vs-impl divergence; decide model or amend ADR-0050 `tid` definition |
| **M-5** (`frame-ancestors` CSP on embeddable page) | **qesto-frontend** | EMBED-SDK-01 deliverable; verify in SDK review + R-15 |

No code was modified in this review (documentation-only scope per task instruction).
