# XR Spatial Session Beta — Security Review (S98 Gate)

**Gate:** Sprint 98 — "XR security review — S98 week 3" · **Track:** XR beta (innovation, flag-gated)
**ADR:** ADR-0066 (XR Spatial / Immersive Session Mode — Beta) · **Reviewer:** security (qesto-security)
**Date:** 2026-06-18 · **Release context:** v7.0.0-rc.2 soak/harden (no GA this sprint)
**Threat surface (per SPRINT98_EXECUTION):** WebXR API abuse, avatar spoofing, 2D-fallback XSS.
**Methodology:** OWASP Top 10 (A01 Broken Access Control, A03 Injection, A04 Insecure Design,
A05 Misconfiguration) + STRIDE, scoped to the XR additive realtime surface, ADR-0066 design
contract.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ Good practice.

---

## Verdict

**CLEAR for v7.0.0-rc.2 — no Critical/High finding blocks the RC.** XR is a flag-gated,
kill-gated innovation beta; the agreed gate posture is *"no critical/high findings block RC"*,
and that bar is met against the ADR-0066 contract. The design is **inert when off**
(`BETA_XR_ENABLED='false'` default), **additive** (no protocol-version bump, no touched existing
handler), and **carries no PII** (position/orientation only, ephemeral per-socket avatar id,
ZK-excluded, no coordinates to Analytics Engine).

**Important scope caveat — implementation is NOT yet in the tree.** At review time there is **no**
`BETA_XR_ENABLED` in `flags.ts`, **no** `xr_avatar_sync` variant in `realtime.ts` /
`protocol-schemas.ts`, and **no** `xr.avatar_sync_latency` in `observability.ts` (grep-confirmed
across `functions/`, `src/`, `wrangler.toml`). This review therefore audits the **ADR-0066
contract** and the **precedents it reuses** (which I did code-verify). Every finding below is
tagged **[verify against implementation]** where it depends on code that does not yet exist; those
checks become mandatory verification items on the XR-SPATIAL-01 / XR-AVATAR-01 PR before any
partner session, and are hard gates before GA (S99+).

No release-blocking finding open. Findings are one Medium (M-1, fixed-tick batch is net-new and
not the precedent the ADR names) and Low/defence-in-depth hardening, all with owners and target
sprints recorded below.

---

## Files audited (contract + reused precedents)

| File | Lines reviewed | Why |
|---|---|---|
| `knowledge-base/adr/ADR-0066-xr-spatial-session-beta.md` | 1–276 (full) | Design contract under review |
| `knowledge-base/product/releases/SPRINT98_EXECUTION.md` | 1–207 (full) | Gate definition + AC |
| `functions/api/lib/flags.ts` | 1–49 (full) | Flag accessor `getFlag`/`flagOff`; `FlagName` union (no `BETA_XR_ENABLED` yet) |
| `functions/api/lib/observability.ts` | 240–284 (`QestoEvent` + `writeEvent`) | AE schema reused by `xr.avatar_sync_latency`; fire-and-forget, swallows errors |
| `functions/api/SessionRoom.ts` | 205–294 (`webSocketMessage`, scheduling) | Inbound dispatch + top-level try/catch; alarm scheduler |
| `functions/api/lib/protocol-schemas.ts` | 760–905 (`parseClientMessage`) | Malformed-input handling (returns `null`, not a throw) |
| `functions/api/lib/session-room-messages.ts` | 1–13 (full) | `errorMessage` envelope shape (no internal leak) |
| `functions/api/lib/session-room-townhall-handler.ts` | targeted (`bumpRev`, `rev` deltas) | The "townhall-style `rev` delta" precedent the ADR cites |
| `functions/api/lib/session-room-vote-flow.ts` | 303 (ZK guard) | The ZK `return` precedent the ADR mirrors |
| `functions/api/lib/board-submit-rate.ts` | 1–19 (`consumeSubmitToken`, `TokenBucket`) | The per-socket token-bucket the ADR's inbound coalesce should reuse |

