---
id: ADR-0055
status: accepted
created: 2026-06-19
accepted: 2026-06-19
deciders: architect, security, product-owner
relates_to: ADR-0038, ADR-0047, ADR-0010, ADR-0054, SPRINT91_99_STORIES
---

# ADR-0055: REACTIONS GA — Live Reaction Channel at Scale

## Status

Accepted (S91). Governs E91 REACTIONS GA foundation (`REACTIONS-CHANNEL-01`,
`REACTIONS-TYPE-01`, `REACTIONS-BUDGET-01`, `REACTIONS-ZEROK-01`).

## Context

Creators and webinar hosts need an ephemeral, high-throughput emoji reaction layer that does
not block votes or Q&A. Competitors lack edge-native reaction channels at webinar scale.
Qesto already ships realtime v3 delta (`results_delta`, ADR-0038) and ModQueue backpressure
(ADR-0047).

REACTIONS adds a **separate sub-channel** on the SessionRoom DO WebSocket: low-payload
`reaction_submit` in, aggregate `reaction_delta` out. No open text; emoji set only.

## Decision

### 1. Wire format (additive on protocol v3)

**Client → DO**

```json
{ "type": "reaction_submit", "data": { "emojiId": "👍" }, "timestamp": 1234567890 }
```

**DO → clients**

```json
{
  "type": "reaction_delta",
  "data": { "counts": { "👍": 42, "❤️": 17 }, "total": 59 },
  "timestamp": 1234567891
}
```

- Feature flag in `init.features`: `reactions_channel` when the session plan unlocks
  `liveReactions` and a reaction-capable question is active (or session vote policy is `react`).
- No protocol version bump; gated like `townhall_board` / captions.

### 2. Question type `reaction`

- `questions.kind = 'reaction'`
- `options_json`: 2–8 emoji options `{ id, label }` where `id` is the emoji glyph and
  `label` is alt-text (i18n in S92).
- Plan-gated via `liveReactions` entitlement (Starter+).

### 3. Rate budgets (per session, rolling 60s)

| Plan | Budget (reactions/min) |
|------|------------------------|
| free | 100 |
| starter | 500 |
| team | 2000 |

Overage → WS error `{ code: 'reaction_rate_limited', message: '…' }` with exponential
backoff hint; no silent drop.

### 4. Flood control (per voter, 30s window)

Block a voter after **3×** their fair share of the session budget in 30 seconds
(fair share = session budget / max(connected voters, 1)). Prevents single-socket floods
without de-anonymizing in broadcast payloads.

### 5. Zero-knowledge (ADR-0010)

- Broadcast payloads are **aggregate-only** for all anonymity modes.
- ZK sessions additionally omit any per-voter reaction storage; only in-memory counts in the DO.
- Session close persists aggregate emoji distribution to D1 only when anonymity ≠ `zero_knowledge`.

### 6. Non-blocking sub-channel

Reaction handling runs outside the vote token-bucket. Vote/Q&A/townhall paths are unchanged.
Reaction broadcasts use v3 delta coalescing (debounced ≤100ms) to protect frame budgets.

## Consequences

- S92 completes client render optimization (`FE-REACTIONS-RENDER-01`) and load proof
  (`QA-REACTIONS-LOAD-01`).
- Analytics Engine event `reaction.broadcast_latency` emitted on handler hot path (histogram).
- Pentest #6 scope includes reaction flood/abuse surface.

## References

- `functions/api/lib/session-room-reactions-handler.ts`
- `functions/api/lib/reactions-config.ts`
- [`SPRINT91_99_STORIES.md`](../product/planning/SPRINT91_99_STORIES.md) §Epic 1
