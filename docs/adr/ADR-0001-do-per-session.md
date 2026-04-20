# ADR-0001 — Durable Object per session for LIVE state; DRAFT stays in D1/KV

_Status: Accepted — 2026-04-20_
_Deciders: architect (lead), backend, security_
_Related: [`docs/spec/SPEC_REALTIME.md`](../spec/SPEC_REALTIME.md), [`docs/spec/SPEC_CORE.md`](../spec/SPEC_CORE.md), [`docs/spec/includes/PREBUILD_AND_DELIVERY.md`](../spec/includes/PREBUILD_AND_DELIVERY.md#adr-index)_

## Context

Qesto's session state machine is `DRAFT → LIVE → CLOSED → ARCHIVED`. Three states are cold (readable via REST from D1/KV). One state — **LIVE** — is hot: presenter advances questions, voters submit in real time, and every connected participant expects sub-second broadcast of results. We need to decide where LIVE state lives, because it is the only state with low-latency, strongly consistent, single-writer requirements.

Alternatives considered:

1. **One Durable Object per session (chosen).** Each LIVE session instantiates a `SessionRoom` DO keyed by `sessionId`. The DO owns the WebSocket map, current question, vote tallies, and timer.
2. **Shared DO pool (one DO for many sessions).** A fixed set of DOs round-robin hosts multiple sessions.
3. **D1 + pub/sub.** Persist every state change to D1; broadcast to WS clients via a fan-out service (Durable-Object-less).
4. **KV-only + polling.** Client polls for updates every N ms.

## Decision

Use **one Durable Object instance per session** for the LIVE state. Key the DO by the session's public identifier. Create the DO on `POST /sessions/:id/start` (DRAFT → LIVE transition). Tear down state on `POST /sessions/:id/close` (persist totals to D1 in the DO `alarm` / close handler, then release WS connections).

DRAFT state lives in D1 (`sessions`, `questions` tables) with the session configuration. No DO exists for DRAFT sessions. CLOSED and ARCHIVED are D1 reads only.

## Consequences

### Positive

- **Single-writer semantics per session.** Votes, presenter actions, and clock ticks linearise inside the DO; no external lock needed.
- **Sub-second broadcast.** WS clients connect directly to the DO; fan-out is in-memory.
- **Cost scales with concurrency, not storage.** Idle sessions cost nothing (DO not instantiated when LIVE closes).
- **Natural failure boundary.** One misbehaving session cannot impact another.
- **Matches Cloudflare guidance** for real-time collaborative state.

### Negative / tradeoffs

- **Cold start on LIVE transition.** First request after `start` may take ~100 ms extra to instantiate the DO. Acceptable; presenter clicks "Go live" once.
- **No cross-session reasoning inside the DO.** Aggregate analytics must live outside (D1 + Analytics Engine). This is fine — aggregates are post-session, not real-time.
- **Migration surface.** If we ever need to change DO state shape, existing LIVE DOs must handle the migration. Mitigated by persisting minimal state in `this.state.storage` and rebuilding derived state on load.
- **Region affinity.** A DO is pinned to the region of first write. Presenter and voters should hit the same region within a session lifetime (acceptable for Qesto's workload).

### Rejected alternatives

- **Shared DO pool** — complicates isolation and makes a single hot session a noisy neighbour. Rejected.
- **D1 + pub/sub** — D1 is not optimised for high-write single-row hotspots (vote counters), and we have no first-class pub/sub primitive on Cloudflare. Rejected.
- **KV-only + polling** — unacceptable latency and cost at scale; also races on writes. Rejected.

## LIVE spike acceptance (binding)

This ADR is accepted contingent on passing the LIVE spike (S1–S5) in `docs/spec/includes/PREBUILD_AND_DELIVERY.md#live-spike-acceptance`. If any criterion fails, reopen this ADR before further UI investment.

## Rollout

1. Phase 0: wrangler.toml declares `SessionRoom` DO binding; empty DO class stub.
2. Phase 3: DO implementation, WebSocket upgrade at `GET /sessions/:id/ws`, message contract from `SPEC_REALTIME.md`.
3. Phase 4: `close` persists finals to D1, terminates DO.

## References

- `docs/spec/SPEC_REALTIME.md` — wire format, message types, reconnect semantics
- `docs/spec/SPEC_CORE.md#session-state-machine` — canonical state machine
- `docs/spec/includes/PREBUILD_AND_DELIVERY.md#live-spike-acceptance` — S1–S5 gate
- Cloudflare docs: https://developers.cloudflare.com/durable-objects/