---

## Threat-model findings (the four required axes)

### 1. Avatar spoofing / impersonation — ✅ structurally closed by contract

**Contract is correct: identity is server-assigned; the client never supplies it.**

- The inbound `xr_avatar_sync` `ClientMessage` (ADR §D3) carries **only** `data.p` (position) and
  `data.q` (orientation) — **there is no `a` field on the inbound message**. The ephemeral avatar
  id `a` exists only on the **outbound** `ServerMessage` (ADR §D3, lines 124–134), and the ADR is
  explicit that `a` is "a per-socket random id **minted in the DO**" (§D3 "Ephemeral id only",
  R2). A client therefore has no wire field through which to claim, inject, or overwrite an `a`
  value — the server stamps each avatar in the broadcast batch with the id bound to the socket it
  received the frame on. **This closes the impersonation axis at the protocol shape level**, which
  is the right place to close it.
- `a` is **not** `voterId` and carries **no display name** (§D3, §D4, R2) — so even a leaked `a`
  is non-correlatable across sessions (stable for the socket lifetime only) and discloses no
  identity. This is the same anonymity posture the 2D plane already enforces (ADR §D4).
- **STRIDE — Spoofing:** mitigated by construction. The trust boundary is the socket, not a
  caller-supplied identifier; the DO is the sole authority that maps socket → `a`.

**[verify against implementation] — three checks before this is "code-confirmed", not just
"contract-confirmed":**
- (a) The Zod/schema for the inbound `xr_avatar_sync` variant in `protocol-schemas.ts` **must not
  accept an `a` field** (nor `voterId`, nor any name) — reject/strip extras. `parseClientMessage`
  already returns `null` on schema mismatch (`protocol-schemas.ts:894–905`), so a strict schema is
  the enforcement point. Add a unit test: a client frame containing `a` is rejected or the `a` is
  ignored, never echoed.
- (b) The DO handler must derive `a` from a per-socket minted id (e.g. on the WS attachment),
  **never** from `parsed.data`. Add a test: two sockets cannot produce the same `a`, and a socket
  cannot set another socket's `a`.
- (c) `a` MUST NOT be `voterId` and MUST NOT be logged or persisted (R2). Confirm no `logEvent` /
  `writeEvent` / storage write ever includes `a`.

*Verdict: no spoofing finding. The contract does NOT allow client-supplied identity. Flag only if
the implementation diverges by adding `a` (or any identity) to the inbound schema.*

---

### 2. WebXR API abuse / resource exhaustion (frame flooding) — 🟡 M-1 (design risk, not RC-blocking)

**Contract intent is correct (bounded amplification), but the cited precedent is inexact and the
inbound guard is under-specified.**

- **Amplification is bounded on the fan-out side.** ADR §D3 ("Throttle on the DO") and R1 mandate:
  fan out at a **fixed tick (target 10–15 Hz)** as a **single batched** `xr_avatar_sync` with all
  active avatars + a monotonic `rev` — **never one broadcast per inbound frame**. This is the
  correct defence against the core WebXR-abuse vector: a malicious client running an uncapped rAF
  loop (a headset is ~72–120 Hz) cannot turn N inbound frames into N×(participants) outbound
  messages, because the DO decouples inbound rate from a server-clocked outbound cadence. This
  protects the single-threaded DO event loop (ADR-0001) and is the right design. ✅ **(intent)**

