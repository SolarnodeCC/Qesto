# Qesto — Vote Submission Latency Benchmarks
## PERF-PROOF-01 | Sprint 32 | v2.2 Observability Baseline

> **Purpose:** Capture Cloudflare Analytics Engine p50/p95/p99 latency data for vote submissions.
> This document contains the AQL queries, baseline values, and monitoring procedures.

---

## Event Schema

Vote submission latency is recorded in Analytics Engine when a voter submits a vote
through the SessionRoom Durable Object (SessionRoom.ts:863-869):

```
Event: ws.vote_submitted
blob1  = "ws.vote_submitted"        — event name
blob2  = sessionId                  — session identifier
blob3  = teamId                     — team identifier
blob4  = plan                       — "free" | "starter" | "team"
blob5  = traceId                    — request trace ID
double1 = durationMs                — DO vote processing latency in ms (t0 to write)
double2 = 0                         — (reserved)
double3 = 0                         — (reserved)
```

The `durationMs` field (double1) measures the full cycle from message receipt to storage
write completion inside the Durable Object, including:
- Token-bucket rate limit check
- Vote validation (question match, option validity)
- Voter deduplication (voter state load + mutation)
- Count update + storage persistence (2x DO storage writes)

This is **DO processing latency**, not end-to-end network latency. Network latency
(browser → Cloudflare edge → DO) is captured separately by Cloudflare's built-in
WebSocket latency metrics in the Cloudflare dashboard.

---

## AQL Queries

### P50 / P95 / P99 vote processing latency (last 24 hours)

```sql
SELECT
  quantileWeighted(0.50)(double1) AS p50_ms,
  quantileWeighted(0.95)(double1) AS p95_ms,
  quantileWeighted(0.99)(double1) AS p99_ms,
  count()                          AS total_votes,
  avg(double1)                     AS avg_ms
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '24' HOUR
  AND blob1 = 'ws.vote_submitted'
```

### P95 by plan tier (last 7 days)

```sql
SELECT
  blob4                            AS plan,
  quantileWeighted(0.50)(double1)  AS p50_ms,
  quantileWeighted(0.95)(double1)  AS p95_ms,
  count()                          AS total_votes
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '7' DAY
  AND blob1 = 'ws.vote_submitted'
GROUP BY blob4
ORDER BY plan
```

### Hourly vote latency trend (last 6 hours)

```sql
SELECT
  toStartOfHour(timestamp)        AS hour,
  quantileWeighted(0.50)(double1) AS p50_ms,
  quantileWeighted(0.95)(double1) AS p95_ms,
  count()                          AS votes
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '6' HOUR
  AND blob1 = 'ws.vote_submitted'
GROUP BY hour
ORDER BY hour ASC
```

### Cloudflare Workers AI Analytics (for ai-insights latency)

```sql
SELECT
  quantileWeighted(0.50)(double1) AS p50_ms,
  quantileWeighted(0.95)(double1) AS p95_ms,
  quantileWeighted(0.99)(double1) AS p99_ms,
  count()                          AS inferences
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '24' HOUR
  AND blob1 = 'ai.inference'
```

---

## Baseline Targets (v2.2 SLA)

Measured against Cloudflare DO processing latency for vote submissions.
These targets are based on Cloudflare Durable Object performance characteristics
with D1 storage operations.

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| p50 | ≤ 15 ms | > 50 ms |
| p95 | ≤ 50 ms | > 200 ms |
| p99 | ≤ 150 ms | > 500 ms |

> **Note:** These are DO-internal latency targets. End-to-end WebSocket round-trip
> (browser → Cloudflare edge) adds network latency (typically 20–80ms depending on region).

---

## How to Run Queries

### Via Cloudflare Dashboard

1. Navigate to `Workers & Pages` → `Analytics Engine` in the Cloudflare dashboard
2. Select the `QESTO_EVENTS` dataset (bound as `METRICS_AE` in wrangler.toml)
3. Paste the AQL query above and click **Run Query**

### Via Wrangler CLI

```bash
# p50/p95/p99 for last 24h
wrangler analytics-engine query \
  --dataset QESTO_EVENTS \
  --query "SELECT quantileWeighted(0.50)(double1) AS p50_ms, quantileWeighted(0.95)(double1) AS p95_ms, quantileWeighted(0.99)(double1) AS p99_ms, count() AS total_votes FROM QESTO_EVENTS WHERE timestamp > NOW() - INTERVAL '24' HOUR AND blob1 = 'ws.vote_submitted'"

# Votes by plan tier (last 7 days)
wrangler analytics-engine query \
  --dataset QESTO_EVENTS \
  --query "SELECT blob4 AS plan, quantileWeighted(0.95)(double1) AS p95_ms, count() AS votes FROM QESTO_EVENTS WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob1 = 'ws.vote_submitted' GROUP BY blob4"
```

---

## Monitoring Runbook

**Frequency:** Run p50/p95/p99 query daily during v2.2 rollout (Sprint 32–33).

**Alert conditions (auto-check via admin health dashboard):**
- p99 > 500ms for two consecutive measurement windows → alert platform lead
- Vote total drops to 0 for a session in progress → investigate DO storage issue
- `ws.token_bucket_contention` events spike > 5% of `ws.vote_submitted` → rate limit tuning needed

**Baseline capture procedure:**
1. Run AQL queries above after first production vote session with `LIVE_ENERGIZERS_ENABLED=true`
2. Record actual p50/p95/p99 in the table below
3. Update targets if they diverge significantly from theoretical values

### v2.2 Baseline Measurements

| Date | Environment | p50 (ms) | p95 (ms) | p99 (ms) | Sample Size | Notes |
|------|-------------|----------|----------|----------|-------------|-------|
| TBD  | staging     | —        | —        | —        | —           | First staging smoke run |
| TBD  | production  | —        | —        | —        | —           | First prod cohort |

> Fill in after Sprint 32 staging smoke (RC-OBS-01).
