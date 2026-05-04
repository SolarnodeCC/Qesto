---
name: optimising-backend-performance
description: Performance budgets, latency targets, and optimization patterns for the Qesto backend. Use when reviewing performance impact of backend changes, diagnosing latency regressions, or optimizing KV/D1/DO access patterns.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Referenced from [backend-dev.md](backend-dev.md). Load when diagnosing or preventing performance regressions.

## Latency Targets

| Component | Metric | Target |
|---|---|---|
| KV | Hot read (cached) | < 5ms p95 |
| KV | Warm read (cache miss) | < 15ms |
| D1 | Indexed query | < 50ms p95 |
| D1 | Table scan (no index) | < 500ms max |
| DO | Cold start to first message | < 100ms |
| Workers AI | Response | < 8s |
| Stripe | Webhook signature validation | < 50ms |

## Core Web Vitals (Frontend, owned by frontend-dev)

| Metric | Target |
|---|---|
| LCP | < 2.5s (75th %ile) |
| CLS | < 0.1 |
| FID/INP | < 100ms |
| Total session JS (gzipped) | < 200KB |

## Measurement

```typescript
// Backend: time individual operations
console.time('kv-fetch')
const data = await c.env.SESSIONS_KV.get(key)
console.timeEnd('kv-fetch')  // "kv-fetch: 3.2ms"
```

Every PR must include a performance impact note:
```markdown
## Performance Impact
- KV reads: 3.2ms (was 3.8ms) ✅
- Route latency: 120ms p95 (was 85ms) ⚠️ +41% — investigate slow query
```

## Optimization Patterns

**Avoid N+1 KV calls:**
```typescript
// ❌ Sequential per session
sessions.forEach(async sid => await c.env.SESSIONS_KV.get(`sessions:${sid}`))

// ✅ Parallel batch
const metas = await Promise.all(sessions.map(sid => c.env.SESSIONS_KV.get(`sessions:${sid}`)))
```

**Index D1 queries:**
```sql
-- ❌ No index
SELECT * FROM responses WHERE session_id = ?

-- ✅ Always add index for WHERE columns with >1k rows
CREATE INDEX idx_responses_session ON responses(session_id)
```

**Cache DO state in memory:**
```typescript
// ❌ Storage read on every message
async onMessage(msg) { const state = await this.state.storage.get('state') }

// ✅ Cache in instance variable
private cachedState: SessionState | null = null
async onMessage(msg) {
  if (!this.cachedState) this.cachedState = await this.state.storage.get('state')
}
```

**DO alarms — only one at a time:**
```typescript
// DO supports exactly one alarm — new setAlarm() overwrites previous
await this.state.storage.setAlarm(Date.now() + 30_000)
```

**Stream large payloads:**
```typescript
// ❌ Buffers entire response
const text = await response.text()

// ✅ Stream to destination
return new Response(response.body, { headers })
```

## Regression Prevention

1. Compare against baseline in `.claude/.agent-state/perf-baseline.json` before merge
2. Flag unexplained regressions > 10% in code review
3. Monitor production for 24h after merge

## Audit Resilience Budgets

The resilience audit added these performance-adjacent gates:

| Dependency | Gate |
|---|---|
| Workers AI | Bound execution with timeout; retry transient failures where useful; never leave a user request waiting indefinitely. |
| D1 middleware queries | Keep indexed and bounded; catch failures in auth/plan/admin/RBAC middleware with explicit fail-open/fail-closed semantics. |
| KV rate limits/cache | Wrap KV operations where failure should degrade gracefully; log fail-open decisions. |
| Vectorize upsert | Defer best-effort enrichment with `waitUntil()` when it is not required for the current response. |
| Durable Object storage | Guard cached promise initialization; storage failures should not poison later requests permanently. |

Flag any new route or integration that cannot state its timeout/degradation behavior.