- **🟡 M-1 — the "townhall-style fixed tick" precedent does not actually exist as a fixed-Hz
  timer.** The ADR repeatedly analogises the 10–15 Hz batch tick to "exactly like `townhall_state`
  deltas" (§D3, R1). I verified the townhall handler: it is **event-driven**, not timer-driven —
  `bumpRev()` increments `rev` and broadcasts **on each submit/upvote/moderate action**
  (`session-room-townhall-handler.ts:83–85, 209, 247, 293`). There is **no fixed-Hz batch tick**
  anywhere in the current DO; the only timer primitive is the `scheduleAlarm`/`scheduleFlush`
  alarm machinery (`SessionRoom.ts:285–294`), which is a one-shot coalescing alarm, not a
  steady 10–15 Hz clock. So XR introduces a **net-new realtime primitive** (a recurring server tick
  that fan-outs even when no governance action occurred). The ADR itself concedes this under
  Consequences ("position/orientation broadcast is genuinely net-new realtime fan-out"). The
  security consequence: the amplification bound depends on a tick mechanism that has **no existing,
  load-tested precedent** — a per-frame fan-out regression is a *plausible* implementation mistake
  precisely because the "just copy townhall" framing is misleading.
  - **STRIDE:** Denial of Service (DO event-loop saturation → degraded vote/broadcast latency for
    the *whole* session, not just XR).
  - **Severity:** Medium — bounded by design intent and by the beta flag, but it is the single most
    likely way XR damages the *non-XR* critical path during a partner session.
  - **Remediation:** (1) Implement the fan-out as a fixed-interval alarm/tick that emits **at most
    once per tick** regardless of inbound frame volume, with a hard cap on Hz (≤15). (2) Add a DO
    stress test (owner: e2e-tester) asserting that flooding inbound `xr_avatar_sync` at 120 Hz from
    50 sockets produces ≤15 outbound batches/sec and does not regress the existing vote-broadcast
    p95. (3) Add a CI assertion / code comment that the tick is decoupled from inbound.
  - **Owner:** backend (XR-SPATIAL-01). **Target:** S98 (build) — verify in S98 week-3 closeout;
    **mandatory before any partner session.** Not an RC blocker (flag default off).

- **🟡 M-2 — per-socket inbound rate guard is referenced but not pinned to the existing
  primitive.** ADR §D3 says "Coalesce per-connection inbound at the existing token-bucket cadence"
  but does not name it. The codebase **already has** the right primitive:
  `consumeSubmitToken(bucket, now)` with a per-socket `TokenBucket` (`board-submit-rate.ts:12–19`),
  used today to rate-limit townhall submissions (`session-room-townhall-handler.ts:194`). **Without
  an explicit per-socket inbound cap, the fixed-tick bound (M-1) protects fan-out but NOT inbound
  parse/decode CPU** — a flooding client still forces the DO to `parseClientMessage` + decode +
  coalesce every frame, which is CPU on the shared loop even if nothing is broadcast.
  - **STRIDE:** Denial of Service (inbound CPU exhaustion, distinct from fan-out amplification).
  - **Recommended fix:** apply a per-socket token bucket to inbound `xr_avatar_sync` sized to the
    tick rate (e.g. refill ≈15–30/sec) and **drop** (silently, no error spam) frames over budget —
    do **not** echo an error per dropped frame (that re-introduces amplification). Reuse
    `consumeSubmitToken` / `TokenBucket` rather than inventing a new limiter.
  - **Owner:** backend (XR-AVATAR-01). **Target:** S98 build; verify week-3. Not RC-blocking.

- ✅ **Malformed/oversized inbound cannot 500 the socket.** `parseClientMessage` returns `null` on
  any parse/schema failure (`protocol-schemas.ts:894–905`); `webSocketMessage` responds with a
  controlled `errorMessage('bad_message', …)` and returns (`SessionRoom.ts:208–212`). A throwing
  handler is caught by the top-level try/catch and downgraded to a generic
  `errorMessage('internal', 'Message processing failed')` (`SessionRoom.ts:229–247`) — **no raw
  `err.message`, stack, or internal code reaches the client.** A malformed `p`/`q` array therefore
  yields a 4xx-style protocol error, not a crash. This satisfies the audit blocker on
  malformed-input-to-500 and on internal-detail leakage. **[verify]** the new inbound schema bounds
  `p` to exactly 3 finite numbers and `q` to exactly 4, each in `-1..1`, with `safeParse` — so an
  unbounded array / `NaN` / `Infinity` cannot reach the renderer or the AE count.

