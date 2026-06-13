---
id: ADR-0050
status: accepted
created: 2026-06-12
accepted: 2026-06-12
deciders: architect, product-owner, security, backend, frontend
relates_to: SPRINT85_99_PLAN, SPRINT81_90_PLAN, BACKLOG_MASTER, ADR-0009-pii-sanitization, ADR-0010-zero-knowledge-mode, ADR-0044-townhall-anonymity, ADR-0049-verifiable-voting-receipt-tally-integrity
---

# ADR-0050: Embeddable SDK Auth + Widget Origin Sandboxing (EMBED public widget)

## Context

The EMBED epic (E87, S87–S88) opens Qesto's **highest-TAM-ceiling** new-buyer surface: the
Typeform / embed-widget competitive frontier. A Qesto customer must be able to drop a **live
engagement widget** — join + live results — onto *their own* website, intranet, or LMS, and
have participants vote and watch aggregate results render in-page without ever visiting a
Qesto-hosted URL. EMBED-SDK-01 (21 pts, P0) ships the loader + sandboxed widget; the public
widget API (EMBED-WIDGET-API-01) is its read-only data plane.

This is structurally different from every prior surface and is the load-bearing reason this
ADR exists before a line of code is written:

- **The caller is now an untrusted third-party origin.** Every prior API caller is either an
  authenticated host (cookie/JWT), an authenticated participant (session-scoped), or a
  server-to-server integrator holding an API key (`public-api-v1.ts` / `public-api-auth.ts`).
  A widget runs in *the customer's* page, served from *the customer's* origin, with no Qesto
  cookie and no ability to safely hold an API key (it would be world-readable in page source).
  We need a **new credential class** that is safe to ship to a browser on a third-party origin.
- **Anonymity is non-negotiable and now leaves our perimeter.** ADR-0009 (PII sanitization),
  ADR-0010 (zero-knowledge), and ADR-0044/0047 (town-hall anonymity-by-construction) all hold
  *inside* Qesto. The widget API is the first surface that streams session data **into a page
  Qesto does not control**. If a single per-participant identifier leaks through the widget
  API, it is exfiltrated to an arbitrary third party. The widget data plane must therefore be
  **aggregate-only, by construction** — the same anonymity-by-construction discipline ADR-0049
  applied to the ballot ledger, applied here to the read API.
- **The embed is an iframe on a hostile DOM.** A widget loaded in a customer page shares
  nothing trustworthy with that page. It must be **sandboxed** (constrained `sandbox` iframe)
  and may only talk to the host page through a **narrow, typed `postMessage` protocol** — never
  by reaching into the parent DOM, and never trusting an arbitrary inbound message.
- **This is a Pentest #5 surface.** The S87 plan opens Pentest #5 (governance + embed + agent;
  `SPRINT85_99_PLAN.md:88`, crit/high = 0 gate at S89). The named EMBED threats are: token
  theft / replay across origins, origin-allowlist bypass, **de-anonymization via the widget
  API**, clickjacking of the embeddable page, and flood/abuse of the unauthenticated-looking
  read surface. This ADR must structurally close each.

