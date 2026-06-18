---
id: ADR-0066
status: accepted
created: 2026-06-18
accepted: 2026-06-18
deciders: architect, product-owner, frontend, backend, security
relates_to: SPRINT85_99_PLAN, SPRINT91_99_STORIES, BACKLOG_MASTER, ADR-0001-do-per-session, ADR-0005-do-protocol-versioning, ADR-0010-zero-knowledge-mode, ADR-0011-live-sentiment-inference, ADR-0051-live-captions-translation-pipeline, ADR-0063-v7.0-platform-certification
supersedes: none
sprint: 98
---

# ADR-0066: XR Spatial / Immersive Session Mode (Beta)

> **Numbering note.** The S85–S99 plan reserves **ADR-0063** for "v7.0 platform certification"
> (S99) and ADR-0064/0065 are already taken. XR therefore takes the next free number,
> **ADR-0066**, verified against `knowledge-base/adr/`.

## Context

Epic 8 — XR (`SPRINT91_99_STORIES.md` §"Epic 8", `SPRINT85_99_PLAN.md` §"Sprint 98") ships a
**spatial / immersive session mode as a v7.0 innovation beta only — never GA in v7.0**. Market
signal is thin ("conditionally validated", change-5); the epic carries a hard **kill-criterion**:
if <1 design-partner pull by S98 week 2, XR pivots to the v7.1 backlog and does not ship
(`SPRINT85_99_PLAN.md:343`). The work lands inside the **v7.0 RC soak/harden** sprint, whose
protected serial window and strict realtime/DO protocol governance dominate every decision here:
**XR must be additive and inert when off — zero impact on existing voting/realtime semantics, zero
new trust boundary, zero protocol-version bump.**

S98 builds the spike + spatial rendering + privacy-safe avatars (`XR-00`, `XR-SPATIAL-01`,
`XR-AVATAR-01`); the 2D fallback and the WebXR launcher (`XR-FALLBACK-01`, `FE-XR-LAUNCHER-01`)
land at S99. This ADR is the design contract those stories implement.

Five constraints make the decisions non-obvious:

- **Soak-sprint protocol governance (ADR-0005).** New realtime behavior must follow the
  energizers/townhall/captions precedent: additive `ServerMessage`/`ClientMessage` variants on the
  existing protocol (currently v3), with **no `LiveProtocolVersion` bump** and no change to any
  existing message handler. A version bump or a touched handler during RC soak is disqualifying.
- **WebGL is browser-side only — never Workers AI / never the DO.** 3D rendering is a pure
  client concern. Hard rule #1 (`c.env.AI` only) is not at risk because XR runs no inference; the
  governance risk is **bundle bloat breaking `npm run build`** and **putting render work on the
  single-threaded DO** (ADR-0001), which the captions ADR already rejected for inference.
- **The privacy moat must hold in 3D.** Avatars are non-photorealistic and carry **position +
  orientation only** — no PII, no audio, no photoreal likeness. Anonymity rules (ADR-0009/0010)
  apply unchanged: nothing is rendered in space that the 2D plane would not already show.
- **Zero-knowledge sessions exclude XR.** ZK already disables sentiment and coaching
  (`lib/ai/sentiment.ts:44`, `lib/ai/coaching.ts:41`, `if (anonymity === 'zero_knowledge') ...`).
  Avatar presence broadcast — even position-only — is a presence signal incompatible with ZK's
  unlinkability guarantee (ADR-0010). XR is therefore **off in ZK regardless of the flag**.
- **Non-XR is the default path.** The overwhelming majority of clients have no WebXR. The launcher
  must degrade silently to the existing 2D poll UI; XR is an opt-in overlay, never a gate.

Constraints carried in: feature-flag discipline (`flags.ts`, TD-06); edge-first, no new
infrastructure; `{ ok, data, trace_id }` envelope; AE fire-and-forget event contract
(`lib/observability.ts:262`); the 5-state session machine unchanged; no new secret.

## Decision

### D1 — Feature flag: `BETA_XR_ENABLED` (default `'false'`)

Add **`BETA_XR_ENABLED`** to the `FlagName` union in `functions/api/lib/flags.ts` and a default
`BETA_XR_ENABLED = "false"` to `wrangler.toml [vars]`. Read via the existing typed accessor
`getFlag(env, 'BETA_XR_ENABLED')` / `flagOff(...)`.