---

### 3. 2D fallback XSS / injection — ✅ closed by data shape; one DOM-render guard to verify

- **The XR/avatar wire is numeric-only.** Inbound `p`/`q` are numeric arrays; the avatar id `a` is
  a server-minted opaque id; **no free-text, no name, no URL, no HTML** crosses the XR surface in
  either direction (ADR §D3/§D4). There is no untrusted *string* on the XR plane that could reach
  the DOM. The XSS surface is therefore structurally minimal — the spatial scene renders numbers
  into a WebGL canvas, not strings into the DOM.
- **2D fallback renders the existing 2D poll UI byte-identically** (ADR §D5): if the capability
  gate fails, the user stays on the standard poll UI, "voting and all message handling are
  byte-identical to today." The fallback introduces **no new untrusted data path** — it is the
  already-reviewed 2D path. ✅
- **⚪ L-1 — DOM-render guard to confirm at S99 (fallback story lands S99).** The 2D fallback
  (XR-FALLBACK-01) and launcher (FE-XR-LAUNCHER-01) are **out of scope for S98** (SPRINT98
  §"Out of scope"). When they land, **[verify against implementation]**:
  - the avatar id `a` (if ever surfaced in any 2D presence indicator / debug overlay) must be
    rendered via React text interpolation (auto-escaped), **never** `dangerouslySetInnerHTML`;
  - `p`/`q` must be consumed as `number`s (coerced/validated), never string-concatenated into
    inline styles or transforms without numeric validation (a string `"0;position:fixed"` smuggled
    into a CSS transform is a classic injection — precluded here only if the values are validated
    as numbers, per the §2 [verify] item);
  - no XR telemetry/debug value is written to `innerHTML` or a templated `<style>`.
  - **Severity:** Low (data is numeric; React escapes by default). **Owner:** frontend.
    **Target:** S99 (when the fallback/launcher ship). Add an axe + a unit test asserting no
    `dangerouslySetInnerHTML` on the XR/fallback components.

*Verdict: no XSS finding at S98 (no XR DOM surface ships this sprint). The numeric-only contract
removes the primary vector; L-1 is a confirm-at-S99 guard.*

---

### 4. Privacy / Zero-Knowledge / Analytics Engine — ✅ closed by contract

- **XR is hard-disabled in ZK regardless of the flag.** ADR §D1/§D3/§D4 and R3 require the DO to
  `return` on inbound `xr_avatar_sync` when `meta.anonymity === 'zero_knowledge'`, **and** to omit
  `'xr'` from `init.data.features[]` for ZK sessions — so the launcher never even advertises XR to
  a ZK room. This mirrors the verified ZK precedent at `session-room-vote-flow.ts:303`
  (`if (meta.anonymity === 'zero_knowledge') return`) and the sentiment/coaching ZK exclusions. A
  position-only presence broadcast is correctly treated as a presence signal incompatible with
  ZK unlinkability (ADR-0010). ✅
- **Guard ordering is specified correctly:** flag check **then** ZK check, **before** any fan-out
  and before `'xr'` is appended to `features[]` (ADR §D3, R3). This is the right order — ZK must
  win even if the flag is on.
- **No PII / no coordinates to Analytics Engine.** The `xr.avatar_sync_latency` event (ADR §D6)
  maps only `sessionId`/`teamId`/`traceId` (blobs) + `durationMs` (double1) + `count` (double2) —
  and the ADR is explicit it "never carries `avatarId`, `voterId`, or coordinates." This fits the
  **verified** `writeEvent` schema (`observability.ts:262–284`), which only serialises the typed
  `QestoEvent` fields (no positional/coordinate field exists on the type), so there is **no field
  through which coordinates could leak even by mistake.** `writeEvent` is fire-and-forget and
  swallows errors (`observability.ts:279–283`) — XR telemetry can never affect session liveness.
  ✅