Non-negotiable constraints carried in: Workers AI only, **no third-party egress** (hard rule
#1 — though EMBED touches no AI path); **secrets via `wrangler pages secret put`, never
`wrangler.toml`** (hard rule #2) — the widget signing key is a secret, not a var; edge-first
(Pages Functions + D1 + KV, no new infrastructure); `{ ok, data, trace_id }` envelope and the
deprecation/versioning conventions of the existing public API (`public-api-v1.ts`); the
shared HMAC primitive in `functions/api/lib/shared/crypto.ts` (`hmacSign`) is the single
signing source (Shared-primitives gate) — no route mints its own MAC inline.

## Decision

Ship a **signed, short-lived, origin-bound widget token** minted by an authenticated host
(Team-tier+), plus an **aggregate-only public widget API** the token unlocks, plus a
**sandboxed iframe + typed postMessage** embed runtime. No new infrastructure, no AI on the
embed path, no third-party call.

### 1. Widget auth model — origin-bound, read-scoped, short-lived token

A host on Team tier+ mints a widget token via an **authenticated** endpoint (cookie/JWT +
`planMiddleware` gate on the new `embedWidgets` entitlement, §4). The token is a compact
HMAC-signed envelope — **not a JWT-with-secrets-in-payload**, not an API key — safe to embed
in a public page because it grants only aggregate-read against one session and is bound to the
customer's origin(s) and a short TTL.

**Claims** (the signed payload):

```
{
  v:    1,                    // token format version
  wid:  string,               // embed_widgets.id — the widget config row (revocation handle)
  sid:  string,               // sessionId  (canonical) — see code note
  code: string,               // session join code (the public, shareable handle)
  tid:  string,               // teamId — tenant binding
  ao:   string[],             // allowedOrigins — exact origin strings, lowercased, no trailing slash
  scp:  'read',               // scope — READ-ONLY by default and the only value v1 mints
  iat:  number,               // issued-at (epoch seconds)
  exp:  number                // expiry — short TTL (default 3600s; max 86400s)
}
```

- **Signing.** `token = base64url(payloadJson) + '.' + hmacSign(EMBED_WIDGET_SECRET,
  base64url(payloadJson))`, reusing `functions/api/lib/shared/crypto.ts:hmacSign`
  (HMAC-SHA-256). `EMBED_WIDGET_SECRET` is a **server secret set via
  `wrangler pages secret put EMBED_WIDGET_SECRET`** — never in `wrangler.toml` (hard rule #2).
  Verification re-signs the payload and compares with a **timing-safe** equality
  (`shared/crypto.ts` timing-safe compare — same primitive lineage as ADR-0049). This is the
  ADR-0049 "single-sourced primitive, no inline MAC" discipline applied to the token.
- **`scp` is `'read'` by default and is the only scope v1 mints.** A widget token can view
  live state, view aggregate results, and perform the join handshake. It can **never** mutate:
  no host/owner action, no question add/advance, no session lifecycle, no settings. The widget
  API does not even mount write routes. A future write scope (e.g. a participant vote-cast over
  the widget) is an additive, separately-ADR'd decision — §7 — and is out of S87 scope.
- **Short TTL.** Default `exp = iat + 3600`; the mint endpoint may request up to 86400s. The
  embed SDK is expected to re-mint via the host page's own backend (the host holds the auth
  cookie / API key) when a token nears expiry — the token is a *delegation*, not a long-lived
  credential. A stolen token is therefore self-limiting in time **and** pinned to origin (§3).
- **No PII in the token.** Claims carry tenant + session handles only — no `users.id`, no email,
  no participant identity. The token is safe to log (trace) and safe to sit in page source.

> **Code note (sid vs code).** The widget API accepts `:idOrCode` and resolves to one session;
> the token carries both `sid` and `code` so the API can validate the path param against the
> token regardless of which handle the embed uses, and so a token cannot be pointed at a
> different session than it was minted for.

### 2. Public widget API surface — aggregate-only, `{ ok, data, trace_id }`

A new read-only route module `functions/api/routes/embed-widget-v1.ts`, mounted at
`/api/embed/v1`, fronted by a **`widgetTokenMiddleware`** (validates signature, TTL, origin,
and session-handle match — §3). It mirrors `public-api-v1.ts` conventions: the `{ ok, data,
trace_id }` envelope, versioned path, and a deprecation posture available for future `v2`.

| Method + path | Purpose | Returns (aggregate-only) |
|---|---|---|
| `POST /api/embed/v1/handshake` | join handshake: validate token+origin, allocate an anonymous embed participant token (session-scoped, no identity), return display config | `{ participant_token, session: { code, status, title, anonymity_mode }, branding }` |
| `GET /api/embed/v1/sessions/:idOrCode/state` | current live state for render: status, active question id/kind/prompt/options (no per-voter data) | `{ status, active_question, response_count, participation_rate }` |
| `GET /api/embed/v1/sessions/:idOrCode/results` | **aggregate** tallies for the active/closed question(s) | `{ question_id, counts_by_option: {…}, total }` — counts only |

**Hard anonymity guarantee (Pentest #5).** These endpoints return **aggregate counts only**.
No row is ever shaped with a `voter_id`, `voter_hash`, IP, fingerprint, email, name, or any
per-participant field — the widget query path selects `COUNT(*)`/`GROUP BY` aggregates
exclusively (the `public-api-v1.ts:/results` `GROUP BY option_id` shape, never the raw
`votes` rows). In a **zero-knowledge** session (ADR-0010) the same aggregate contract holds; in
**town-hall anonymity** sessions (ADR-0044) author identity never enters the widget projection.
There is no widget endpoint that can return an individual response. This is asserted in
`CONTRACT-EMBED-SDK-01` and is a structural Pentest #5 acceptance criterion, not a runtime check.

The handshake's `participant_token` is an **anonymous, session-scoped** join credential (same
anonymity-by-construction lineage as the town-hall author flow) — it lets the embed submit a
vote *through the existing participant vote path* if/when a write scope is enabled later (§7),
but it carries no identity and is itself read-aggregate-safe.

### 3. Origin sandboxing — allowlist, iframe sandbox, postMessage, CORS + CSP

Three coordinated controls; all three must hold for an embed to render and talk to its host:

**(a) Per-team allowed-origins allowlist, bound into the token.** Each `embed_widgets` row
(§6) carries `allowed_origins` (a JSON array of exact origin strings). At mint time the host's
requested origins are validated to be a subset of the **team's** registered origins, and the
resolved set is copied into the token's `ao` claim. The widget API's `widgetTokenMiddleware`
validates the request's `Origin` header against `ao` on **every** call — a token is useless
from any origin not in its allowlist, which is what makes a stolen token non-replayable
cross-origin.

**(b) Sandboxed iframe.** The Qesto loader (`embed.js`, served from Pages) injects the widget
as an iframe pointing at a Qesto-hosted embed page, with a constrained sandbox:

```
sandbox="allow-scripts allow-forms allow-popups"   // NO allow-same-origin → no parent DOM, no parent cookies
allow="">                                           // no powerful features (camera/mic/geolocation) granted
```

Omitting `allow-same-origin` is deliberate: the widget runs in an opaque origin and **cannot**
read the host page's DOM, cookies, or storage, and the host page cannot reach into the widget.
All cross-frame communication goes through (c).

**(c) Constrained postMessage protocol.** The widget and the host page exchange only typed,
versioned messages, and **each side validates `event.origin`** against the expected counterpart
(the host validates against the Qesto embed origin; the widget validates against its `ao`
allowlist) before acting. Message shapes (v1):

```ts
// widget → host
{ source: 'qesto-embed', v: 1, type: 'ready' }                              // widget mounted, handshake done
{ source: 'qesto-embed', v: 1, type: 'resize', height: number }            // request host to set iframe height
{ source: 'qesto-embed', v: 1, type: 'event',
  event: 'joined' | 'voted' | 'results_updated' | 'session_closed',
  payload?: { code?: string; questionId?: string } }                       // aggregate-safe lifecycle pings only

// host → widget
{ source: 'qesto-embed', v: 1, type: 'host_ready' }                         // host acknowledges, may pass theme
{ source: 'qesto-embed', v: 1, type: 'config', theme?: 'light' | 'dark' }  // optional host-driven theming
```

The `event` messages carry **no participant identity and no raw response** — only
aggregate-safe lifecycle signals (the same aggregate boundary as §2). Any message lacking
`source === 'qesto-embed'`, the expected `v`, or a trusted `event.origin` is dropped silently.
`resize` is the only message that mutates host layout, and it carries only a height integer.

**(d) CORS + CSP posture.**
- The **widget API** (`/api/embed/v1/*`) sets `Access-Control-Allow-Origin` to the request's
  `Origin` **only when** that origin is present in the token's `ao` allowlist (reflected
  allowlist, never `*`), with `Vary: Origin`. A non-allowlisted origin gets no CORS grant and
  the request is rejected by `widgetTokenMiddleware`. This reuses the `Origin`-validation
  discipline of `functions/api/middleware/csrf.ts` / `lib/origin.ts`, generalised to a
  per-token allowlist rather than the single `PAGES_URL`.
- The **embeddable page** (the iframe's `src`, served from Pages) sets
  `Content-Security-Policy: frame-ancestors <allowlisted origins>` so the page can only be
  framed by the team's registered origins — closing clickjacking and stopping the widget being
  re-hosted on an attacker origin. `X-Frame-Options` is *not* used (it cannot express an
  allowlist); `frame-ancestors` is the canonical control.

### 4. Plan gating — `embedWidgets` entitlement, Team tier+

A new `embedWidgets: boolean` key in `PlanQuotas.featuresUnlocked`
(`functions/api/types.ts`), gated **at token-mint time** by `planMiddleware`:
`free=false, starter=false, team=true` — Team tier and above, matching the `townhallQA` /
`crossSessionInsights` / `recurringWorkspaces` / `verifiableVoting` Team-only precedent.

The gate is enforced **only on the authenticated mint endpoint** (and on the
allowed-origins management endpoints). The **widget API itself does not re-check the plan** —
it trusts the token: a validly-signed, unexpired, origin-matching token *is* proof the mint
gate passed. This keeps the high-volume read path cheap (one HMAC verify, no D1 plan lookup)
and is safe because the token's TTL bounds how long a downgraded team's existing tokens keep
working (≤ `exp`); revocation (`embed_widgets.revoked_at`, §6) is the immediate kill-switch.

### 5. Rate / abuse budget — per-token, per-origin, no de-anonymization

- **Per-token rate limit** keyed on `wid` (KV counter, reusing the existing rate-limit KV
  pattern), and a **per-origin** limit keyed on the request `Origin`, so one abusive embed
  cannot exhaust another team's budget. Defaults (tunable): handshake ≤ N/min per token; state
  poll ≤ M/sec per token (the embed polls aggregate state on a debounced interval — the
  ADR-0046 "presenter-triggered debounced pull" cost discipline, applied to the embed).
- **Flood control.** Exceeding the budget returns `429` with `Retry-After`; the embed SDK
  honours it with backoff. The handshake additionally caps anonymous participant-token
  allocation per token+origin to blunt join-flood.
- **No-de-anonymization hard guarantee (Pentest #5).** Independent of rate limits, the widget
  API has **no endpoint and no query shape** that returns per-participant data (§2). Even an
  attacker with a valid token and unlimited budget can only read aggregates. This is the
  structural guarantee — rate limiting protects availability; the aggregate-only contract
  protects anonymity. Both are Pentest #5 (`SEC-EMBED-ORIGIN-01`, `SEC-PEN5-PREP-01`) deliverables.

### 6. Data model hint — `embed_widgets` (migration `0055_embed_widgets`)

The backend adds **one** table; specified here, not written (per the documentation-only scope).
Migration file family `migrations/0055_embed_widgets.sql` (+ `.meta.toml` / `.verify.sql`,
matching the 0053/0054 convention), mirrored into `schema.sql` as the canonical fresh-DB source.

```
embed_widgets(
  id                 TEXT PRIMARY KEY,        -- widget config id; the token's `wid` + revocation handle
  team_id            TEXT NOT NULL,           -- tenant binding (FK semantics to teams)
  session_id         TEXT NOT NULL,           -- the embedded session (canonical id)
  session_code       TEXT NOT NULL,           -- the public join code (token `code` claim)
  allowed_origins    TEXT NOT NULL,           -- JSON array of exact origin strings (token `ao` source)
  scope              TEXT NOT NULL DEFAULT 'read'  -- CHECK (scope IN ('read'))  v1: read only
                       CHECK (scope IN ('read')),
  created_by         TEXT NOT NULL,           -- minting host user id (audit only, never in token)
  created_at         INTEGER NOT NULL,
  revoked_at         INTEGER                   -- NULL = active; non-NULL = immediate kill-switch
)
-- idx_embed_widgets_team   ON (team_id)
-- idx_embed_widgets_session ON (session_id)
```

- `allowed_origins` is the **source of truth** for both the token's `ao` claim and the embed
  page's `frame-ancestors` CSP — one allowlist, two enforcement points.
- `revoked_at` is the immediate revocation lever: `widgetTokenMiddleware` rejects a token whose
  `wid` row is revoked, overriding a still-unexpired `exp`. (A revocation check is one indexed
  D1 read; cache in KV with a short TTL if the read path needs it.)
- `created_by` is audit-only and **never** copied into the token (no PII / user id in the
  browser-shipped credential — §1).

### Data model (TypeScript — `functions/api/types.ts`)

```ts
export interface PlanQuotasFeatures {
  // …existing keys…
  /** EMBED (ADR-0050): mint origin-bound widget tokens + embed live widget — Team tier only. */
  embedWidgets: boolean
}

export interface EmbedWidget {
  id: string
  team_id: string
  session_id: string
  session_code: string
  allowed_origins: string[]   // stored as JSON TEXT in D1
  scope: 'read'
  created_by: string
  created_at: number
  revoked_at: number | null
}

export interface EmbedWidgetTokenClaims {
  v: 1
  wid: string
  sid: string
  code: string
  tid: string
  ao: string[]
  scp: 'read'
  iat: number
  exp: number
}

// postMessage protocol (shared by SDK + embed page)
export type EmbedToHostMessage =
  | { source: 'qesto-embed'; v: 1; type: 'ready' }
  | { source: 'qesto-embed'; v: 1; type: 'resize'; height: number }
  | { source: 'qesto-embed'; v: 1; type: 'event';
      event: 'joined' | 'voted' | 'results_updated' | 'session_closed';
      payload?: { code?: string; questionId?: string } }

export type HostToEmbedMessage =
  | { source: 'qesto-embed'; v: 1; type: 'host_ready' }
  | { source: 'qesto-embed'; v: 1; type: 'config'; theme?: 'light' | 'dark' }
```

## API surface (new `routes/embed.ts` [authenticated mint] + `routes/embed-widget-v1.ts` [public read])

| Method + path | Purpose | Gate |
|---|---|---|
| `POST /api/embed/widgets` | create an `embed_widgets` config (session + allowed origins) | host auth + `planMiddleware('embedWidgets')`; origins ⊆ team allowlist |
| `GET /api/embed/widgets` | list the team's widget configs | host auth + `embedWidgets` |
| `POST /api/embed/widgets/:wid/token` | **mint** a short-lived origin-bound widget token | host auth + `embedWidgets`; validates origins ⊆ row `allowed_origins` |
| `DELETE /api/embed/widgets/:wid` | revoke (sets `revoked_at`) | host auth + `embedWidgets` |
| `POST /api/embed/v1/handshake` | widget join handshake; allocate anonymous participant token | `widgetTokenMiddleware` (token + origin) |
| `GET /api/embed/v1/sessions/:idOrCode/state` | aggregate live state for render | `widgetTokenMiddleware` |
| `GET /api/embed/v1/sessions/:idOrCode/results` | aggregate tallies (counts only) | `widgetTokenMiddleware` |

## Security properties (SEC-EMBED-ORIGIN-01 / SEC-PEN5-PREP-01 / Pentest #5)

- **Token theft / cross-origin replay** — a stolen token is pinned to its `ao` allowlist
  (validated against the `Origin` header on every call) and to a short `exp`; it is unusable
  from an attacker origin and self-expires. `revoked_at` is an immediate kill-switch.
- **Origin-allowlist bypass** — the allowlist is enforced at three points from one source of
  truth (`embed_widgets.allowed_origins`): the token `ao` claim, the widget API CORS/`Origin`
  check, and the embed page `frame-ancestors` CSP. Bypassing one does not bypass the others.
- **De-anonymization (the headline Pentest #5 threat)** — structurally closed: the widget API
  has no endpoint and no query shape that returns per-participant data; results are `COUNT`/
  `GROUP BY` aggregates only. ZK and town-hall anonymity modes are preserved across the embed
  boundary. No identity ever crosses into the third-party page.
- **Clickjacking / re-hosting the widget** — `frame-ancestors` limits framing to the team's
  registered origins; the widget cannot be re-framed on an attacker page.
- **Iframe DOM / cookie exfiltration** — `sandbox` without `allow-same-origin` denies the
  widget any access to the host DOM/cookies/storage and vice versa; only typed, origin-checked
  postMessage crosses the boundary.
- **postMessage injection** — both sides validate `source`, `v`, and `event.origin`; untyped
  or untrusted-origin messages are dropped; only `resize` (an integer) mutates host layout.
- **Flood / availability** — per-token + per-origin rate limits with `429`/`Retry-After`;
  one abusive embed cannot starve another team.
- **Secret hygiene** — `EMBED_WIDGET_SECRET` is a Pages secret (hard rule #2), HMAC verified
  timing-safely via the single shared primitive; no secret material ships to the browser.

## Alternatives considered

- **Ship the existing public API key to the widget** — rejected. An API key embedded in a
  public page is world-readable, grants team-wide read (not session-scoped), and is not
  origin-bound or short-lived. The widget token is the minimal, origin-pinned, read-scoped,
  self-expiring credential the browser case requires.
- **Full JWT with the standard auth secret** — rejected as overkill and as secret-coupling. A
  compact HMAC envelope over an explicit claim set, signed with a *dedicated*
  `EMBED_WIDGET_SECRET`, isolates the embed blast radius from the auth/session JWT secret and
  keeps the token small enough to sit in a `data-` attribute. (Verification reuses the same
  `shared/crypto.ts` HMAC + timing-safe primitive, so there is no new crypto.)
- **Stream live results to the embed over a WebSocket / Durable Object** — rejected for S87.
  The DO is the LIVE realtime authority for *participants on Qesto*; fanning the single-threaded
  `SessionRoom` (ADR-0001) out to arbitrary third-party origins multiplies its connection
  envelope and abuse surface. A debounced **aggregate poll** over the read API (ADR-0046 cost
  discipline) meets the embed UX at far lower risk and zero DO change. A widget WS push is a
  possible future tier, separately ADR'd.
- **Render the embed same-origin (no sandbox) for richer host integration** — rejected. It
  hands the host page the widget's DOM/storage and vice versa, collapsing the privacy boundary.
  The opaque-origin sandbox + typed postMessage is the only posture compatible with the
  anonymity guarantee.
- **`Access-Control-Allow-Origin: *` on the widget API** — rejected. It would let any origin
  read aggregate session data with a token, defeating origin-pinning. Reflected-allowlist CORS
  (echo the `Origin` only if it is in `ao`) is the correct posture.
- **Let the widget token carry a write/vote scope in v1** — rejected for S87 scope and risk.
  v1 mints `scp:'read'` only; a vote-cast-over-embed scope reopens abuse/anonymity questions
  (anonymous ballot stuffing from an arbitrary origin) that warrant their own ADR and Pentest
  pass. The handshake already provisions an anonymous participant token so a future write scope
  is additive, not a redesign.
- **New per-widget signing key instead of one server secret** — rejected for S87. Per-widget
  keys add a key-management surface for no security gain over `wid`-scoped claims + a single
  rotated server secret; the `revoked_at` row gives per-widget revocation already.

## Consequences

- A new third-party embed surface ships with **no new infrastructure**: one D1 table, one
  Pages secret, two route modules (authenticated mint + public read), one middleware, reusing
  `shared/crypto.ts` HMAC, the `origin.ts`/CSRF `Origin`-validation discipline, the rate-limit
  KV pattern, the `{ ok, data, trace_id }` envelope, and `planMiddleware`.
- The **anonymity boundary is preserved by construction** across the Qesto perimeter: the
  widget API is aggregate-only and has no shape that can emit identity, so ZK and town-hall
  guarantees survive embedding. This is the defensible core for Pentest #5 and any DPA review.
- The widget API read path is **cheap and scalable**: one HMAC verify + an aggregate D1 read,
  no plan lookup, cacheable per `(session, question)` — the embed poll scales to the
  highest-TAM read volume without touching the DO.
- **Token lifecycle is the host's responsibility**: tokens are short-lived delegations the host
  re-mints from its own backend. The SDK surfaces re-mint guidance; a lapsed token degrades to
  a re-handshake, never a data leak.
- A new `embedWidgets` entitlement must be added to **every** plan tier in `PLAN_QUOTAS`
  (`free/starter=false, team=true`).
- **Versioned from day one**: `/api/embed/v1` and a `v:1` token/postMessage format leave room
  for a `v2` (e.g. a write scope or WS push) without breaking shipped embeds — same
  deprecation-header posture as `public-api-v1.ts`.

## Do-not-co-land discipline (Pentest #5 surface coordination)

S87 opens **Pentest #5 = governance + embed + agent** as a single surface
(`SPRINT85_99_PLAN.md:88`). ADR-0050 (embed) shares that pentest window with ADR-0049 (DELIBERATE
governance, S86–S87) and the agent-runtime surface. Per the sprint-plan sequencing note
(`SPRINT85_99_PLAN.md:269` — "ADR-0056/0057 do **not** co-land at GA … sequenced not bundled"),
**EMBED, governance GA, and agent-runtime changes must not co-land in a single release.** Each
must clear its own Pentest #5 slice (`SEC-PEN5-PREP-01` S87 → `SEC-PEN5-01` S87–S89, crit/high
= 0 gate at S89) independently. The shared risk to flag at review: all three surfaces touch the
anonymity / origin-trust boundary, so a regression in one (e.g. an identity leak via embed)
contaminates the whole Pentest #5 clearance. Land embed behind the `embedWidgets` gate, ship the
mint + read planes together but the write scope never, and treat the **EMBED traction gate**
(`SPRINT85_99_PLAN.md:340` — ≥10 live embeds before the S93 LEARN commit) as the signal to
extend, not a reason to rush write scope into v1.

## Contract summary for implementers

**Endpoints (authenticated mint — `routes/embed.ts`, host auth + `planMiddleware('embedWidgets')`):**
- `POST /api/embed/widgets` — create widget config `{ session_id|code, allowed_origins[] }`
- `GET  /api/embed/widgets` — list team widget configs
- `POST /api/embed/widgets/:wid/token` — mint a token `{ origins[], ttl? }` → `{ token, exp }`
- `DELETE /api/embed/widgets/:wid` — revoke (set `revoked_at`)

**Endpoints (public read — `routes/embed-widget-v1.ts`, `widgetTokenMiddleware`, `{ ok, data, trace_id }`):**
- `POST /api/embed/v1/handshake` → `{ participant_token, session, branding }`
- `GET  /api/embed/v1/sessions/:idOrCode/state` → `{ status, active_question, response_count, participation_rate }`
- `GET  /api/embed/v1/sessions/:idOrCode/results` → `{ question_id, counts_by_option, total }` (aggregate only)

**Token (HMAC-SHA-256 over base64url payload; `hmacSign(EMBED_WIDGET_SECRET, …)`; timing-safe verify):**
`{ v:1, wid, sid, code, tid, ao:string[], scp:'read', iat, exp }` — TTL default 3600s, max 86400s,
read-only, origin-bound, no PII. Secret via `wrangler pages secret put EMBED_WIDGET_SECRET`.

**FeatureKey:** `embedWidgets: boolean` in `PlanQuotas.featuresUnlocked` — `free=false,
starter=false, team=true`. Gate enforced at mint; widget API trusts the token.

**Migration table `0055_embed_widgets`** (mirror into `schema.sql`):
`embed_widgets(id PK, team_id, session_id, session_code, allowed_origins JSON, scope DEFAULT
'read' CHECK(scope IN ('read')), created_by, created_at, revoked_at NULL)`; indexes on
`team_id` and `session_id`.

**postMessage protocol (`v:1`, `source:'qesto-embed'`, both sides validate `event.origin`):**
- widget → host: `ready`; `resize{height}`; `event{event:'joined'|'voted'|'results_updated'|'session_closed', payload?}`
- host → widget: `host_ready`; `config{theme?:'light'|'dark'}`

**Iframe sandbox:** `sandbox="allow-scripts allow-forms allow-popups"` (NO `allow-same-origin`),
`allow=""`. **Embed page CSP:** `frame-ancestors <team allowed_origins>`. **Widget API CORS:**
reflect `Origin` only if in token `ao`, `Vary: Origin`, never `*`.

## Amendment 1 — embed tenancy model ratified (PEN5-E2, S90 / v6.0 GA)

**Status:** accepted 2026-06-19 (S90). **Deciders:** architect, security, product-owner.

Pentest #5 raised **PEN5-E2** (Medium): the widget token `tid` claim and the
`embed_widgets.team_id` column are both set to the session-**owner's user id**
(`callerTeamId() = user.sub`, `routes/embed.ts`), not to a separate team id, while the
column is named `team_id`. Security's v6.0-rc gate (`SEC_V60_RC_GATE.md`) classified this
as a **model divergence, not a leak**: tenant isolation is enforced fail-safe on the same
value at both planes (`embedWidgetRepository.ts` keys reads on `team_id`; the token carries
the identical `tid`), so the claim and the column **cannot diverge** and no cross-tenant
read is reachable. It was carried out of the RC as an architecture decision (not RC-gating).

**Decision (S90):** **ratify the session-ownership tenancy model** as the embed plane's
intended design. The embed tenancy key *is* the session owner's user id, consistent with the
DRAFT REST surface (`owner_id = user.sub`) and ADR-0050's original authorization model
(§"the host must own the session"). The `tid` claim is hereby defined as **"the owning
user's id (tenant key)"**, not "a team id"; the `team_id` column name is retained for schema
stability and is understood to hold that same owner key.

**Why not migrate to a real team_id now.** Introducing a distinct team-scoped tenancy for
embed widgets is a deliberate data-model migration (backfill + dual-read + token-version
bump) that would change a trust boundary. Shipping that inside the v6.0 **certification**
sprint is the wrong risk; it is explicitly **out of scope for S90** and parked as a future
backlog item should real-team embed sharing become a requirement.

**Code reflecting this amendment (S90):** clarifying contracts in `routes/embed.ts`
(`callerTeamId` doc) and `lib/embed-token.ts` (`MintTokenInput.tid` doc). No behavioural
change — the value bound and verified is identical to the v6.0-rc code; PEN5-E2 closes as
**resolved-by-ratification**, no longer an open architecture decision.

## Docs updated

- This ADR created: `knowledge-base/adr/ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing.md`.
- Amendment 1 (S90): `routes/embed.ts` + `lib/embed-token.ts` doc comments ratifying the
  session-ownership tenancy model; `SEC_PEN5_01_RESULTS.md` / `SEC_V60_RC_GATE.md` PEN5-E2
  disposition updated to resolved-by-ratification.
- Implementers must, when building EMBED-SDK-01 / EMBED-WIDGET-API-01, update:
  `SPEC_BACKEND` (mint + widget API + `widgetTokenMiddleware`), `SPEC_FRONTEND` (loader +
  sandboxed iframe + postMessage), `SPEC_INTEGRATIONS` (public widget API contract),
  `SPEC_DATAMODEL` (`embed_widgets`), and the security threat model (Pentest #5 EMBED slice).
  `schema.sql` and `functions/api/types.ts` (`embedWidgets` key + interfaces) are the canonical
  code sources to mirror this contract into.

## References

- `knowledge-base/product/planning/SPRINT85_99_PLAN.md` (E87 row :132; ADR-0050 :164; Pentest #5
  :88/:203; EMBED traction gate :340) and `SPRINT81_90_PLAN.md` (E87 :92; ADR-0050 :130;
  S87 stories `EMBED-SDK-01`/`EMBED-WIDGET-API-01` :275, `SEC-EMBED-ORIGIN-01`/`SEC-PEN5-PREP-01`
  :278, `CONTRACT-EMBED-SDK-01` :279)
- `knowledge-base/product/backlog/BACKLOG_MASTER.md` — EMBED epic (E87) stories
- `functions/api/routes/public-api-v1.ts` (`{ ok, data }` envelope, `/results` `GROUP BY`
  aggregate shape, versioned/deprecated public surface), `functions/api/middleware/public-api-auth.ts`
- `functions/api/lib/shared/crypto.ts` (`hmacSign`, timing-safe compare — single signing source)
- `functions/api/middleware/csrf.ts`, `functions/api/lib/origin.ts` (`Origin`-validation discipline)
- `functions/api/types.ts` (`PlanQuotas.featuresUnlocked`, `PLAN_QUOTAS` Team-only precedent)
- `migrations/0054_deliberate_ballots.{sql,meta.toml,verify.sql}` (migration-family convention)
- ADR-0049 (anonymity-by-construction + single-sourced crypto primitive lineage), ADR-0044/0047
  (town-hall anonymity), ADR-0010 (zero-knowledge), ADR-0009 (PII sanitization), ADR-0046
  (debounced-pull cost discipline, plan-gating precedent), ADR-0001 (DO single-threaded — why
  the embed does not fan out the DO)
- Hard rules #1 (Workers AI only / no third-party egress) and #2 (secrets via
  `wrangler pages secret put` — `EMBED_WIDGET_SECRET`)