XR is **fully gated**. When the flag is off:
- the DO never emits `xr_avatar_sync` and ignores inbound `xr_avatar_sync` (no-op early return);
- the `init` message omits the XR feature capability (see D3);
- the frontend launcher never mounts the XR engine.

The flag gates server emission and the `features[]` advertisement; the DO's `xr_avatar_sync`
handler is an additive branch that **returns immediately** when the flag is off or anonymity is ZK,
so existing vote/advance/townhall/captions handling is byte-for-byte unchanged. The flag is a beta
kill-switch: flipping it off mid-incident silences all XR traffic without a deploy.

### D2 — WebGL: Three.js, lazy-loaded; **dependency deferred to S99 (stub renderer for S98)**

- **Engine choice:** **Three.js** over Babylon.js or custom WebGL. Three.js is the smaller,
  more modular, tree-shakeable core for the narrow scene we need (a centered question object + N
  low-poly avatars); Babylon is a heavier full-engine; hand-rolled WebGL is unjustifiable
  maintenance cost for a beta that may be killed.
- **Loading:** the XR engine module is **lazy-loaded** via `React.lazy()` + dynamic
  `import()`, mounted **only** when (a) `BETA_XR_ENABLED` is advertised in `init.features`, (b) the
  capability check (D5) passes, and (c) the user clicks "Enter immersive mode". It is **never** in
  the critical bundle and cannot affect first-paint or `npm run build` of the default app.
- **S98 vs S99 dependency posture (recommended):** for the **S98 spike**, do **not** add
  `three` to `package.json`. Ship a **stub renderer** behind a lazy boundary that proves the
  load path, the launcher, the capability contract, and the DO avatar-sync wire end-to-end with a
  minimal canvas (or a `three` import isolated to a non-built spike entry). **Defer the real
  `three` dependency add to S99** (`XR-FALLBACK-01`/`FE-XR-LAUNCHER-01`), gated on the S98
  kill-criterion passing. This keeps the RC-soak bundle and lockfile untouched during the protected
  window and ties the dependency cost to a survived kill-gate. If the kill-criterion fires, XR is
  removed with zero production dependency to unwind.
  - **S99 add (only if kill-gate survives):** `three` as a `dependency`, imported exclusively
    inside the lazy XR chunk; a bundle-size budget assertion in CI ensures the default entry chunk
    is unaffected.

### D3 — DO protocol: additive, versioned-by-envelope, flag-gated avatar sync

Add **one** `ClientMessage` and **one** `ServerMessage` variant to `functions/api/realtime.ts`,
following the captions precedent (additive on protocol v3, **no version bump**). Position +
orientation only; no PII.

**Inbound — `ClientMessage`:**
```typescript
| {
    v?: LiveProtocolVersion
    type: 'xr_avatar_sync'
    data: {
      // Quantized position in the shared scene's normalized unit space (-1..1).
      p: [number, number, number]            // [x, y, z]
      // Quantized orientation quaternion (-1..1), w-last.
      q: [number, number, number, number]    // [x, y, z, w]
    }
    timestamp: number
  }
```

**Outbound — `ServerMessage`:**
```typescript
| {
    v?: LiveProtocolVersion
    type: 'xr_avatar_sync'
    data: {
      // Ephemeral per-connection avatar id (NOT voterId, NOT a display name).
      // Stable for the socket lifetime only; non-correlatable across sessions.
      avatars: Array<{
        a: string                            // ephemeral avatar id
        p: [number, number, number]          // position
        q: [number, number, number, number]  // orientation
      }>
      rev: number                            // monotonic scene revision (townhall-style)
    }
    timestamp: number
  }
```

DO handling rules (all additive; existing handlers untouched):
- **Guard first.** On inbound `xr_avatar_sync`: `if (flagOff(env, 'BETA_XR_ENABLED')) return` and
  `if (meta.anonymity === 'zero_knowledge') return` — identical guard ordering to the existing
  ZK/vote-flow precedent (`lib/session-room-vote-flow.ts:303`).
- **No persistence.** Avatar state is **transient in-DO only** — never written to D1/KV, never in
  the session snapshot, dropped on disconnect. It is not part of `init` state beyond a current
  active-avatar count.
