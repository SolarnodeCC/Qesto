# ADR-0001: Durable Object Per Session (LIVE State)

**Date**: 2026-04-20  
**Status**: Accepted  
**Deciders**: Architecture team  
**Implements**: [PREBUILD_AND_DELIVERY.md § Vertical slice v1](../metadata/spec-includes/PREBUILD_AND_DELIVERY.md)

---

## Context

Qesto requires a real-time session platform where:
- Presenters broadcast live question state to 100+ concurrent voters
- Voters submit votes, see live result aggregates within 100ms
- Sessions transition DRAFT (REST-only) → LIVE (WebSocket+DO) → CLOSED (REST audit)
- Votes are deduplicated per voter + question, persisted to D1 after session close

**Problem**: Where should LIVE session state live?

### Options Considered

| Option | Storage | Protocol | Tradeoff |
|--------|---------|----------|----------|
| **A** | D1 + polling | HTTP (REST) | High latency (~5s polling), high D1 write churn, hard to broadcast |
| **B** | Redis (third-party) | WebSocket | Adds dependency + cost, breaks edge-first model, increases latency |
| **C** | Cloudflare Durable Objects | WebSocket (hibernation) | ✅ **Chosen**: Edge-resident, single-threaded, persistent per-session, cheap per-DO |
| **D** | In-memory (Workers) + KV | WebSocket | Workers restart kill state; KV is slow (>100ms write latency) |

---

## Decision

**Use one Durable Object per LIVE session** (`SessionRoom` class). Each DO:
- Owns the canonical in-memory state: current question, vote counts, participant list
- Maintains the hibernated WebSocket registry (persistent across function invocations)
- Accepts only WebSocket connections when LIVE; rejects after CLOSE
- Returns final vote list to backend on `/close` for D1 persistence

### State Lifecycle

```
DRAFT (D1 row only)
  ↓ POST /sessions/:id/start
LIVE (D1 row + DO instance)
  ↓ POST /sessions/:id/close
CLOSED (D1 row only; DO discarded)
  ↓ (24h delay)
ARCHIVED (D1 row only; excluded from lists)
```

### DO Responsibilities

**Owns**:
- Per-voter vote history (voterId → optionId)
- Vote counts (optionId → count)
- Participant list (WS connections)
- Rate-limit buckets (per-voter token bucket)
- IP-based connection cap (5 concurrent per IP)

**Delegates to backend**:
- Session metadata (title, code, owner)
- Question content (prompt, options)
- D1 audit trail (votes table after close)
- Plan gating (feature limits)

### Why Not KV?

KV has eventual consistency (~60s) and 1 write/sec/key limits. Vote counts need immediate broadcast to 100+ clients; eventual consistency breaks the UX ("your vote disappeared").

### Why Not Broadcast from D1?

Polling D1 for state changes is expensive (CPU, bandwidth) and adds latency. WebSocket + hibernation is cheaper (event-driven, no polling).

---

## Consequences

### Positive ✅
- **Real-time**: Broadcasts within 100ms (hibernation + WebSocket)
- **Cost-efficient**: One DO per active session, cheap memory/CPU vs. Redis
- **Edge-first**: No third-party latency, global distribution
- **State safety**: Single-threaded execution prevents race conditions
- **Graceful degradation**: Close route persists votes even if DO crashes

### Negative ⚠️
- **Limited to one question per session** (v1 scope): DO state grows with question complexity; multi-question sessions require redesign
- **No persistence across deploys**: DO state lost if worker restarts (mitigated by persisting votes to D1 on close)
- **Manual cleanup**: Closed sessions' DOs are not automatically garbage-collected; cleanup task needed (Phase 5)
- **Debugging**: In-process state hidden from logs; requires `/state` endpoint for inspection

---

## Implementation Details

### Message Protocol

**ClientMessage** (voter → DO):
```typescript
| { type: 'vote'; data: { questionId: string; optionId: string } }
| { type: 'advance'; data: {} }  // presenter only
| { type: 'request_state'; data: {} }
```

**ServerMessage** (DO → voter):
```typescript
| { type: 'init'; data: { session, question, results, participants, role, voterId } }
| { type: 'results'; data: { counts, total } }  // broadcast every 100ms (debounced)
| { type: 'participants'; data: { count } }  // on connect/disconnect
| { type: 'session_closed'; data: { counts, total } }
| { type: 'error'; data: { code, message } }
```

### Voter Deduplication

Votes are keyed by **voterId**, derived per connection:
```
voterId = 'anon_' + SHA256(ip)[0..8] + '_' + SHA256(ua+accept-*)[0..12]
         = 'anon_a1b2c3d4_e5f6g7h8i9j0'
```

This survives reconnects (same IP + UA) but resets on private browsing or VPN change. See `functions/api/lib/voter.ts`.

### Rate Limiting (S5)

Per-voter token bucket (10 tokens, 1/sec refill) prevents vote floods. Per-IP concurrent cap (5 connections) prevents connection storms.

### Persistence Strategy

On `/close`, the route:
1. Calls DO's `/close` endpoint (WebSocket broadcast + final counts)
2. DO returns: `{ counts, total, votes: [{voterId, optionId}], questionId }`
3. Backend batch-inserts votes to D1 (`INSERT OR IGNORE` for idempotency)
4. Backend marks session CLOSED, returns results

---

## Related Decisions

- **ADR-0002** (future): Async vote queue for vote floods under heavy load
- **ADR-0003** (future): Multi-question session redesign (requires per-question DO or state sharding)

---

## Validation

**S4 Acceptance** (PREBUILD_AND_DELIVERY.md): Close path freezes cleanly; no silent DO leak.
- ✅ Tested: `tests/unit/session-room.test.ts` § S4
- ✅ Verified: Close persists votes to D1, then flips session status

**References**:
- `functions/api/SessionRoom.ts` — DO implementation
- `functions/api/realtime.ts` — Message types
- `functions/api/routes/sessions.ts` — Close + results routes
- `tests/unit/session-room.test.ts` — S1–S5 acceptance tests

---

## Approval Chain

- [x] Architecture (Phase 3 implementation)
- [ ] Security (Phase 5 audit)
- [ ] DevOps (Phase 5 monitoring)
