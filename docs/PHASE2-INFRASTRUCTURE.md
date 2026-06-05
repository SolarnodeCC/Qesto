# Phase 2 (Weeks 3–4): Infrastructure Implementation

**ADR-042 Phase 2** — Queues offload, DO vote buffering, R2 snapshots

## Overview

Phase 2 has three interconnected initiatives:

- **2.1 Queues** (4–5 days): Async post-session work → no longer blocks close response
- **2.2 DO Vote Buffering** (4–5 days): Memory buffer + periodic flush → kills KV 1-write/s bottleneck
- **2.3 R2 Snapshots** (3 days): DO recovery semantics → reliable after eviction

All three are **independently shippable** but interact on recovery semantics (2.3 + 2.2 land together).

---

## 2.1 Queues Implementation

### Current State (Phase 1)

```
POST /api/sessions/:id/close
├─ Update DB (sessions.status = 'closed')
├─ waitUntil: precomputeInsights() — ~20–25s AI inference
├─ waitUntil: notifySlack() — ~2–5s HTTP to Slack
├─ waitUntil: notifyTeams() — ~2–5s HTTP to Teams
└─ respond 200 ✓
```

**Problem:** Close response blocked until AI inference completes (25s+ timeout). If AI is slow or unavailable, client gets 504.

### New State (Phase 2.1)

```
POST /api/sessions/:id/close
├─ Update DB (sessions.status = 'closed')
├─ Enqueue: insights, slack, teams, webhooks, marketing tasks
└─ respond 200 ✓ (in ~500ms)

[Async Queues Consumer]
├─ Dequeue batch (max 10 messages)
├─ Process in parallel: insights AI, Slack POST, Teams POST, webhooks
├─ Ack on success, retry on failure (max 3x)
└─ DLQ on final failure
```

**Benefit:** Close response is near-instant. Post-session work is decoupled + retryable.

### Implementation Steps

#### A. Wire Queues producer in `functions/api/routes/sessions/lifecycle.ts`

Find the close handler (line ~312) and replace the `waitUntil()` calls:

```typescript
// OLD (Phase 1):
// c.executionCtx.waitUntil(precomputeInsights(...));
// c.executionCtx.waitUntil(notifySlackSessionClosed(...));

// NEW (Phase 2.1):
import { enqueuePostSessionWork, computePayloadHash } from '../../lib/queues/producer';

// After DB update (line ~387):
const taskPromises: Promise<void>[] = [];

// Enqueue insights (if Team plan)
if (c.get('plan') === 'team') {
  const hash = computePayloadHash({
    sessionTitle: session.title,
    plan: c.get('plan'),
    anonymity: session.anonymity,
  });
  taskPromises.push(
    enqueuePostSessionWork(env, {
      idempotencyKey: `${id}:precompute_insights:${hash}`,
      sessionId: id,
      userId: user.sub,
      teamId: session.team_id ?? undefined,
      taskType: 'precompute_insights',
      payload: {
        sessionTitle: session.title,
        anonymity: session.anonymity ?? null,
        plan: c.get('plan'),
        traceId: c.get('trace_id'),
      },
      meta: { enqueuedAt: Date.now() },
    })
  );
}

// Enqueue Slack notification (if integration enabled + team has Slack token)
if (c.env.INTEGRATION_ENABLED === 'true' && c.env.INTEGRATIONS_KV) {
  const hash = computePayloadHash({ sessionTitle: session.title, total });
  taskPromises.push(
    enqueuePostSessionWork(env, {
      idempotencyKey: `${id}:notify_slack:${hash}`,
      sessionId: id,
      userId: user.sub,
      teamId: session.team_id ?? undefined,
      taskType: 'notify_slack',
      payload: {
        counts,
        total,
      },
      meta: { enqueuedAt: Date.now() },
    })
  );
}

// Enqueue Teams notification (similar to Slack)
if (c.env.INTEGRATION_ENABLED === 'true' && c.env.INTEGRATIONS_KV) {
  const hash = computePayloadHash({ sessionTitle: session.title, total });
  taskPromises.push(
    enqueuePostSessionWork(env, {
      idempotencyKey: `${id}:notify_teams:${hash}`,
      sessionId: id,
      userId: user.sub,
      teamId: session.team_id ?? undefined,
      taskType: 'notify_teams',
      payload: { counts, total },
      meta: { enqueuedAt: Date.now() },
    })
  );
}

// Enqueue webhooks + marketing (similar pattern)
// ...

// Fire & forget (do NOT await)
// If any fail to enqueue, they're logged but don't block the response
Promise.all(taskPromises).catch((err) => {
  console.error('[2.1] Bulk enqueue error:', err);
});
```

#### B. Implement queue consumer handler

In `worker/index.ts` (your main Worker entry point), add queue handler:

```typescript
import { processPostSessionWork } from '../functions/api/lib/queues/consumer';
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer';

export async function queue(
  batch: MessageBatch<PostSessionWorkMessage>,
  env: Env,
  ctx: ExecutionContext
) {
  const messages = batch.messages || [];

  for (const message of messages) {
    try {
      await processPostSessionWork(env, message.body);
      message.ack();
    } catch (err) {
      // Retry will happen automatically (up to max_retries in wrangler.toml)
      // If this is the final retry, message goes to DLQ
      message.nack();
      console.error(`[queue] Failed to process ${message.body.idempotencyKey}:`, err);
    }
  }
}
```

#### C. Complete TODO handlers in `consumer.ts`

Import and wire up the actual work handlers:

```typescript
// In functions/api/lib/queues/consumer.ts
import { precomputeInsights } from '../ai-insights';
import { notifySlackSessionClosed } from '../integrations/slack';
import { notifyTeamsSessionClosed } from '../integrations/teams';
import { deliverTeamWebhooks } from '../integrations/webhooks';
import { deliverMarketingWebhook } from '../integrations/marketing';

async function handlePrecomputeInsights(...) {
  await precomputeInsights(env, sessionId, sessionTitle, userId, {
    anonymity,
    teamId,
    plan,
    traceId,
  });
}

// Similar for Slack, Teams, webhooks, marketing...
```

### Success Criteria (2.1)

✅ POST `/api/sessions/:id/close` responds in < 500ms (was 25s+)  
✅ 100% of post-session work enqueued (not lost)  
✅ DLQ queue monitoring in place (alerting on failures)  
✅ Idempotency keys prevent double-processing  
✅ Tests pass: `npm test`  

---

## 2.2 DO Vote Buffering + D1 Migration

### Current State (Phase 1)

Every vote write:
```
Participant submits vote
├─ SessionRoom DO receives
├─ Broadcast to all clients
├─ KV.put(voteKey, ...) ← 1 write per voter, 1-write/s limit per key
└─ If > 1 vote/s from same participant → KV 429 error
```

**Problem:** Large sessions (100+ concurrent voters) exceed KV's 1-write/s per key limit.

### New State (Phase 2.2)

```
Participant submits vote
├─ SessionRoom DO accumulates in memory
├─ Broadcast to all clients (immediate)
├─ Every N seconds (e.g., 5s):
│  ├─ Batch flush to D1: INSERT votes batch
│  └─ Update KV cache (eventual consistency)
└─ No more KV write-limit errors
```

**Benefit:** Scales to 500+ concurrent voters. D1 is source of truth; KV is cache.

### Implementation: D1 Migration

Create file: `migrations/0025_phase2_vote_buffering.sql`

```sql
-- Phase 2.2: DO vote buffering + periodic flush schema
-- Adds batch-optimized vote table + indexes

-- The votes table already exists (from earlier migration), but we add
-- an index to support efficient batch insert recovery.
CREATE INDEX IF NOT EXISTS idx_votes_session_id_created_at 
  ON votes(session_id, created_at DESC);

-- Vote buffer state: tracks when DO last flushed to ensure recovery
CREATE TABLE IF NOT EXISTS vote_flush_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  flush_time INTEGER NOT NULL, -- timestamp
  batch_count INTEGER NOT NULL, -- how many votes in this batch
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'milliseconds')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_flush_log_session_id 
  ON vote_flush_log(session_id, flush_time DESC);

-- Optional: vote metadata for analytics (DO state snapshot)
CREATE TABLE IF NOT EXISTS vote_buffer_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  do_instance_id TEXT, -- DO ID for debugging
  buffered_votes_count INTEGER,
  last_buffer_flush INTEGER, -- timestamp of last flush
  snapshot_timestamp INTEGER NOT NULL DEFAULT (unixepoch('now', 'milliseconds')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

Apply the migration:
```bash
wrangler migrations apply --database qesto_3_db
# Verify: SELECT * FROM vote_flush_log;
```

### Implementation: SessionRoom DO Changes

Update `functions/api/SessionRoom.ts`:

```typescript
// Add to DO class
private voteBuffer: Array<{
  voterId: string;
  optionId: string;
  questionId: string;
  submittedAt: number;
}> = [];

private lastFlushTime = Date.now();
private readonly FLUSH_INTERVAL_MS = 5000; // flush every 5 seconds
private readonly MAX_BUFFER_SIZE = 1000; // cap to avoid memory pressure

async handleVote(voterId: string, questionId: string, optionId: string) {
  // Add to buffer
  this.voteBuffer.push({
    voterId,
    optionId,
    questionId,
    submittedAt: Date.now(),
  });

  // Broadcast immediately (don't wait for flush)
  await this.broadcast({
    type: 'vote_received',
    voterId,
    optionId,
  });

  // Periodic flush: if time elapsed or buffer full
  const now = Date.now();
  if (
    now - this.lastFlushTime > this.FLUSH_INTERVAL_MS ||
    this.voteBuffer.length >= this.MAX_BUFFER_SIZE
  ) {
    await this.flushVotesToD1();
  }
}

