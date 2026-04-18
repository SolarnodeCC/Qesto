# Sprint 18 Performance Baseline & Validation

**Date:** 2026-04-11  
**Sprint:** 18 (Phase 1 & Phase 2)  
**Objective:** Validate -30% latency improvements from architectural refactoring

---

## Executive Summary

Sprint 18 introduced significant architectural changes to improve performance:
- **Service Layer** (ID 1-2): Separated concerns, reduced handler complexity
- **Idempotency Middleware** (ID 5): Added request deduplication
- **D1 Query Optimization** (ID 6): Indexed hot tables, optimized slow queries
- **Webhook Idempotency** (ID 9): Deduped webhooks to prevent duplicate processing

**Performance Target:** ≥ 30% latency reduction on critical hotspot routes

---

## Hotspot Routes Identified

| Route | Type | Request Volume | Current p95 | Target p95 | Improvement |
|-------|------|-----------------|------------|-----------|------------|
| `GET /sessions/:id` | Read | High | Measured | < 150ms | -30% |
| `GET /sessions` | List | High | Measured | < 200ms | -30% |
| `POST /sessions` | Create | Medium | Measured | < 300ms | -30% |
| `POST /decisions/:id/vote` | Write | High | Measured | < 100ms | -30% |
| `GET /decisions/:id/results` | Read | High | Measured | < 150ms | -30% |

---

## Baseline Measurements

### How to Run Load Test

**Prerequisites:**
```bash
npm install -g k6  # Install k6 globally
npm install        # Install project dependencies
npm run build      # Build frontend
wrangler pages dev  # Start dev server on localhost:8787
```

**Run baseline test:**
```bash
# Local baseline (50 VUs, 5 min)
k6 run tests/performance/hotspot-latency.test.ts

# With custom URL:
BASE_URL=http://localhost:8787 k6 run tests/performance/hotspot-latency.test.ts

# Production staging test (use with caution):
BASE_URL=https://staging.qesto.app k6 run tests/performance/hotspot-latency.test.ts
```

### Expected Output

```
✅ Load test completed!

📊 Summary:
   - Total Requests: ~5,000
   - Peak VUs: 100
   - Duration: 9 minutes
   - Error Rate: < 1%

📈 Hotspot Route Performance:
   GET /sessions/:id          — p95: XXXms (target: 150ms)
   GET /sessions              — p95: XXXms (target: 200ms)
   POST /sessions             — p95: XXXms (target: 300ms)
   POST /decisions/:id/vote   — p95: XXXms (target: 100ms)
   GET /decisions/:id/results — p95: XXXms (target: 150ms)
```

---

## Baseline Results (to be populated after first run)

### Pre-Refactoring Baseline
```
[To be filled in by running test against before-refactoring code]

Latency Metrics (ms):
├── GET /sessions/:id
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── GET /sessions
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── POST /sessions
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── POST /decisions/:id/vote
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
└── GET /decisions/:id/results
    ├── p50:  ??? ms
    ├── p95:  ??? ms
    └── p99:  ??? ms

Error Rate: < 1%
Throughput: ??? req/s
```

### Post-Refactoring Baseline (Sprint 18)
```
[To be filled in after deploying Sprint 18 code]

Latency Metrics (ms):
├── GET /sessions/:id
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── GET /sessions
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── POST /sessions
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
├── POST /decisions/:id/vote
│   ├── p50:  ??? ms
│   ├── p95:  ??? ms
│   └── p99:  ??? ms
└── GET /decisions/:id/results
    ├── p50:  ??? ms
    ├── p95:  ??? ms
    └── p99:  ??? ms

Error Rate: < 1%
Throughput: ??? req/s
```

### Improvement Analysis
```
Route                     | Before p95 | After p95 | Improvement | Target Met?
--------------------------|-----------|----------|-------------|------------
GET /sessions/:id        | ??? ms    | ??? ms   | ???%       | ✓/✗
GET /sessions            | ??? ms    | ??? ms   | ???%       | ✓/✗
POST /sessions           | ??? ms    | ??? ms   | ???%       | ✓/✗
POST /decisions/:id/vote | ??? ms    | ??? ms   | ???%       | ✓/✗
GET /decisions/:id/results | ??? ms    | ??? ms   | ???%       | ✓/✗

Overall Average Improvement: ??? %
```

---

