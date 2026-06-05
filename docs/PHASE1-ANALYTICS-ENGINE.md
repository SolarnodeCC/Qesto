# Phase 1.3: Analytics Engine — Session Funnel & Realtime Health

**ADR-042 Phase 1.3** — Extend Cloudflare Analytics Engine with session lifecycle events, vote/sentiment latency, and AI inference metrics.

**Objective:** Establish observability baseline for all Phase 2+ optimizations. Enable real-time dashboards for session health, conversion funnel, and AI cache hit rates.

---

## Overview

Analytics Engine is already bound as `METRICS_AE` in wrangler.toml. Currently, `functions/api/lib/observability.ts:writeEvent()` emits raw HTTP request logs.

**New:** Extend to emit structured events for:
- Session state transitions (DRAFT → ENERGIZING → LIVE → CLOSED)
- Vote submission + broadcast latency
- WS connect/disconnect
- AI inference outcomes (cache hit, duration, cost)
- Sentiment analysis results

---

## 1. Extended Event Schema

Update `functions/api/lib/observability.ts` with new event types:

```typescript
export type MetricsEvent = {
  timestamp: string // ISO 8601
  name: string // event type
  sessionId?: string
  teamId?: string
  userId?: string
  plan?: PlanTier
  
  // Session lifecycle
  state?: 'draft' | 'energizing' | 'live' | 'closed' | 'archived'
  
  // Vote / response metrics
  questionType?: 'poll' | 'ranking' | 'open_text' | 'consent'
  voteLatencyMs?: number // submission → server receive
  broadcastLatencyMs?: number // server receive → all clients notified
  
  // WS / realtime
  wsClients?: number
  wsDuration?: number
  
  // AI metrics
  model?: string
  durationMs?: number
  cached?: boolean
  gatewayMs?: number
  error?: string
  
  // Sentiment
  mood?: 'positive' | 'neutral' | 'concerning'
  sampleSize?: number
  
  // Request metadata
  method?: string
  path?: string
  status?: number
  cfRay?: string
}

export async function writeEvent(
  ae: AnalyticsEngineDataset,
  event: MetricsEvent,
): Promise<void> {
  if (!ae) return // safe no-op in dev
  
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  }
  
  ae.writeDataPoint({
    indexes: [
      event.sessionId ?? 'unknown',
      event.teamId ?? 'unknown',
      event.name,
    ],
    blobs: [JSON.stringify(payload)],
  })
}
```

---

## 2. Emit Session State Events

In `functions/api/routes/sessions/:id/start.ts` and other state-change handlers:

```typescript
// When session transitions to ENERGIZING
await writeEvent(c.env.METRICS_AE, {
  name: 'session.state_changed',
  sessionId: id,
  teamId: session.team_id,
  state: 'energizing',
  // optional: participants count, energizer count
})

// When session transitions to LIVE
await writeEvent(c.env.METRICS_AE, {
  name: 'session.state_changed',
  sessionId: id,
  teamId: session.team_id,
  state: 'live',
})

// When session closes
await writeEvent(c.env.METRICS_AE, {
  name: 'session.state_changed',
  sessionId: id,
  teamId: session.team_id,
  state: 'closed',
})
```

---

## 3. Emit Vote Latency Events

In the SessionRoom Durable Object (WS message handler):

```typescript
// When client submits a vote
const voteStart = Date.now()
// ... process vote ...
const voteLatency = Date.now() - voteStart

await writeEvent(env.METRICS_AE, {
  name: 'vote.submitted',
  sessionId: this.sessionId,
  questionType: question.type, // 'poll' | 'ranking' | 'open_text'
  voteLatencyMs: voteLatency,
  wsClients: Object.keys(this.clients).length,
})

// When vote is broadcast to all clients
const broadcastStart = Date.now()
// ... broadcast to all WS clients ...
const broadcastLatency = Date.now() - broadcastStart

await writeEvent(env.METRICS_AE, {
  name: 'vote.broadcasted',
  sessionId: this.sessionId,
  broadcastLatencyMs: broadcastLatency,
  wsClients: Object.keys(this.clients).length,
})
```

---

## 4. Update AI Inference Events

Sentiment + insights already call `writeEvent()` in the circuit breaker. **New:** add cache metadata:

In `functions/api/lib/ai/session-context.ts:runAI()`:

```typescript
writeEvent(env.METRICS_AE, {
  name: 'ai.inference',
  sessionId: ctx.sessionId,
  teamId: ctx.teamId ?? undefined,
  plan: ctx.plan,
  model,
  durationMs,
  cached: data.cached, // ← NEW: from Gateway wrapper
  gatewayMs: data.gatewayLatencyMs, // ← NEW: network latency
})
```

---

## 5. Analytics Engine SQL Queries

Once data is flowing, build dashboards using Cloudflare Analytics API (or D1 for historical analysis).