private async flushVotesToD1() {
  if (this.voteBuffer.length === 0) return;

  const toFlush = this.voteBuffer.splice(0); // clear buffer
  const flushId = ulid();
  const flushTime = Date.now();

  try {
    // Batch insert to D1 (ACID guaranteed per statement)
    const stmt = this.env.DB.prepare(
      `INSERT OR IGNORE INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    );

    const batch = toFlush.map((v) =>
      stmt.bind(ulid(), this.sessionId, v.questionId, v.voterId, v.optionId, v.submittedAt)
    );

    await this.env.DB.batch(batch);

    // Log the flush
    await this.env.DB.prepare(
      `INSERT INTO vote_flush_log (id, session_id, flush_time, batch_count)
       VALUES (?1, ?2, ?3, ?4)`
    ).bind(flushId, this.sessionId, flushTime, toFlush.length).run();

    // Update KV cache (eventual consistency; KV lags by ~5 seconds)
    const kvKey = `votes:${this.sessionId}`;
    const kvData = { lastFlush: flushTime, count: toFlush.length };
    await this.env.DECISIONS_KV.put(kvKey, JSON.stringify(kvData), { expirationTtl: 3600 });

    this.lastFlushTime = flushTime;

    writeEvent(this.env.METRICS_AE, {
      name: 'vote.buffered_flush',
      sessionId: this.sessionId,
      count: toFlush.length,
      durationMs: Date.now() - flushTime,
    });
  } catch (err) {
    // Restore buffer on failure (idempotent: OR IGNORE handles duplicates)
    this.voteBuffer.unshift(...toFlush);
    throw err;
  }
}
```

### Testing: Load Test (Required)

Create `tests/integration/vote-buffering-load.test.ts`:

```typescript
import { test, expect } from 'vitest';

test('2.2: 500 concurrent voters, no KV write-limit errors', async () => {
  // Simulate 500 voters, each submitting 1 vote, staggered over 10 seconds
  const voters = Array.from({ length: 500 }, (_, i) => `voter-${i}`);
  const sessionId = 'test-session-2.2';

  const startTime = Date.now();
  const results: { success: number; failed: number } = { success: 0, failed: 0 };

  // Stagger submissions (not all at once)
  for (let i = 0; i < voters.length; i++) {
    if (i % 50 === 0) {
      // Every 50 votes, wait 1 second to spread load
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const voterId = voters[i];
    try {
      // Send vote via WS to SessionRoom
      // ... (use your test WS client)
      results.success++;
    } catch {
      results.failed++;
    }
  }

  const duration = Date.now() - startTime;

  console.log(`Load test results (${duration}ms):`);
  console.log(`  Success: ${results.success}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Rate: ${(results.success / (duration / 1000)).toFixed(1)} votes/sec`);

  expect(results.failed).toBe(0); // zero failures
  expect(results.success).toBeGreaterThanOrEqual(500);
});
```

Run: `npm run test -- vote-buffering-load.test.ts`

### Success Criteria (2.2)

✅ 500+ concurrent voters in a session  
✅ Zero KV write-limit (429) errors  
✅ Vote latency p95 < 150ms  
✅ D1 is source of truth; no vote loss  
✅ KV cache eventual consistency (lags by ~5s, acceptable)  
✅ Load test passes  

---

## 2.3 R2 Snapshots + DO Recovery

### Current State (Phase 2.1)

If SessionRoom DO is evicted:
```
Client tries to send vote
├─ DO is rehydrated (cold start)
├─ Rebuild state from D1 queries
└─ Vote processing resumes (but with latency spike)
```

**Problem:** Rebuilding from D1 queries can take several seconds. Large sessions with 50k+ votes are slow to recover.

### New State (Phase 2.3)

```
SessionRoom periodically snapshots to R2
  snapshot = { voteBuffer, broadcastState, ... }

If DO is evicted:
  ├─ Fetch latest snapshot from R2 (~100ms)
  ├─ Replay D1 votes since snapshot
  └─ Resume with full state (sub-second recovery)
```

**Benefit:** Graceful DO recovery. Bounded latency spike.

### Implementation: R2 Snapshot Strategy

In `functions/api/SessionRoom.ts`:

```typescript
private snapshotInterval = 30_000; // snapshot every 30 seconds
private lastSnapshotTime = Date.now();

// After flushVotesToD1(), consider snapshotting
private async maybeSnapshot() {
  const now = Date.now();
  if (now - this.lastSnapshotTime > this.snapshotInterval) {
    await this.snapshotToR2();
    this.lastSnapshotTime = now;
  }
}

private async snapshotToR2() {
  const snapshotData = {
    sessionId: this.sessionId,
    state: {
      broadcastState: this.broadcastState,
      voteBuffer: this.voteBuffer,
      metadata: {
        snapshotTime: Date.now(),
        doInstanceId: this.id.toString(),
        bufferedVotes: this.voteBuffer.length,
      },
    },
  };

  const key = `sessions/${this.sessionId}/snapshots/${Date.now()}.json`;
  await this.env.R2_BUCKET.put(key, JSON.stringify(snapshotData), {
    customMetadata: {
      'session-id': this.sessionId,
      'snapshot-time': String(Date.now()),
    },
  });
}

// On DO initialization, hydrate from snapshot + D1 tail
async initialize(state: DurableObjectState, env: Env) {
  const snapshot = await this.loadLatestSnapshot();
  if (snapshot) {
    // Fast path: restore from snapshot
    this.broadcastState = snapshot.state.broadcastState;
    this.voteBuffer = snapshot.state.metadata.bufferedVotes > 0 ? [] : snapshot.state.voteBuffer;
    
    // Replay votes since snapshot
    const latestFlush = await this.fetchLatestFlushTime();
    if (latestFlush > snapshot.state.metadata.snapshotTime) {
      const missedVotes = await this.fetchVotesSince(snapshot.state.metadata.snapshotTime);
      this.voteBuffer.push(...missedVotes);
    }
  } else {
    // Slow path: rebuild from D1 (existing logic)
    const votes = await this.fetchAllVotes();
    // ... process votes
  }
}

private async loadLatestSnapshot() {
  const prefix = `sessions/${this.sessionId}/snapshots/`;
  const list = await this.env.R2_BUCKET.list({ prefix, limit: 1 });
  if (list.objects.length === 0) return null;

  const latest = list.objects[0];
  const data = await this.env.R2_BUCKET.get(latest.key);
  return data ? JSON.parse(await data.text()) : null;
}
```

### Success Criteria (2.3)

✅ DO recovery < 1 second (was ~3–5s)  
✅ No vote loss during DO eviction  
✅ R2 snapshots cleanup (don't accumulate forever)  
✅ Snapshot strategy is documented  

---

## Phase 2: Full Integration Checklist

- [ ] 2.1: Queues producer/consumer wired
  - [ ] `functions/api/lib/queues/producer.ts` complete
  - [ ] `functions/api/lib/queues/consumer.ts` integrated
  - [ ] `functions/api/routes/sessions/lifecycle.ts` enqueues tasks
  - [ ] `worker/index.ts` has queue handler
  - [ ] Close latency p50 < 500ms

- [ ] 2.2: DO vote buffering + D1 migration
  - [ ] `migrations/0025_phase2_vote_buffering.sql` applied
  - [ ] SessionRoom: voteBuffer, flushVotesToD1(), maybeSnapshot()
  - [ ] Load test: 500 voters, zero KV 429 errors
  - [ ] Vote latency p95 < 150ms

- [ ] 2.3: R2 snapshots
  - [ ] SessionRoom: snapshotToR2(), loadLatestSnapshot()
  - [ ] Recovery logic: hydrate from snapshot + replay D1 tail
  - [ ] DO recovery < 1s

- [ ] Deployment
  - [ ] `npm test` passes
  - [ ] `npx tsc --noEmit` passes
  - [ ] Canary deployment: Phase 2 features off, gradual rollout
  - [ ] Monitor AE dashboards: queue success rate, vote latency, DO recovery

---

## Phase 2 Success Metrics

| Metric | Target | Verification |
|--------|--------|---|
| Close response time (p50) | < 500ms | AE dashboard: `session.closed` latency |
| Queue success rate | ≥ 99% | AE: `queue.task.success` / total |
| Vote latency (p95) | < 150ms | Load test + AE: `vote.submitted` latency |
| KV write errors | 0 | AE: zero `429` errors during load |
| DO recovery time | < 1s | Measured on forced eviction test |

---

## Timeline

- **Week 3 (Day 1–3)**: Implement 2.1 (Queues) → canary → monitor
- **Week 3 (Day 4–5)**: Implement 2.2 (DO buffering) → load test
- **Week 4 (Day 1–2)**: Implement 2.3 (R2 snapshots) + integration
- **Week 4 (Day 3–5)**: Full canary → gradual rollout → stabilize

---

**Next:** Phase 3 (Images, Cache Rules, Stream spike) after Phase 2 sign-off + canary success.

---

**Owner:** Backend Lead  
**Sign-off required:** Architect (DO protocol), QA (load test), Ops (canary)  
**Related PRs:** Queues wiring, DO.ts changes, D1 migration
