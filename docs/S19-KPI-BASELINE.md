# S19-MEASURE-01 — Sprint 19 KPI Baseline
_Created: 2026-05-01 | OBS-02 instrumentation shipped this sprint_

## Purpose

Establish the analytics baseline for the three Sprint 19 KPIs so that Sprint 20+ work (LAUNCHPAD-02, AI feature iterations) has a denominator to measure against. All data collection starts from the date OBS-02 is deployed.

---

## Instrumented Events (post OBS-02)

| Event name | Trigger | Key fields |
|---|---|---|
| `session.started` | Session transitions DRAFT → LIVE | `sessionId`, `teamId`, `plan`, `durationMs` (wizard time) |
| `preflight.checked` | GET `/api/sessions/:id/preflight` | `sessionId`, `teamId`, `plan`, `count` (failing checks, 0 = ready) |
| `ai.rate_limited` | Any AI route returns 429 | `userId`, `sessionId`, `traceId` |
| `session.closed` | Session transitions LIVE → CLOSED | `sessionId`, `teamId`, `plan`, `durationMs` (session duration) |

Blob/double layout (Analytics Engine schema):
```
blob1 = event name
blob2 = sessionId (or userId when sessionId absent)
blob3 = teamId
blob4 = plan tier
blob5 = traceId
double1 = durationMs
double2 = count
double3 = value (monetary / score)
```

---

## KPI 1 — Session Launch Rate (Preflight → Live)

**Definition:** % of preflight calls where the session was subsequently launched (status became LIVE within 30 min).

### AQL — preflight attempts per day
```sql
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(_sample_interval) AS preflight_attempts,
  SUM(IF(double2 = 0, _sample_interval, 0)) AS ready_count
FROM qesto_metrics
WHERE blob1 = 'preflight.checked'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

### AQL — launches per day
```sql
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(_sample_interval) AS launches
FROM qesto_metrics
WHERE blob1 = 'session.started'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

**Launch rate** = `launches / preflight_attempts` (join on day).

### Known gap
Wizard start event is not instrumented. The denominator is preflight calls, not wizard opens. Teams that never reach preflight are invisible. This gap is recorded for LAUNCHPAD-02 instrumentation scope.

---

## KPI 2 — AI Suggestion Acceptance Rate

**Definition:** Of AI-generated questions surfaced to hosts, what % were accepted vs dismissed.

### D1 query — acceptance aggregate (post-deploy)
```sql
SELECT
  DATE(created_at) AS day,
  SUM(ai_accepted_count)  AS accepted,
  SUM(ai_dismissed_count) AS dismissed,
  ROUND(
    100.0 * SUM(ai_accepted_count)
    / NULLIF(SUM(ai_accepted_count) + SUM(ai_dismissed_count), 0),
    1
  ) AS acceptance_pct
FROM sessions
WHERE ai_generated = 1
  AND created_at >= '2026-05-01'
GROUP BY day
ORDER BY day
```

### AQL — rate-limit pressure on AI routes
```sql
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(_sample_interval) AS rate_limit_hits
FROM qesto_metrics
WHERE blob1 = 'ai.rate_limited'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

### Known gap
`ai_accepted_count` / `ai_dismissed_count` are set at wizard completion (PATCH). If a host abandons the wizard after generating suggestions, those dismissals are not counted. The acceptance rate is a lower bound on true acceptance.

---

## KPI 3 — Preflight Failure Rate

**Definition:** % of preflight calls that returned `ready: false` (count > 0).

### AQL
```sql
SELECT
  toStartOfDay(timestamp) AS day,
  SUM(_sample_interval) AS total_preflight,
  SUM(IF(double2 > 0, _sample_interval, 0)) AS failures,
  ROUND(
    100.0 * SUM(IF(double2 > 0, _sample_interval, 0))
    / NULLIF(SUM(_sample_interval), 0),
    1
  ) AS failure_pct
FROM qesto_metrics
WHERE blob1 = 'preflight.checked'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

`double2` maps to the `count` field = number of failing checks (0 when `ready: true`).

---

## Baseline Values

Data collection begins on OBS-02 deploy date (2026-05-01). No historical values exist for these KPIs. Baseline will be computed after the first 7 days of production data and appended to this document.

| KPI | 7-day baseline | Target (Sprint 21 review) | Source |
|---|---|---|---|
| Session launch rate | _TBD post-deploy_ | ≥ 70% | AQL join above |
| AI acceptance rate | _TBD post-deploy_ | ≥ 60% | D1 query above |
| Preflight failure rate | _TBD post-deploy_ | ≤ 15% | AQL above |
| AI rate-limit hits/day | _TBD post-deploy_ | ≤ 5% of AI calls | AQL above |

---

## Known Measurement Gaps

| Gap | Impact | Planned fix |
|---|---|---|
| No wizard-start event | Launch-rate denominator is preflight, not wizard-open | LAUNCHPAD-02 scope |
| Abandoned wizard AI dismissals not counted | Acceptance rate is lower bound | Out of scope this sprint |
| `ai_accepted_count` = 0 when AI not used | Skews aggregate; filter `WHERE ai_generated = 1` | Documented in query above |
| AE data retention | AE rolls off after 90 days by default | Archive monthly to R2 (future) |

---

## Trace Correlation

Each event carries `traceId` (blob5) matching the `trace_id` header on the originating HTTP request. To correlate a specific preflight check with subsequent session events:

```sql
SELECT blob1, blob2, blob5, double1, double2, timestamp
FROM qesto_metrics
WHERE blob5 = '<trace_id>'
ORDER BY timestamp
```