### Dashboard 1: Session Funnel (Conversion)

```sql
-- Expected: 80%+ draft→energizing, 95%+ energizing→live, 60%+ live→closed
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  COUNT(CASE WHEN state = 'draft' THEN 1 END) AS draft_count,
  COUNT(CASE WHEN state = 'energizing' THEN 1 END) AS energizing_count,
  COUNT(CASE WHEN state = 'live' THEN 1 END) AS live_count,
  COUNT(CASE WHEN state = 'closed' THEN 1 END) AS closed_count
FROM events
WHERE name = 'session.state_changed'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### Dashboard 2: Vote Latency (P50, P95, P99)

```sql
-- Target: p50 < 100ms, p95 < 300ms (without AI Gateway)
-- With AI Gateway cache hits: p50 < 50ms, p95 < 150ms
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  APPROX_QUANTILES(voteLatencyMs, 100)[OFFSET(50)] AS p50_ms,
  APPROX_QUANTILES(voteLatencyMs, 100)[OFFSET(95)] AS p95_ms,
  APPROX_QUANTILES(voteLatencyMs, 100)[OFFSET(99)] AS p99_ms,
  COUNT(*) AS sample_size
FROM events
WHERE name = 'vote.submitted'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### Dashboard 3: AI Gateway Cache Hit Rate

```sql
-- Target (Phase 1.1): >= 35% hit rate within 2 weeks
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  model,
  COUNT(CASE WHEN cached = true THEN 1 END) AS cache_hits,
  COUNT(CASE WHEN cached = false THEN 1 END) AS cache_misses,
  ROUND(
    100.0 * COUNT(CASE WHEN cached = true THEN 1 END) / COUNT(*),
    2
  ) AS hit_rate_pct,
  AVG(CASE WHEN cached = true THEN durationMs ELSE NULL END) AS avg_cached_ms,
  AVG(CASE WHEN cached = false THEN durationMs ELSE NULL END) AS avg_uncached_ms
FROM events
WHERE name = 'ai.inference'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

### Dashboard 4: AI Cost (Inferred from Cache)

```sql
-- AI cost estimate: ~$0.0003 per inference (LLaMA-3.3-70b)
-- Cache hits save cost. This query tracks saved cost.
SELECT
  DATE_TRUNC('day', timestamp) AS day,
  COUNT(CASE WHEN cached = true THEN 1 END) AS cache_hits,
  COUNT(CASE WHEN cached = false THEN 1 END) AS uncached_calls,
  -- Estimate: $0.0003 per uncached call, $0 for cached
  ROUND(
    COUNT(CASE WHEN cached = false THEN 1 END) * 0.0003,
    4
  ) AS estimated_cost_usd,
  ROUND(
    COUNT(CASE WHEN cached = true THEN 1 END) * 0.0003,
    4
  ) AS estimated_saved_cost_usd
FROM events
WHERE name = 'ai.inference'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 6. Grafana / Cloudflare Dashboards Integration

**Option A: Cloudflare Analytics Dashboard**
- Navigate to: https://dash.cloudflare.com/accounts/.../analytics-engine
- Create custom dashboard with SQL queries above

**Option B: Grafana (if you use it)**
- Install Analytics Engine data source plugin
- Import dashboard JSON (to be created after Phase 1.2)

**Option C: D1 Mirror (for historical analysis)**
- On hourly cron, flush aggregated metrics from AE into a D1 table
- Enables long-term trend analysis and ML-powered alerting

---

## 7. Implementation Checklist

- [ ] Update `writeEvent()` signature with new `MetricsEvent` type
- [ ] Add state-change events in session routes (start, transition, close)
- [ ] Add vote latency events in SessionRoom WS handler
- [ ] Update AI inference events with `cached` + `gatewayMs` fields
- [ ] Deploy and verify 24h of data in Analytics Engine
- [ ] Build SQL queries above; save in `/docs/analytics-queries.sql`
- [ ] Create Grafana dashboard (or Cloudflare dashboard screenshots)
- [ ] Alert on: vote latency p95 > 500ms, cache hit rate < 20%, error rate > 1%

---

## Success Metrics (Phase 1.3)

✅ **Baseline established:**
- Vote latency tracked (p50, p95, p99)
- AI cache hit rate visible (target ≥ 35% by week 3)
- Session funnel conversion rates visible
- Sentiment analysis outcomes logged

✅ **Used to validate Phase 2:**
- DO vote buffering (2.2) reduces latency by 60%+
- Queues (2.1) makes close path < 500ms
- R2 snapshots (2.3) enable recovery

---

## Next: Phase 2 (Infrastructure)

See `knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md` Section III.

---

**Owner:** DevOps + Analytics  
**Sign-off required:** None (observability-only, no breaking changes)  
**Target date:** Week 2 (after Phase 1.2 WAF)  
