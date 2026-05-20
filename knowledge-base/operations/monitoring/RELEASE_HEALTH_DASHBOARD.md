# v2.2 Release Health Dashboard Checklist
## RC-OBS-01 | Sprint 32

> **Purpose:** Define the admin surfaces and metrics the platform lead monitors during and after
> v2.2 rollout (LIVE energizers). Updated after each cohort promotion.

---

## Dashboard Surfaces (Admin Panel)

### 1. Active Session Monitoring

**URL:** `/admin` → Sessions tab

| Signal | Source | Alert Threshold |
|--------|--------|-----------------|
| Active sessions (LIVE status) | D1 `sessions` table | Baseline × 3 |
| Sessions in ENERGIZING state | D1 `sessions` table | > 0 after `LIVE_ENERGIZERS_ENABLED=false` |
| Session creation rate (last 1h) | Analytics Engine `session.started` | < 50% of hourly baseline |
| Session close rate (last 1h) | Analytics Engine `session.closed` | Significant drop from creation rate |

### 2. WebSocket Health

**Source:** Analytics Engine `QESTO_EVENTS` + `/api/admin/health`

| Signal | AQL Event | Alert Threshold |
|--------|-----------|-----------------|
| Reconnect rate | `ws.voter_joined` with reconnect tag | > 5% of joins |
| Capacity denials | `ws.capacity_exceeded` | Any in first 30 min post-rollout |
| Token bucket contention (vote flood) | `ws.token_bucket_contention` | > 5% of `ws.vote_submitted` |
| Vote submission p95 latency | `ws.vote_submitted` double1 | > 200ms |

**AQL — WebSocket error rate (last 1h):**
```sql
SELECT
  count() AS total_joins,
  countIf(blob1 = 'ws.capacity_exceeded') AS capacity_denials
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '1' HOUR
  AND blob1 IN ('ws.voter_joined', 'ws.capacity_exceeded')
```

### 3. Energizer Engagement

**URL:** `/admin` → Engagement tab (ADMIN-ENGAGE-01)

| Signal | Description | Green Baseline |
|--------|-------------|----------------|
| Activation rate | Activations / sessions with energizers | > 70% |
| Participation rate | Voters answered / voters joined | > 60% |
| Completion rate | Energizers completed / activated | > 80% |
| Dropout count | Voters who left during energizer | < 10% of participants |
| Activation denials | Permission gate rejections | 0 (unless testing role-based access) |

**AQL — Energizer funnel (last 24h):**
```sql
SELECT
  countIf(blob1 = 'ws.energizer_activated')          AS activations,
  countIf(blob1 = 'ws.energizer_answered')            AS answers,
  countIf(blob1 = 'ws.energizer_completed')           AS completions,
  countIf(blob1 = 'ws.energizer_activation_denied')   AS denials
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '24' HOUR
  AND blob1 LIKE 'ws.energizer_%'
```

### 4. Error Rate (API)

**Source:** Analytics Engine `error.api` events + Cloudflare dashboard

| Signal | Alert Threshold |
|--------|-----------------|
| 5xx error rate | > 1% of requests |
| Auth errors (401) | > 0.5% of authenticated requests |
| Billing errors (Stripe circuit open) | Any `email.circuit_open` log event |
| JWKS circuit open | Any `JWKS service unavailable` log |

**AQL — API error rate (last 1h):**
```sql
SELECT count() AS errors
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '1' HOUR
  AND blob1 = 'error.api'
```

### 5. Vote Submission Performance

**Source:** Analytics Engine `ws.vote_submitted`

Run the full percentile query from `LATENCY_BENCHMARKS.md`:
- p50 target: ≤ 15ms
- p95 target: ≤ 50ms
- p99 target: ≤ 150ms

### 6. Slack Integration (Sprint 32)

Once `INTEGRATION_ENABLED=1`:

| Signal | Source | Alert |
|--------|--------|-------|
| Slack notifications sent | `integration.slack.notified` event | N/A (informational) |
| Slack notification failures | `slack.notify.error` log | > 3 per hour |
| Slack circuit open (if CB wrapped) | Log event | Any |

---

## Cohort Promotion Checklist

### Before Cohort 1 (internal, `LIVE_ENERGIZERS_ENABLED=false`)

- [ ] `/api/admin/health` returns 200 with current commit SHA
- [ ] `/api/version` returns current commit SHA
- [ ] 0 new P0 regressions in test suite
- [ ] `npm run typecheck` — 0 errors

### Before Cohort 2 (internal, `LIVE_ENERGIZERS_ENABLED=true`)

- [ ] Staging WebSocket smoke complete (STAGING_MIGRATION_CHECKLIST.md)
- [ ] One Quick Finger and one Team Quiz activated and completed via real WebSocket
- [ ] `/api/admin/analytics` counts incremented for energizer activations, participants, completions
- [ ] `/api/admin/audit?action=ws.energizer_activated` returns rows
- [ ] Permission denial confirmed: member without `energizer:activate` → denial in audit
- [ ] Audit export contains no PII (emails, JWTs, Stripe keys, AI prompts)

### Before Cohort 3 (first external team)

- [ ] Cohort 2 complete with 0 blocking incidents (48h monitoring window)
- [ ] p95 vote latency confirmed ≤ 50ms in Analytics Engine
- [ ] Reconnect rate < 5% in Analytics Engine
- [ ] Slack integration smoke (if `INTEGRATION_ENABLED=1`)
- [ ] Support queue: 0 tickets tagged energizer/realtime from Cohort 2

### Before Full Rollout (Cohort 4 — gradual team-plan)

- [ ] 48h Cohort 3 clean window
- [ ] Zero `ws.capacity_exceeded` events in Cohort 3
- [ ] Admin analytics showing energizer engagement > 60% participation
- [ ] Rollback trigger criteria reviewed and owner confirmed

---

## Rollback Trigger Criteria

Disable `LIVE_ENERGIZERS_ENABLED` immediately if any of the following occur:

1. WebSocket error rate > 5% for two consecutive 5-minute windows
2. Reconnect rate doubles against baseline
3. `ws.energizer_activation_denied` spikes without matching role-change audit events
4. Any participant data exposure report
5. Vote submission p99 > 500ms for > 30 minutes
6. Stripe or JWKS circuit breaker opens (check KV `cb:v1:stripe:production`)

**Rollback command:**
```bash
# Via wrangler vars update
wrangler pages env set LIVE_ENERGIZERS_ENABLED false --env production
```

---

## Owner

Platform lead monitors this dashboard during Sprint 32–33 rollout.
Slack alerts: #qesto-ops (if Slack integration is connected).
Escalation: file incident in `knowledge-base/operations/incidents/`.
