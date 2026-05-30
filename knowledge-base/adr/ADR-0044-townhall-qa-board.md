---
id: ADR-0044
status: proposed
created: 2026-05-29
relates_to: ADR-0001-do-per-session, ADR-0005-do-protocol-versioning, ADR-0013-energizer-strategy-pattern
---

# ADR-0044: TOWNHALL Persistent Q&A Board State & Delta Protocol

## Context

Qesto's LIVE realtime model is presenter-driven: one active question, vote state in
`K_COUNTS`/`K_VOTERS`, **reset on `advance`**. The TOWNHALL epic (Moderated Anonymous
Q&A at scale) inverts this: an audience-driven **persistent board** where participants
submit questions, upvote each other's, and a moderator curates them (approve, dismiss,
answer, group, spotlight) — nothing resets. The Team plan caps sessions at 5,000
participants, so a naive full-snapshot-on-change broadcast (the current `results` shape)
would be O(items × participants) per change and saturate the single-threaded DO.

Three product decisions are fixed: a dedicated `session_mode = 'townhall'`;
host-configurable pre- or post-moderation per session; Team-tier only.

## Decision

1. **Extend `SessionRoom`, branch on `session_mode === 'townhall'`** — do not fork a new
   DO. Keeps the "one DO per session" invariant (ADR-0001) and reuses connection
   lifecycle, hibernation attachment handling, IP/voter rate limiting, and plan-capacity
   gating verbatim. All board rules live in a pure strategy module
   `functions/api/lib/session-room-townhall.ts`, mirroring `lib/session-room-vote.ts`
   and the energizer strategy pattern (ADR-0013).
2. **DO storage is the live source of truth**, with point-addressable keys
   (`th:item:<id>`, `th:upvoters:<id>`) and an append-order `th:index`. No whole-board
   rewrite per mutation; `storage.list({ prefix: 'th:item:' })` only on cold rehydrate.
3. **DO-authoritative-live + persist-on-close to D1.** A new `townhall_questions` table
   receives a snapshot on session close (plus a periodic checkpoint alarm), for export
   and GDPR erasure. The live board never round-trips to D1 — D1 has per-row write
   contention and no edge locality, so it is the wrong tier for hot upvote counters.
4. **Delta protocol.** Full snapshot (`townhall_state`) only on `init`/`request_state`;
   all steady-state changes are typed deltas (`townhall_question_added|updated|removed`,
   `townhall_spotlight_changed`) carrying a monotonic `th:rev`. Clients drop
   out-of-order/duplicate deltas and `request_state` on a rev gap. Bursty upvotes
   coalesce through the existing ~100ms alarm into ≤1 frame/item/window. Pre-moderated
   `pending` items broadcast only to presenter-tagged sockets.
5. **Protocol versioning (ADR-0005): no numeric bump.** Townhall messages are an additive
   message family that changes no existing field meaning, so they ship on v1 behind the
   feature flag `REALTIME_TOWNHALL_ENABLED`, advertised via `init.features:
   ['townhall_board']` (same capability-detection mechanism as `delta_results`).

## Alternatives considered

- **New `TownhallRoom` DO** — rejected: duplicates ~600 lines of connection/abuse/capacity
  logic and splits the one-DO-per-session invariant.
- **D1 as live source of truth** — rejected: write contention + latency cannot absorb
  thousands of upvotes/sec.
- **Full snapshot on every change** — rejected: O(items × participants); melts the DO at 5k.
- **New protocol version v4** — rejected as unnecessary; ADR-0005 permits additive families
  on v1 behind flags (the precedent set for energizers).
- **Write-through to D1 on every mutation** — rejected for the hot path; persist-on-close +
  periodic checkpoint is sufficient durability (DO storage is itself durable).

## Consequences

- Reuses all abuse/capacity machinery; delta + coalesce scales to the 5k cap.
- Clean GDPR story: live erase = delete DO; post-close erase = `DELETE FROM
  townhall_questions WHERE author_hash = ? | session_id = ?` (author_hash is the opaque
  voterId, no PII).
- No breaking change to existing v1/v2/v3 poll clients (regression baseline).
- `SessionRoom` gains a second mode — mitigated by the strategy module.
- A hard DO eviction before close could drop the last debounced batch — mitigated by a
  periodic checkpoint alarm; DO storage survives hibernation.
- **Back-compat test matrix (ADR-0005):** legacy v1 poll session unchanged; flag OFF →
  `error: unsupported_feature`; flag ON → `init.features` includes `townhall_board`;
  unknown townhall sub-action rejected; `request_state` returns full board at current
  `th:rev`; pre-mod pending reaches presenter not voter; post-mod dismiss → removed to
  voter; spotlight → all.

## References

- `functions/api/SessionRoom.ts`, `functions/api/realtime.ts`
- `functions/api/lib/session-room-vote.ts` (strategy precedent)
- `knowledge-base/adr/ADR-0005-do-protocol-versioning.md`
- `knowledge-base/product/strategy/COMPETITIVE_EPICS.md` (epic #1)
