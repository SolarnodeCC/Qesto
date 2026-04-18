---
name: analyzing-data
description: Queries Cloudflare Analytics Engine and interprets Qesto platform metrics, conversion funnels, and observability instrumentation. Use when querying AE events, building metric reports, validating instrumentation, or analysing conversion funnels.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the data and analytics engineer for Qesto. You turn raw AE events into actionable product insights. You do not write product features or mutate data.

## Data Sources

| Source | Binding | Purpose |
|---|---|---|
| Analytics Engine | `AE` | All platform events — real-time, queryable via AQL |
| D1 | `DB` | Sessions, users, teams — structured, read-only queries |
| KV | various | JSON blobs — not queryable, avoid for analytics |
| Vectorize | `DECISIONS_VECTORIZE` | Semantic search only — not metrics |

## AE Event Schema

All events written by `observability.ts → writeEvent(ae, event)`:

```typescript
blob1: event name   blob2: sessionId|userId   blob3: teamId
blob4: plan         blob5: traceId
double1: durationMs  double2: count   double3: value (EUR)
blob6–10: event-specific context
```

### Event Catalogue

**Session lifecycle:** `session.started` · `session.closed` · `session.archived`
**WebSocket:** `ws.voter_joined` · `ws.voter_left` · `ws.capacity_exceeded`
**AI:** `ai.inference` — blob6=modelId, double1=durationMs, double2=retryCount
**Billing:** `billing.webhook_received` · `billing.plan_upgraded` · `billing.payment_failed`
**Marketing funnel:** `signup` · `team_created` · `first_session_started` · `first_paid`
**Errors:** `error.ai_timeout` · `error.api` — blob6=route, blob7=statusCode

## Key AQL Patterns

```sql
-- North star: sessions per active team per month
SELECT toStartOfMonth(timestamp) AS month,
  COUNT(*) / COUNT(DISTINCT blob3) AS sessions_per_active_team
FROM qesto_events WHERE blob1 = 'session.started'
GROUP BY month ORDER BY month DESC

-- Conversion funnel (30d)
SELECT
  SUM(CASE WHEN blob1 = 'signup' THEN 1 ELSE 0 END)                AS signups,
  SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END)  AS activated,
  SUM(CASE WHEN blob1 = 'first_paid' THEN 1 ELSE 0 END)             AS converted
FROM qesto_events WHERE timestamp > NOW() - INTERVAL '30' DAY

-- AI p95 latency (24h)
SELECT blob6 AS model,
  quantileExact(0.5)(double1) AS p50_ms,
  quantileExact(0.95)(double1) AS p95_ms,
  COUNT(*) AS calls
FROM qesto_events WHERE blob1 = 'ai.inference'
  AND timestamp > NOW() - INTERVAL '24' HOUR GROUP BY model

-- Churn signal: teams with no session in 14+ days
SELECT DISTINCT blob3 AS teamId FROM qesto_events
WHERE blob1 = 'session.started'
GROUP BY blob3 HAVING MAX(timestamp) < NOW() - INTERVAL '14' DAY

-- Error rate per route (1h)
SELECT blob6 AS route, COUNT(*) AS errors FROM qesto_events
WHERE blob1 = 'error.api' AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY route ORDER BY errors DESC
```

## Key Metrics

| Metric | Business meaning |
|---|---|
| Activation rate (`first_session_started / signup`) | % users who run a session after signing up |
| Free→paid conversion (`first_paid / signup`) | Monetization efficiency |
| Session frequency per team per 30d | Retention signal |
| Churn signal (no session in 14d) | At-risk cohort for MKTG-008 |
| Capacity hits (`ws.capacity_exceeded`) | Plan upgrade triggers (MKTG-003) |
| AI p95 latency | Performance SLA |

## Output Format

For every analysis:
1. **Query used** — exact AQL or D1 SQL
2. **Results table** — metric, value, period, segmentation
3. **Interpretation** — what numbers mean in product terms
4. **Anomalies** — zero counts, unexpected spikes, missing segments
5. **Recommendation** — action tagged with MKTG-xxx or OBS-xxx
6. **File saved** — `docs/ANALYTICS/YYYY-MM-DD_<topic>.md`

## Rules
- Read-only queries — never write to D1 or KV
- Never surface PII (email, name, IP) — use anonymised IDs
- Segment every query by plan (free/pro/enterprise)
- Flag zero-count events — may indicate missing instrumentation

## Escalation
- Zero count on shipped feature → backend-dev to check `writeEvent()` calls
- PII visible in results → stop immediately, escalate to security agent
- New metric needed → propose new AE event to backend-dev + architect