- **No persistence of avatar state.** Avatar state is transient in-DO only — never written to
  D1/KV, never in the session snapshot, dropped on disconnect (ADR §D3 "No persistence", R2). This
  preserves the GDPR/ZK posture (nothing to export, nothing to erase, no presence log).

**[verify against implementation] — R3 is the highest-value privacy test:**
- A ZK session **never** emits `xr_avatar_sync` and **never** advertises `'xr'` in `features[]`,
  even with `BETA_XR_ENABLED='true'`. (ADR R3 explicitly asks for this unit test — make it a hard
  gate.)
- The `QestoEvent` extension for `xr.avatar_sync_latency` adds **only** the event-name string to
  the union — **no** new coordinate/avatar field on `QestoEvent`. Confirm the emit call site passes
  only `durationMs`/`count`.
- The minted `a` and `p`/`q` never appear in any `logEvent`/`writeEvent`/storage call.

---

### 5. Flag inertness (`BETA_XR_ENABLED=false`) — ✅ closed by contract

When the flag is off, the surface is **fully inert** (ADR §D1, Consequences, Rollback):
- the DO **never emits** `xr_avatar_sync` and **ignores inbound** `xr_avatar_sync` via a no-op
  early `return` (additive branch — existing vote/advance/townhall/captions handling is
  "byte-for-byte unchanged");
- `init` **omits** the `'xr'` capability, so the frontend launcher never mounts the XR engine;
- the lazy WebGL chunk is **never** in the critical bundle (and at S98 `three` is not even a
  dependency — D2 defers it to S99), so first-paint and `npm run build` are unaffected;
- **no protocol-version bump** (R5) — both variants are additive on v3, so a flag-off deploy is
  indistinguishable on the wire from today.
- The flag doubles as a **kill-switch**: flipping `BETA_XR_ENABLED='false'` at the environment
  level silences all XR traffic with no deploy (Rollback step 1).

This satisfies the A05 (misconfiguration) and A04 (insecure design) posture for a beta: the safe
state is the default state, and disabling is instantaneous.

**[verify against implementation]:**
- `getFlag(env, 'BETA_XR_ENABLED')` is checked **first** in the inbound handler (before ZK, before
  any work) — reuse the verified `flagOff(...)` accessor (`flags.ts:47`).
- `BETA_XR_ENABLED='false'` default present in `wrangler.toml [vars]` (string, not boolean —
  `getFlag` compares `=== 'true'`).
- With the flag off, **no** `'xr'` ever appears in `features[]` and the inbound handler returns
  before touching transient state. Add a test: flag-off DO drops `xr_avatar_sync` and never
  broadcasts one.

---

## Findings register

| ID | Severity | Axis | Status | Owner | Target |
|---|---|---|---|---|---|
| M-1 | 🟡 Medium | Resource exhaustion / DoS | Open (design risk) — fixed-tick batch is net-new, "townhall precedent" is inexact; must be a true ≤15 Hz tick decoupled from inbound, stress-tested | backend | S98 build; verify wk3; **mandatory pre-partner-session** |
| M-2 | 🟡 Medium | Resource exhaustion / DoS | Open — add per-socket inbound token-bucket (reuse `consumeSubmitToken`); drop over-budget frames silently | backend | S98 build; verify wk3 |
| L-1 | ⚪ Low | 2D-fallback XSS | Open (confirm at S99) — fallback/launcher must render `a` as escaped text and validate `p`/`q` as numbers; no `dangerouslySetInnerHTML` | frontend | S99 (XR-FALLBACK-01 / FE-XR-LAUNCHER-01) |

No 🔴 Critical, no 🟠 High. None blocks v7.0.0-rc.2.

