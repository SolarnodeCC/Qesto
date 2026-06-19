---
id: DR_SNAPSHOT_CADENCE
type: operations
domain: operations
category: disaster-recovery
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - ops-dr-gap-02
  - rt-01
relates_to:
  - DR_DRILL_V7_2026
  - ADR-042-cloudflare-capability-expansion
  - session-room-alarm.ts
---

# DR — SessionRoom R2 Snapshot Cadence

_`OPS-DR-GAP-02` (RT-01). Documents the automated DO → R2 snapshot trigger and RPO bound._

## SLA & Recovery Targets

| Target | Value | Rationale |
|--------|-------|-----------|
| **RPO (session state)** | ≤ 30s | Snapshot every 30s; worst case: 29s vote data loss on DO crash |
| **RTO (session recovery)** | ≤ 10s | DO re-init via `maybeHydrate()` restores from R2; WebSocket broadcast resync |
| **Availability (active sessions)** | 99.5% | SLA covers DO uptime + alarm reliability; snapshotting is non-blocking |
| **Data loss tolerance** | In-flight votes only | KV + D1 are primary; snapshot is hedge against state machine corruption |

## Summary

| Item | Value |
|------|-------|
| **Binding** | `R2_SESSIONS` → bucket `qesto-sessions` |
| **Cadence** | **30 seconds** (`SNAPSHOT_INTERVAL_MS = 30_000`) |
| **Trigger** | SessionRoom DO `alarm()` → `runAlarm()` → `snapshot()` |
| **Object key** | `sessions/{sessionId}/snapshot.json` |
| **RPO (active question votes)** | ≤ 30s in-flight vote exposure if DO evicted before next alarm |

## Implementation

1. **`functions/api/lib/session-room-types.ts`** — `SNAPSHOT_INTERVAL_MS = 30_000`
2. **`functions/api/lib/session-room-alarm.ts`** — periodic snapshot when `now >= lastSnapshotAt + SNAPSHOT_INTERVAL_MS`
3. **`functions/api/lib/session-room-persistence.ts`** — `maybeSnapshot()` writes JSON payload to R2; `maybeHydrate()` restores on DO restart

Alarm scheduling is owned by the SessionRoom DO lifecycle (not a separate Worker cron).

## Observability

Failed snapshots emit `do.snapshot_failed` via `logEvent`. Successful writes include
`customMetadata.snapshotAt` on the R2 object.

## Note on DR drill narrative

[`DR_DRILL_V7_2026.md`](./DR_DRILL_V7_2026.md) tabletop used a **10-second** bound for
exercise storytelling. **Code truth is 30s** as of v7.0.0 — update future drills to match or
tighten `SNAPSHOT_INTERVAL_MS` in a dedicated performance story.

## Acceptance (`OPS-DR-GAP-02`)

- [x] Cadence constant documented and traceable in code
- [x] Automated trigger = DO alarm handler (no manual step)
- [ ] Production R2 object age verified via `wrangler r2 object list` during live session (operator, post-deploy)
