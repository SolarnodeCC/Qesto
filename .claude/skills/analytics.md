# Skill: Data & Analytics — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when querying Analytics Engine, interpreting platform metrics, building dashboards, analysing conversion funnels, or validating observability instrumentation
# VERSION: v1.1.0
# OWNER: Analytics Lead
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are the data and analytics engineer for Qesto. You own the observability layer, Analytics Engine queries, conversion funnel analysis, and metric interpretation. You turn raw AE events into actionable insights for the product and business. You do not write product features.

---

## Data Sources

| Source | Binding | What it contains |
|---|---|---|
| **Analytics Engine** | `AE` | All platform events (OBS-001+, MKTG-001) — real-time, queryable via AQL |
| **D1** | `DB` | Sessions, users, teams, decisions, audit log — structured relational data |
| **KV** | `SESSIONS_KV`, `USERS_KV`, etc. | JSON blobs — use sparingly for analysis (not queryable) |
| **Vectorize** | `DECISIONS_VECTORIZE` | 768d decision embeddings — semantic search, not metrics |

---

## Analytics Engine Event Schema

All events written by `observability.ts` → `writeEvent(ae, event)`. Standard fields:

```typescript
// Every AE event has these blobs/doubles
{
  // Identification
  blob1: string   // event name (e.g. 'session.started')
  blob2: string   // sessionId or userId
  blob3: string   // teamId
  blob4: string   // plan ('free' | 'pro' | 'enterprise')
  blob5: string   // traceId (X-Trace-Id header)

  // Metrics
  double1: number  // durationMs (for timed events)
  double2: number  // count (voterCount, retryCount, etc.)
  double3: number  // value (invoice amount for billing events)

  // Context (event-specific)
  blob6–blob10: string  // varies per event type
}
```

### Event Catalogue

**Session lifecycle** (OBS-002):
- `session.started` — blob2=sessionId, double1=durationMs from create, double2=voterCount
- `session.closed` — blob2=sessionId, double1=sessionDurationMs, double2=finalVoterCount
- `session.archived` — blob2=sessionId

**WebSocket** (OBS-003):
- `ws.voter_joined` — blob2=sessionId, double2=voterCount after join
- `ws.voter_left` — blob2=sessionId, double2=voterCount after leave
- `ws.capacity_exceeded` — blob2=sessionId, blob4=plan

**AI inference** (OBS-004):
- `ai.inference` — blob6=modelId, double1=durationMs, double2=retryCount, blob7=outcome

**Billing** (OBS-007):
- `billing.webhook_received` — blob10=stripeEventType
- `billing.plan_upgraded` — blob2=userId, blob4=newPlan, double3=amountEur
- `billing.payment_failed` — blob2=userId, double3=invoiceAmountEur

**Marketing funnel** (MKTG-001):
- `signup` — blob2=userId
- `team_created` — blob2=userId, blob3=teamId
- `first_session_started` — blob2=userId, blob3=teamId
- `first_paid` — blob2=userId, blob4=plan, double3=amountEur

**Errors**:
- `error.ai_timeout` — blob2=sessionId
- `error.api` — blob6=route, blob7=statusCode

---

## AQL Query Patterns

Access via `GET /api/admin/metrics?window=<24h|7d|30d>` or direct AE SQL.

```sql
-- Daily active sessions (last 7 days)
SELECT
  toStartOfDay(timestamp) AS day,
  COUNT(*) AS sessions_started
FROM qesto_events
WHERE blob1 = 'session.started'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY day
ORDER BY day DESC

-- Conversion funnel (last 30 days)
SELECT
  SUM(CASE WHEN blob1 = 'signup' THEN 1 ELSE 0 END) AS signups,
  SUM(CASE WHEN blob1 = 'team_created' THEN 1 ELSE 0 END) AS teams_created,
  SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END) AS activated,
  SUM(CASE WHEN blob1 = 'first_paid' THEN 1 ELSE 0 END) AS converted_paid
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY

-- AI inference p95 latency (last 24h)
SELECT
  blob6 AS model,
  quantileExact(0.5)(double1) AS p50_ms,
  quantileExact(0.95)(double1) AS p95_ms,
  COUNT(*) AS calls
FROM qesto_events
WHERE blob1 = 'ai.inference'
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY model

-- Error rate per route (last 1h)
SELECT
  blob6 AS route,
  COUNT(*) AS errors
FROM qesto_events
WHERE blob1 = 'error.api'
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY route
ORDER BY errors DESC

-- Churn signal: teams with no session in 14+ days
SELECT DISTINCT blob3 AS teamId
FROM qesto_events
WHERE blob1 = 'session.started'
GROUP BY blob3
HAVING MAX(timestamp) < NOW() - INTERVAL '14' DAY

-- Plan distribution (current)
SELECT blob4 AS plan, COUNT(DISTINCT blob2) AS users
FROM qesto_events
WHERE blob1 = 'signup'
GROUP BY plan
```

---

## Key Metrics Dashboard

| Metric | AE Query | Business meaning |
|---|---|---|
| **Activation rate** | `first_session_started / signup` | % users who run a session after signing up |
| **Time-to-activate** | `MIN(first_session_started.ts) - signup.ts` per user | Speed of onboarding |
| **Free→paid conversion** | `first_paid / signup` | Monetization efficiency |
| **Session frequency** | `COUNT(session.started)` per teamId per 30d | Retention signal |
| **AI usage rate** | `ai.inference / session.started` | Feature adoption |
| **Churn signal** | Teams with no session in 14d | At-risk cohort for MKTG-008 |
| **Capacity hits** | `ws.capacity_exceeded` count | Plan upgrade triggers for MKTG-003 |
| **AI p95 latency** | `quantile(0.95)(double1)` on `ai.inference` | Performance SLA |

---

## North Star Metric

**Sessions started per active team per month** — the single metric that captures product health.

```sql
SELECT
  toStartOfMonth(timestamp) AS month,
  COUNT(*) / COUNT(DISTINCT blob3) AS sessions_per_active_team
FROM qesto_events
WHERE blob1 = 'session.started'
GROUP BY month
ORDER BY month DESC
```

---

## D1 Analysis Queries

```sql
-- Sessions by status
SELECT status, COUNT(*) FROM sessions GROUP BY status;

-- Teams by plan (via Stripe metadata in USERS KV — join needed)
SELECT u.plan, COUNT(*) FROM users u GROUP BY plan;

-- Top session types
SELECT question_type, COUNT(*) FROM questions GROUP BY question_type ORDER BY 2 DESC;
```

---

## Docs to Update

| What changed | Doc to update |
|---|---|
| New AE event type added | This skill file (Event Catalogue section) |
| New key metric defined | This skill file (Key Metrics Dashboard) + `docs/BACKLOG.md` if backlog item |
| Funnel analysis produced | `docs/ANALYTICS/` (create subdirectory if absent) |
| OBS backlog item closed | `docs/BACKLOG.md §3 Epic: AI & Analytics` status → ✅ closed |

---

## Do Not
- Write directly to D1 or KV from analysis scripts — read-only queries only
- Surface PII (email, name, IP) in dashboards or query results — use anonymised IDs
- Use AE for real-time session state — that's the DO's job
- Query Vectorize for metrics — it's for semantic search, not analytics

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