---

## ✅ Good practices in the contract (keep these)

- **Identity is server-minted, not client-supplied** — the inbound message has no `a`/`voterId`
  field at all; impersonation is closed at the wire shape, the strongest place to close it.
- **ZK exclusion mirrors an existing, verified guard** (`vote-flow.ts:303`) with correct ordering
  (flag → ZK → work), and removes XR from `features[]` so it is never even offered to a ZK room.
- **AE event reuses the existing typed schema** with no coordinate field — coordinates *cannot*
  leak to AE because there is no field for them; fire-and-forget can't affect liveness.
- **Transient-only avatar state** — no D1/KV write, no snapshot, dropped on disconnect; nothing to
  erase or export (GDPR-clean by construction).
- **Additive, no protocol bump** (R5) — flag-off is wire-identical to today; existing handlers
  untouched, so the RC-soak blast radius is zero when off.
- **Inert-by-default flag + instant kill-switch** — safe state is the default; disabling needs no
  deploy.
- **Inherited robustness of the DO message loop** — top-level try/catch downgrades any thrown
  handler to a generic `'internal'` error (no `err.message`/stack to client), and
  `parseClientMessage` turns malformed input into a controlled `'bad_message'`, not a 500.

---

## Must-fix before XR could ever go GA (S99+)

XR ships beta-only in v7.0; there is **no GA flag** (ADR §D7). Before any GA claim, the following
move from "verify against implementation" to "proven and gated":

1. **R3 ZK exclusion test is a hard CI gate** — a ZK session must demonstrably never emit
   `xr_avatar_sync` nor advertise `'xr'`, asserted in unit + integration tests. (De-anonymization
   risk; non-negotiable for GA.)
2. **M-1 load evidence** — the ≤15 Hz fixed-tick fan-out must be load-tested at the epic DoD
   (50 concurrent avatars) proving (a) no per-frame fan-out and (b) no regression of non-XR vote
   broadcast p95 under inbound flooding. Bind to the `p95 < 200 ms avatar sync` KPI.
3. **M-2 inbound rate guard present and tested** — per-socket bucket caps inbound CPU; over-budget
   frames dropped, not error-echoed.
4. **L-1 2D-fallback DOM-injection guard** — when the fallback/launcher land (S99), no untrusted
   XR value reaches the DOM unescaped; `p`/`q` validated as numbers; axe + no-`dangerouslySetInnerHTML`
   test.
5. **Inbound schema strictness** — `xr_avatar_sync` `data` schema rejects any extra field
   (especially `a`/`voterId`/name) and bounds `p` (3 finite numbers, -1..1) and `q` (4 finite
   numbers, -1..1); malformed → `bad_message`, never 500.
6. **Confirm `a` is never logged or persisted** (R2) — grep gate on the XR handler.
7. **Three.js bundle-budget assertion** (ADR R4/D2) — when `three` is added at S99, CI must assert
   the default entry chunk is unchanged and the engine lives only in the lazy chunk. (Build-integrity
   / supply-chain hygiene; run `npm audit` on the new dependency and block on high/critical.)

---

## Sign-off

**v7.0.0-rc.2 XR beta surface: CLEAR.** No Critical/High findings; the agreed beta gate posture
("no critical/high blocks RC") is met against the ADR-0066 contract, and the surface is inert with
`BETA_XR_ENABLED='false'` (the default). M-1/M-2 (DoS hardening) are scheduled into the S98 build
and **must** be verified in the week-3 closeout before any design-partner session; L-1 (2D-fallback
XSS guard) is owned by frontend for S99 when the fallback/launcher land. The seven items above are
GA gates (S99+).

**Reviewed against the contract, not yet against code** — re-run this review's
"[verify against implementation]" items on the XR-SPATIAL-01 / XR-AVATAR-01 PR; that PR is the
point at which CLEAR becomes CLEAR-and-code-confirmed.