- **Throttle on the DO.** Coalesce per-connection inbound at the existing token-bucket cadence;
  fan out at a fixed tick (target 10–15 Hz) as a single batched `xr_avatar_sync` with all active
  avatars and a monotonic `rev`, exactly like `townhall_state` deltas — never one broadcast per
  inbound frame. This protects the single-threaded event loop (ADR-0001).
- **Ephemeral id only.** `a` is a per-socket random id minted in the DO; it is **not** `voterId`
  and carries no name. No display name is ever placed in `data`.
- **Capability advertisement.** When the flag is on and the session is not ZK, the DO appends an
  `'xr'` capability to the existing `init.data.features[]` array (additive; no schema change). The
  launcher keys off this string.

### D4 — Privacy / anonymity

- Avatars are **non-photorealistic** and rendered from position/orientation only; no camera feed,
  no audio, no photo, no name in 3D space.
- **XR is disabled in `zero_knowledge` sessions** regardless of `BETA_XR_ENABLED`, mirroring how
  sentiment and coaching are disabled in ZK. The DO does not advertise `'xr'` and drops inbound
  `xr_avatar_sync` for ZK sessions.
- For `full`/`partial`/`none` anonymity, the XR plane shows **exactly what the 2D plane already
  shows** under those rules — no display name is rendered in space beyond existing anonymity rules.
- No new PII enters AE: the latency event (D6) carries only `sessionId` + duration, never `a`,
  `voterId`, or coordinates.

### D5 — 2D fallback contract (capability detection)

The frontend launcher ("Enter immersive mode" button, `FE-XR-LAUNCHER-01`) uses a **two-gate**
contract and falls back to the existing 2D poll UI on any failure:

1. **Flag gate:** `'xr'` is present in `init.data.features[]`.
2. **Capability gate:** `typeof navigator !== 'undefined' && 'xr' in navigator &&
   await navigator.xr?.isSessionSupported('immersive-vr')` resolves truthy (with
   `'immersive-ar'` as a secondary probe for handheld AR). WebGL context creation must also
   succeed.

If gate 1 fails the button is **not rendered**. If gate 1 passes but gate 2 fails (e.g. desktop
Safari/Chrome, no headset), the user stays on the **standard 2D poll UI** — voting and all message
handling are byte-identical to today. XR is a strictly opt-in overlay; it never blocks or replaces
the 2D path. Target device matrix (beta): Meta Quest 3, iOS Safari 16+, Android Chrome.

### D6 — Analytics Engine event: `xr.avatar_sync_latency`

Add **`'xr.avatar_sync_latency'`** to the `QestoEvent.name` union in
`functions/api/lib/observability.ts` and emit via the existing fire-and-forget `writeEvent(...)`.
Reuse the established blob/double schema — **no new AE dataset, no schema change**:

| Field | Maps to | Value |
|---|---|---|
| `name` | blob1 | `'xr.avatar_sync_latency'` |
| `sessionId` | blob2 | live session id |
| `teamId` | blob3 | owning team id |
| `traceId` | blob5 | request/connection trace id |
| `durationMs` | **double1** | measured client→render avatar-sync latency (ms) |
| `count` | double2 | avatars in the broadcast batch (optional) |

- **Privacy:** never carries `avatarId`, `voterId`, or coordinates — aggregate latency only.
- **KPI binding:** powers the epic KPI `p95 < 200 ms avatar sync` (`SPRINT91_99_STORIES.md:474`)
  via `quantileWeighted(double1, ...)` over `blob1 = 'xr.avatar_sync_latency'`.
- Fire-and-forget per the existing contract — failures are swallowed; XR latency telemetry never
  affects session liveness.

### D7 — Reuse map (no net-new subsystems)

| Surface | Reused as-is | XR delta |
|---|---|---|
| Question engine | Renders all question kinds | 3D layer renders the **same** `LiveQuestion` as a centered object; vote still flows through existing `vote` `ClientMessage` |
| `SessionRoom` DO | Fan-out authority | + one additive guarded `xr_avatar_sync` handler; transient state only |
| Anonymity enforcement | ADR-0009/0010 | Reused unchanged; ZK excludes XR |
| Feature flags | `flags.ts` / `getFlag` | + `BETA_XR_ENABLED` |
| AE | `writeEvent` schema | + one event name |
| RELEASES registry | `routes/platform.ts` | XR rides v7.0 RC/GA entries; **no GA flag** — beta only |

## Consequences