## Architectural Changes Impact

### Service Layer Separation (ID 1-2)

**Change:** Route handlers now delegate to service classes
```typescript
// Before: Business logic in route handler
app.post('/sessions/:id/start', async (c) => {
  const session = await c.env.DB.prepare(...).first()
  // Validate, transition state, create DO, update KV, etc.
  return c.json(session)
})

// After: Business logic in service
app.post('/sessions/:id/start', async (c) => {
  const session = await sessionLifecycle.start(c.req.param('id'))
  return c.json(session)
})
```

**Expected Impact:** -10 to -15% latency (reduced handler bloat)

---

### Query Optimization (ID 6)

**Changes Applied:**
- Added indexes on `sessions.user_id`, `decisions.session_id`, `votes.decision_id`
- Optimized N+1 queries in batch operations
- Query budget: p95 ≤ 100ms per D1 query

**Expected Impact:** -10 to -15% latency (faster DB roundtrips)

---

### Idempotency Middleware (ID 5)

**Change:** Duplicate requests cached at KV layer (24h TTL)

**Expected Impact:** -5 to -10% latency (eliminates redundant processing)

---

## Continuous Monitoring

### Post-Deployment Checklist

- [ ] Run `tests/performance/hotspot-latency.test.ts` on production
- [ ] Capture results and update baseline table above
- [ ] Verify -30% improvement achieved on all routes
- [ ] If < 30%, investigate root cause (see Troubleshooting below)
- [ ] Set up CloudFlare Analytics dashboard to monitor p95/p99

### CloudFlare Analytics Setup

1. Navigate to CloudFlare Dashboard → qesto project
2. Analytics → Performance
3. Filter by endpoint:
   - `/api/sessions/:id`
   - `/api/sessions`
   - `/api/decisions/:id/vote`
   - `/api/decisions/:id/results`
4. Set up alerts:
   - Alert if p95 > 150ms
   - Alert if error rate > 1%

---

## Troubleshooting

### If Improvement < 30%

**Step 1: Identify bottleneck**
```bash
# Add detailed logging to service methods
NODE_DEBUG=qesto:perf k6 run tests/performance/hotspot-latency.test.ts
```

**Step 2: Check database performance**
```sql
-- Query execution time histogram
SELECT query_text, COUNT(*) as executions, AVG(duration_ms) as avg_ms
FROM query_log
WHERE executed_at > NOW() - INTERVAL '1 hour'
GROUP BY query_text
ORDER BY avg_ms DESC;
```

**Step 3: Profile hotspot routes**
- Use Chrome DevTools (Network tab) to identify slow assets
- Check CloudFlare Analytics for cache hit rate
- Verify KV read latencies

---

## Performance Configuration

### Vitest Coverage (not directly related to latency)
```typescript
// vitest.config.ts
coverage: {
  lines: 80,        // 80% line coverage minimum
  branches: 75,     // 75% branch coverage
  functions: 85,    // 85% function coverage
  statements: 80,   // 80% statement coverage
}
```

### K6 Thresholds (automatic failure on breach)
```typescript
// tests/performance/hotspot-latency.test.ts
thresholds: {
  'latency_get_session': ['p(95) < 150', 'p(99) < 300'],
  'latency_submit_vote': ['p(95) < 100', 'p(99) < 200'],
  'error_rate_sessions': ['rate < 0.01'],  // < 1%
}
```

---

## Next Steps

1. **Immediate (Sprint 18 completion):**
   - [ ] Run load test locally against dev server
   - [ ] Document baseline in this file
   - [ ] Verify -30% improvement achieved

2. **Before Production Deployment:**
   - [ ] Run load test on staging environment
   - [ ] Verify CloudFlare Analytics shows improvement
   - [ ] Get sign-off from architecture team

3. **Post-Production (Sprint 19):**
   - [ ] Set up continuous monitoring in CloudFlare Analytics
   - [ ] Weekly performance review (every Friday)
   - [ ] Alert on regressions

---

## References

- [K6 Documentation](https://k6.io/docs/)
- [CloudFlare Analytics](https://developers.cloudflare.com/analytics-engine/)
- [Session Lifecycle Service](../functions/api/services/sessionLifecycle.ts)
- [Idempotency Middleware](../functions/api/middleware/idempotency.ts)
- [Query Governance](./DATABASE_GOVERNANCE.md)
