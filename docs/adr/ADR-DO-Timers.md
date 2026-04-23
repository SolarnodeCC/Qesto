# ADR: Timer Semantics in Durable Objects

**Date**: 2026-04-23  
**Status**: Proposed  
**Context**: Sprint 18 Planning Review  
**Relevant Issues**: GAM-01 (Energizers), LAUNCHPAD-01 (Pre-flight Checks)

---

## Problem

Qesto uses Durable Objects (DO) for realtime session state. Some features require timers:
- **GAM-01 Energizers**: Speed Round questions auto-advance after N seconds (30–120s countdown)
- **LAUNCHPAD-01 Pre-flight**: Session pre-live screen may display temporary warnings (e.g., "waiting for presenter to confirm")

However, Durable Objects have constraints:
- Single-threaded with no real-time clock guarantees
- Hibernation pauses execution; timers may fire late or not at all
- Reconnection within 5 minutes preserves state, but timer progress is lost

This creates uncertainty: **How do we implement reliable timers in DO without drift, false triggers, or state loss?**

---

## Context

Current session architecture:
```
DRAFT state → REST API only (DO doesn't exist)
LIVE state  → WebSocket + DO (stateful, broadcast)
CLOSED/ARCHIVED → REST API only
```

In LIVE state, the DO maintains:
- Connected participant list
- Current question state
- Vote tracking
- Broadcast history for reconnections

**Timer requirements**:
1. **Accuracy**: Speed Round countdown should be visible to all participants within 100ms
2. **Idempotency**: If DO hibernates, timer doesn't restart or double-fire
3. **Fairness**: All participants see same countdown; no timer drift across clients
4. **Cancellation**: Presenter can pause/resume Speed Round

---

## Proposed Solutions

### Option A: Client-Authoritative Countdown (Recommended)
**Approach**: Timer runs on client; server validates cutoff.

**Implementation**:
- Presenter starts Speed Round: `{ type: 'speedround_start', started_at: <server_timestamp> }`
- Client renders countdown: `Math.max(0, timeout_ms - (now() - started_at))`
- Client auto-submits vote at 0; DO validates submission timestamp
- DO rejects votes submitted after `started_at + timeout_ms` (server-side enforcement)

**Pros**:
- No DO timer logic needed
- Countdown synchronized to server time (UTC)
- Resilient to hibernation
- Presenter pause → send `speedround_pause` with elapsed time; client freezes countdown

**Cons**:
- Client can cheat (manipulate `started_at` locally) — mitigated by server validation

**Code Sketch**:
```typescript
// Client
const elapsed = Date.now() - roundStart;
const remaining = Math.max(0, timeout - elapsed);
if (remaining === 0) submitVote(); // auto-submit

// DO
function validateVoteSubmission(vote, submitTime) {
  const elapsed = submitTime - roundStart;
  if (elapsed > timeout) throw Error('Round closed');
  return true;
}
```

---

### Option B: Server-Driven Alarm (Cloudflare DO Feature)
**Approach**: Use DO `storage.setAlarm(timestamp)` to wake DO at a specific time.

**Implementation**:
- Presenter starts Speed Round: DO calls `storage.setAlarm(Date.now() + 60_000)` 
- DO hibernates; Cloudflare wakes it at alarm time
- On wake, DO broadcasts `{ type: 'speedround_timeout' }` to all clients
- Clients stop accepting votes

**Pros**:
- Server-authoritative (less cheat risk)
- Simple state machine
- Natural DO integration

**Cons**:
- Alarm precision: ±1 second (not guaranteed <100ms)
- Hibernation recovery time: 5–10s latency spike
- Scales poorly with many concurrent timers (1 alarm per DO)
- If DO crashes before alarm fires, timer is lost

**Code Sketch**:
```typescript
// DO
async startSpeedRound(timeout_ms) {
  this.state.round = { started_at: Date.now(), timeout_ms };
  await this.storage.setAlarm(Date.now() + timeout_ms);
}

async onAlarm() {
  if (this.state.round?.timeout_ms) {
    this.broadcast({ type: 'speedround_timeout' });
    this.state.round = null;
  }
}
```

---

### Option C: Hybrid (Server Validates, Client Renders)
**Approach**: Combine A + B — server alarm as safety net, client countdown as UX.

**Implementation**:
- DO sets alarm as backup
- Client renders countdown from `started_at`
- At ~timeout, DO checks for lingering votes; broadcasts `speedround_closed`
- If alarm fires and DO wakes, it broadcasts timeout (catches client bugs)

**Pros**:
- Robust: client UX is responsive; server is failsafe
- Tolerates client disconnection

**Cons**:
- Complexity (two timer paths)
- Potential for race conditions (client auto-submits, server already closed)

---

## Recommendation

**Use Option A: Client-Authoritative Countdown.**

**Rationale**:
1. **Simplicity**: No DO timer logic; reduces state machine complexity.
2. **Responsiveness**: Countdown is smooth (client-driven); no 5s hibernation latency.
3. **Robustness**: Survives DO hibernation, crashes, network loss (clients can retro-sync from `started_at`).
4. **Auditability**: Server validates all vote timestamps; cheating is detectable in audit logs.

**Constraints**:
- Participants must trust DO to enforce cutoff (not critical; votes are not money).
- Client clocks must be NTP-synced (acceptable for modern browsers).

---

## Implementation Plan

**Sprint 18+**: 
1. Document timer strategy in `/home/user/Qesto/docs/ARCHITECTURE.md` (new section: "Realtime Timers").
2. Implement client countdown for GAM-01 (Speed Round) in `src/components/SpeedRoundTimer.tsx`.
3. Add DO validation for vote submission timestamps in `functions/api/ws/session-room.ts`.
4. Test: Speed Round countdown drifts <50ms under 100 participants (load test).

**Future (Option C fallback)**:
- If Option A drifts >100ms in production, add DO alarm as safety net (low priority).

---

## Open Questions

1. **NTP Accuracy**: Do mobile browsers maintain <1s clock skew? (Assume yes; browser auto-sync.)
2. **Clock Manipulation**: Is logging vote `submissionTime` sufficient audit trail? (Yes; tie to server timestamp.)
3. **Presenter Pause**: Should pause preserve elapsed time or reset to 0? (Preserve; more fair to slow thinkers.)

---

## References

- **Cloudflare DO Docs**: https://developers.cloudflare.com/durable-objects/api/storage-api/#alarm
- **Qesto ARCHITECTURE.md**: Session lifecycle, realtime state, DO constraints
- **Sprint 18 Plan**: GAM-01 (Energizers, 8 pts), LAUNCHPAD-01 (Pre-flight, 8 pts)