**Positive**
- XR is **inert when off**: no protocol bump, no touched handler, no production dependency at S98,
  no critical-bundle change — safe inside the RC soak window.
- The kill-criterion is cheap to honor: removing XR is deleting a lazy chunk, one flag, one event
  name, and two additive message variants — no schema or trust-boundary unwind.
- Privacy moat preserved: position/orientation only, ZK-excluded, no PII in AE.

**Negative / costs**
- Position/orientation broadcast is genuinely net-new realtime fan-out; the 10–15 Hz batched tick
  must be load-tested against the p95<200 ms KPI on the DO before any partner session.
- Three.js (S99) adds a real, if lazy, dependency and a CI bundle-budget assertion to maintain.
- Capability detection across the Quest/iOS/Android matrix is empirically fragile and needs
  device-lab verification, not just unit mocks.

**Risk flags for implementers**
- **R1 (DO):** never broadcast per inbound frame — batch on a fixed tick or the single-threaded
  loop will degrade vote/broadcast latency. Mirror `townhall_state` `rev` deltas.
- **R2 (privacy):** the ephemeral `a` id MUST NOT be `voterId` and MUST NOT be persisted or logged;
  drop on disconnect. AE event carries no coordinates.
- **R3 (ZK):** the ZK guard must run **before** any avatar fan-out and before `'xr'` is added to
  `features[]`; add a unit test asserting ZK sessions never emit `xr_avatar_sync`.
- **R4 (bundle):** keep `three` imports strictly inside the lazy chunk; CI must assert the default
  entry chunk size is unchanged. Do not add `three` until the S98 kill-gate survives.
- **R5 (protocol):** do **not** bump `LiveProtocolVersion`; both variants are additive on v3.

## Alternatives considered

- **Babylon.js / custom WebGL** — rejected: Babylon is a heavier full engine; custom WebGL is
  unjustifiable for a kill-gated beta. Three.js is the smallest tree-shakeable fit (D2).
- **Bump protocol to v4 for XR** — rejected: violates the additive-message discipline of ADR-0005
  during an RC soak sprint; energizers/townhall/captions all shipped additively on the live version.
- **Persist avatar state / include it in session snapshot** — rejected: presence is transient and a
  privacy liability; keeping it in-DO-only and ZK-excluded preserves ADR-0010.
- **Render in the DO / via Workers AI** — rejected: violates ADR-0001 (single-threaded loop) and is
  needless — WebGL is purely browser-side; no inference is involved.
- **Eager-bundle the engine / add `three` at S98** — rejected: bloats the critical bundle, risks
  `npm run build`, and adds a dependency that may be deleted by the kill-criterion. Lazy + deferred.
- **Make XR a gate (replace 2D)** — rejected: non-XR is the default path; XR is an opt-in overlay.

## Rollback

XR is a beta kill-switch, not a migration:
1. **Instant:** set `BETA_XR_ENABLED = "false"` in `wrangler.toml [vars]` (or the env) — the DO
   stops emitting/accepting `xr_avatar_sync`, `'xr'` leaves `features[]`, the launcher hides. No
   deploy required if flipped at the environment level; otherwise one config deploy.
2. **Kill-criterion (S98 wk2 / <1 partner pull):** drop `XR-FALLBACK-01`/`FE-XR-LAUNCHER-01` to the
   v7.1 backlog; **do not add `three`**. The S98 stub, the two additive message variants, the flag,
   and the AE event name are harmless when the flag is off and may stay or be reverted.
3. **Full removal:** delete the lazy XR chunk, the two additive `realtime.ts` variants, the flag
   from `flags.ts`/`wrangler.toml`, and the AE event name. No D1/KV migration, no protocol
   version change, no trust-boundary unwind — nothing else references XR.

## Docs updated

- `knowledge-base/adr/ADR-0066-xr-spatial-session-beta.md` (this ADR — new).
- **Follow-ups for implementers (not done here):** `flags.ts` `FlagName` + `wrangler.toml [vars]`
  (`BETA_XR_ENABLED`); `realtime.ts` `ClientMessage`/`ServerMessage` (`xr_avatar_sync`);
  `observability.ts` `QestoEvent.name` (`xr.avatar_sync_latency`); `SPEC_REALTIME.md` additive
  message table; `SPEC_FRONTEND.md` XR launcher capability contract. Knowledge node to update the
  ADR index and re-embed for `kb_search`.
