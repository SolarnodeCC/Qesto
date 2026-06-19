---
id: ANALYTICS-S60-70-PROPOSALS
type: analytics
domain: product
category: backlog-proposals
status: proposed
version: 1.0
created: 2026-05-25
author: qesto-analytics
relates_to:
  - BACKLOG_MASTER
  - SPRINT30_39_PLAN
  - OBS-VOTE-01
  - PERF-PROOF-01
  - SCALE-PROOF-01
---

# Sprint 60–70 Analytics & Observability Story Proposals

> **Historical (pre-release-train).** This proposal predates the move to **release trains** and
> uses the retired 120–150 pts/sprint capacity model. Any still-relevant story here is committed
> only via a row in [`BACKLOG_ACTIVE.md`](../../product/backlog/BACKLOG_ACTIVE.md) at the
> 40–60 pts/train cap — see [`RELEASE_TRAIN_MASTER.md`](../../product/planning/RELEASE_TRAIN_MASTER.md).

_Produced by: qesto-analytics agent, 2026-05-25._  
_Context: Activation funnel S49 review, PERF-PROOF-01 (S32), OBS-* arc (S30–S33), SCALE-PROOF-01 (S32), SUB100MS_PROOF requirement._  
_Sprint capacity assumption: 120–150 pts/sprint. Analytics/OBS stories are ~25–40 pts of that budget; remaining capacity carries feature epics._  
_North-star metric: **Sessions started per active team per month** — segmented by plan (free/pro/enterprise)._

---

## Executive Summary

| Sprint | Theme | OBS+ANALYTICS pts | Key deliverable |
|--------|-------|-------------------|-----------------|
| S60 | Analytics foundation for scale | 34 | North-star dashboard v1 + activation funnel v2 |
| S61 | Multi-region latency segmentation | 34 | SUB100MS_PROOF + SLO definitions + region AQL |
| S62 | Partner funnel instrumentation | 30 | `partner.*` AE events + partner dashboard |
| S63 | Scale proof AQL + SLO alerting | 34 | Scale proof v2 AQL suite + SLO burn-rate API |
| S64 | Cohort analytics + churn measurement | 30 | Weekly cohort retention + churn signal event |
| S65 | North-star v2 + AI metrics | 37 | AI overlay on north-star + sentiment trend |
| S66 | Integration analytics maturity | 31 | Integration adoption funnel + export health |
| S67 | Enterprise scale evidence package | 31 | Scale proof report v2 + enterprise health dash |
| S68 | Mobile + PWA analytics | 26 | Mobile funnel AQL + PWA retention correlation |
| S69 | Tournament + gamification depth | 29 | Tournament AE events + coaching adoption AQL |
| S70 | North-star v3 + annual business review | 39 | ABR AQL package + SLO annual burn report |
| **Total** | | **~335 pts** | Across 11 sprints |

---

## Data Prerequisites Inventory

Before S60 work can begin, the following events **must** have been live for ≥30 days (accumulated in AE):

| Event | Shipped in | Required for | Min data age at S60 |
|-------|-----------|--------------|---------------------|
| `ws.vote_submitted` | OBS-VOTE-01 (S30) | PERF-PROOF-01, SUB100MS_PROOF | ✅ Already ≥30d by S32 |
| `ws.voter_joined` / `ws.voter_disconnected` | OBS-WS-VOTER-01 (S33) | Scale proof, reconnect rate | ✅ Available S34+ |
| `integration.connected` / `export.initiated` | OBS-INTEGRATION-01 (S33) | Integration funnel | ✅ Available S34+ |
| `ai.sentiment_analysis` | AI-SENTIMENT-01 (S34) | Sentiment trend | ✅ Available S35+ |
| `ai.inference` blob6=acceptance_rate | OBS-AI-QUALITY-01 (S65, proposed) | AI quality funnel | Added S65 |
| `partner.referral` | OBS-PARTNER-01 (S62, proposed) | Partner funnel | Added S62 |
| `session.joined_mobile` | OBS-MOBILE-01 (S68, proposed) | Mobile funnel | Added S68 |
| `tournament.started` | OBS-TOURNAMENT-01 (S69, proposed) | Tournament analytics | Added S69 |

**Current AE schema gaps for S60-70 work** (escalations for backend-dev):

1. **No region/colo tag** on any AE event — `blob6` or `blob7` never carries `CF-Ray` colo prefix. Needed for multi-region latency. Gate: OBS-COLO-01 (S60).
2. **No partner attribution** — `signup` and `first_session_started` have no `blob6=referral_source`. Gate: OBS-PARTNER-01 (S62).
3. **No mobile device type** on `ws.vote_submitted` — needed for mobile funnel split. Gate: OBS-MOBILE-01 (S68).
4. **`ws.capacity_exceeded` missing `plan` field** in pre-S30 events — fixed by OBS-ENERGIZER-FIX-01 (S30); only post-S30 data is plan-segmented.
5. **No enterprise sub-tier** in `blob4=plan` — enterprise is flat; sub-tiers (`enterprise_standard`/`enterprise_plus`) not tracked. Gate: OBS-PLAN-TIERS-02 (S60).

---

## Activation Funnel Status (S49 Review)

Based on existing AE schema, the S49 activation funnel query is:

```sql
-- Activation funnel v1 (currently possible)
SELECT
  toStartOfMonth(timestamp) AS month,
  blob4                     AS plan,
  SUM(CASE WHEN blob1 = 'signup'                THEN 1 ELSE 0 END) AS signups,
  SUM(CASE WHEN blob1 = 'team_created'          THEN 1 ELSE 0 END) AS teams_created,
  SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END) AS activated,
  SUM(CASE WHEN blob1 = 'first_paid'            THEN 1 ELSE 0 END) AS converted,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'signup' THEN 1 ELSE 0 END), 0),
    1
  ) AS activation_rate_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY month, plan
ORDER BY month DESC, plan
```

**Known gap at S49**: The funnel cannot resolve `signup → team_created → first_session_started` on the same user because `blob2` stores either `userId` OR `sessionId` and `signup` events use `userId` while `first_session_started` uses `sessionId`. This prevents per-user funnel stitching in AQL — only aggregate counts are reliable. A `userId` field on `first_session_started` is needed for cohort-exact funnel. This is the data prerequisite for **ANALYTICS-FUNNEL-01** in S60.

---

## SUB100MS_PROOF Status

`PERF-PROOF-01` (S32) captures p50/p95/p99 from `ws.vote_submitted` but does not segment by Cloudflare colo. The formal **SUB100MS_PROOF** evidence requires:

1. `ws.vote_submitted` events with `blob6=colo` (gate: OBS-COLO-01, S60)
2. ≥30d of post-OBS-COLO-01 data (available by S61)
3. AQL showing p95 < 100ms across all colos with ≥100 votes each (story: PERF-PROOF-02, S61)

Current best-effort query (without colo segmentation):

```sql
-- SUB100MS_PROOF v0 (no colo, pre-OBS-COLO-01)
SELECT
  blob4                            AS plan,
  quantileExact(0.50)(double1)     AS p50_ms,
  quantileExact(0.95)(double1)     AS p95_ms,
  quantileExact(0.99)(double1)     AS p99_ms,
  COUNT(*)                         AS vote_count
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY plan
ORDER BY plan
```

This produces a weak claim. `PERF-PROOF-02` (S61) will add the colo dimension and satisfy GTM.

---

## Sprint 60 — Analytics Foundation for Scale

**Sprint window:** ~2027-06-15 → 2027-06-29  
**OBS+ANALYTICS budget:** 34 pts

### OBS-COLO-01 · 5 pts · P1

**Story:** As an analytics operator, I need the Cloudflare colo identifier forwarded into `ws.vote_submitted` and `ai.inference` AE events so I can segment latency by geographic region.

**Acceptance Criteria:**
- Given a `ws.vote_submitted` event, when written by `SessionRoom.ts`, then `blob7=colo` is populated from the `CF-Ray` header prefix (e.g. `AMS`, `EWR`, `SIN`)
- Given an `ai.inference` event, when written after `c.env.AI.run()` completes, then `blob7=colo` is populated similarly
- Given an event with no `CF-Ray` header (local dev), then `blob7=''` (not `null`, not `"unknown"`)
- `QestoEvent` type in `observability.ts` gains optional `colo?: string` mapped to `blob7`
- Existing 6-element `blobs` array becomes 7-element (backward-compatible; AE schema is schemaless)

**Data prerequisite:** None (new instrumentation).  
**Escalation:** Backend-dev must add `colo` field to `QestoEvent` and wire it at call sites in `SessionRoom.ts` and `ai.ts`.

---

### OBS-PLAN-TIERS-02 · 5 pts · P1

**Story:** As an analytics operator, I need enterprise sub-tier (`enterprise_standard` / `enterprise_plus`) surfaced in `blob4` so plan-segmented queries distinguish enterprise tiers.

**Acceptance Criteria:**
- `PlanTier` type in `types.ts` extended with `'enterprise_standard'` and `'enterprise_plus'`
- All `writeEvent()` call sites that resolve plan from D1/KV use the extended type
- Existing `'enterprise'` value is remapped on next billing event write (no backfill — historical data remains `'enterprise'`)
- AQL segment query returns 4 rows for plan: `free`, `pro`, `enterprise_standard`, `enterprise_plus`

**Data prerequisite:** Stripe plan IDs for enterprise tiers must exist in `wrangler.toml [vars]`.

---

### ANALYTICS-NS-DASH-01 · 8 pts · P1

**Story:** As a product owner / admin, I can query a `GET /api/admin/metrics/north-star` endpoint that returns sessions-per-active-team-per-month, segmented by plan, covering the trailing 12 months.

**Query used:**
```sql
SELECT
  toStartOfMonth(timestamp) AS month,
  blob4                     AS plan,
  COUNT(*)                  AS sessions_total,
  COUNT(DISTINCT blob3)     AS active_teams,
  ROUND(
    1.0 * COUNT(*) / NULLIF(COUNT(DISTINCT blob3), 0),
    2
  )                         AS sessions_per_active_team
FROM qesto_events
WHERE blob1 = 'session.started'
  AND timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY month, plan
ORDER BY month DESC, plan
```

**Acceptance Criteria:**
- `GET /api/admin/metrics/north-star?window=12m` returns JSON array: `[{month, plan, sessions_total, active_teams, sessions_per_active_team}]`
- Admin-only route (401 without admin JWT, 403 without admin role)
- No PII — returns only aggregate counts and anonymised team counts
- Zero-count months are included (filled with 0) for UI chart continuity
- Response cached in KV with TTL=3600s to avoid AQL hammering
- Anomaly flag: if `active_teams` drops >50% month-over-month, flag `anomaly: true` in response

**Data prerequisite:** `session.started` events in AE (✅ shipped OBS-01, S18).

---

### ANALYTICS-NS-DASH-02 · 8 pts · P1

**Story:** As a product admin, I can see a north-star chart on the admin dashboard showing sessions-per-active-team-per-month with plan-segmented overlay and 12-month trend line.

**Acceptance Criteria:**
- Admin dashboard `/dashboard/admin` gains a "North Star" tab
- Chart: line graph per plan (free/pro/enterprise), x=month, y=sessions_per_active_team
- Table below chart: raw numbers per month/plan
- Auto-refreshes every 15 minutes
- Zero-active-team months display as gap in chart (not 0 line) to avoid false troughs
- Mobile-responsive (breakpoints aligned to LAYOUT-GRID-01)

**Data prerequisite:** ANALYTICS-NS-DASH-01 endpoint live.

---

### ANALYTICS-FUNNEL-01 · 8 pts · P1

**Story:** As an analytics operator, I can run the activation funnel v2 with per-step absolute numbers + conversion rates, segmented by plan, with a known `userId`-stitching gap documented.

**Query used:**
```sql
-- Activation funnel v2 (30d, plan-segmented)
SELECT
  blob4                                                              AS plan,
  SUM(CASE WHEN blob1 = 'signup'                THEN 1 ELSE 0 END)  AS signups,
  SUM(CASE WHEN blob1 = 'team_created'          THEN 1 ELSE 0 END)  AS teams_created,
  SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END)  AS activated,
  SUM(CASE WHEN blob1 = 'first_paid'            THEN 1 ELSE 0 END)  AS converted,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'signup' THEN 1 ELSE 0 END), 0), 1
  ) AS activation_rate_pct,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'first_paid' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'signup' THEN 1 ELSE 0 END), 0), 1
  ) AS free_to_paid_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY plan
ORDER BY plan
```

**Acceptance Criteria:**
- Query runs against production AE with ≥30d data and returns non-zero counts for all four events
- If any event count is zero, flag as `⚠️ INSTRUMENTATION_GAP` and escalate to backend-dev
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_activation_funnel_v2.md` following output format
- Documented known gap: aggregate funnel only (not per-user stitched) — `userId` linkage prerequisite logged as `OBS-FUNNEL-STITCH-01` for future sprint

**Data prerequisite:** `signup`, `team_created`, `first_session_started`, `first_paid` all live in AE (✅ OBS-01, S18).

---

## Sprint 61 — Multi-Region Latency Segmentation

**Sprint window:** ~2027-06-29 → 2027-07-13  
**OBS+ANALYTICS budget:** 34 pts

### OBS-LATENCY-REGION-01 · 8 pts · P0

**Story:** As an analytics operator, I need `blob7=colo` on `ws.vote_submitted` and `ai.inference` events (from OBS-COLO-01) to produce per-region latency distribution in AQL.

**Note:** This story validates the S60 OBS-COLO-01 instrumentation has ≥30d data accumulation and writes the data quality report.

**Acceptance Criteria:**
- AQL completeness check: `SELECT COUNT(DISTINCT blob7), COUNT(*) FROM qesto_events WHERE blob1 = 'ws.vote_submitted' AND blob7 != '' AND timestamp > NOW() - INTERVAL '30' DAY` returns `COUNT(DISTINCT blob7) >= 8` (min 8 colos for global coverage)
- Zero-colo events rate < 5% (local/dev events expected; prod events must carry colo)
- Data quality report saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_colo_instrumentation_check.md`
- Red flag: if `COUNT(DISTINCT blob7) < 4`, escalate to backend-dev — CF-Ray header not forwarding into SessionRoom

**Data prerequisite:** OBS-COLO-01 live ≥30d.

---

### PERF-PROOF-02 · 5 pts · P0

**Story (SUB100MS_PROOF):** As a GTM engineer, I need AQL evidence that `ws.vote_submitted` p95 latency is < 100ms across every Cloudflare colo with ≥100 votes, so we can support the sub-100ms claim in enterprise sales.

**Query used:**
```sql
-- SUB100MS_PROOF: per-colo latency distribution (30d)
SELECT
  blob7                         AS colo,
  blob4                         AS plan,
  COUNT(*)                      AS vote_count,
  quantileExact(0.50)(double1)  AS p50_ms,
  quantileExact(0.95)(double1)  AS p95_ms,
  quantileExact(0.99)(double1)  AS p99_ms,
  SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) AS votes_over_100ms,
  ROUND(
    100.0 * SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) AS pct_over_100ms
FROM qesto_events
WHERE blob1   = 'ws.vote_submitted'
  AND blob7  != ''
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY colo, plan
HAVING vote_count >= 100
ORDER BY p95_ms DESC
```

**Acceptance Criteria:**
- At least 8 colos return ≥100 votes
- All qualifying colos show p95 < 100ms for `pro` and `enterprise` plans
- `free` plan p95 may exceed 100ms (capacity limits expected); documented separately
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_SUB100MS_PROOF.md` with GTM claim copy
- If any colo shows p95 ≥ 100ms for paid plans: flag as `⚠️ SLO_AT_RISK`, open backlog item for backend-dev investigation

**Data prerequisite:** OBS-COLO-01 + OBS-LATENCY-REGION-01 ≥30d data.

---

### ANALYTICS-LATENCY-AQL-01 · 8 pts · P1

**Story:** As an operations team, I can query a multi-region latency AQL report covering both vote submission and AI inference latency, segmented by colo and plan, on a 24h rolling window.

**Queries:**

```sql
-- Vote latency by colo (24h rolling)
SELECT blob7 AS colo, blob4 AS plan,
  quantileExact(0.95)(double1) AS p95_vote_ms,
  COUNT(*) AS votes
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY colo, plan ORDER BY p95_vote_ms DESC

-- AI inference latency by colo + model (24h rolling)
SELECT blob7 AS colo, blob6 AS model, blob4 AS plan,
  quantileExact(0.95)(double1) AS p95_ai_ms,
  COUNT(*) AS calls
FROM qesto_events
WHERE blob1 = 'ai.inference'
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY colo, model, plan ORDER BY p95_ai_ms DESC
```

**Acceptance Criteria:**
- Both queries return non-zero results in production
- `GET /api/admin/metrics/latency?region=all&window=24h` exposes JSON combining both views
- Anomaly: if any colo shows p95 vote latency ≥ 200ms, flag `region_slo_breach: true`
- Results archived to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_multiregion_latency.md` weekly

**Data prerequisite:** OBS-COLO-01 ≥30d.

---

### ANALYTICS-SLO-DEFINE-01 · 8 pts · P0

**Story:** As a product and engineering team, we have a formal SLO definition document with specific thresholds and error budget policies covering all critical platform operations.

**Acceptance Criteria:**
- Document `knowledge-base/operations/monitoring/analytics/SLO_DEFINITIONS.md` created with:
  - **SLO-VOTE-LATENCY**: p95 of `ws.vote_submitted.double1` < 100ms (pro/enterprise), < 300ms (free) over 30d rolling
  - **SLO-AI-LATENCY**: p95 of `ai.inference.double1` < 3000ms over 30d rolling
  - **SLO-WS-ERROR**: rate of `do.storage_fault` / `ws.vote_submitted` < 0.1% over 7d rolling
  - **SLO-API-ERROR**: rate of `error.api` events with `double1 >= 500` / total API calls < 0.5% over 24h rolling
  - **SLO-ACTIVATION**: `first_session_started` / `signup` ≥ 40% (30d trailing cohort)
  - Error budget per SLO: 30d × (1 - SLO target) expressed in minutes/event counts
- PO + Architect sign-off on all thresholds before ANALYTICS-SLO-ALERT-01 (S63) implements enforcement

**Data prerequisite:** PERF-PROOF-02 results inform the vote latency threshold.

---

### ANALYTICS-MULTIREGION-REPORT-01 · 5 pts · P1

**Story:** As an ops team, I receive a weekly automated latency report per region, filed to `knowledge-base/operations/monitoring/analytics/` with anomaly flags.

**Acceptance Criteria:**
- A Cloudflare Worker scheduled cron (`*/7 * * * MON`) runs ANALYTICS-LATENCY-AQL-01 queries and writes the markdown report
- Report format matches output format standard (query used → results table → interpretation → anomalies → recommendations)
- Anomaly: any colo p95 > SLO threshold (from ANALYTICS-SLO-DEFINE-01) is highlighted with `❌ SLO_BREACH`
- Report is also sent via `webhook.delivery_attempted` to an admin Slack channel (requires WEBHOOK-01 + SLACK-01)

**Data prerequisite:** ANALYTICS-LATENCY-AQL-01 + ANALYTICS-SLO-DEFINE-01.

---

## Sprint 62 — Partner Funnel Instrumentation

**Sprint window:** ~2027-07-13 → 2027-07-27  
**OBS+ANALYTICS budget:** 30 pts

### OBS-PARTNER-01 · 8 pts · P1

**Story:** As an analytics operator, I need `partner.referral` and `partner.signup_converted` AE events so I can measure the partner acquisition funnel end-to-end.

**New event types to add to `QestoEvent`:**
- `partner.referral` — emitted when a referral link is clicked; `detail=partner_id`, `sessionId=referral_code`, no `teamId` (pre-signup)
- `partner.signup_converted` — emitted alongside `signup` when referral code is valid; `detail=partner_id`, `userId=new_user_id`
- `partner.first_session_started` — emitted alongside `first_session_started` for partner-attributed users; `detail=partner_id`, `teamId`, `plan`

**Acceptance Criteria:**
- All three events added to `QestoEvent` union in `observability.ts`
- `partner.referral` fires in the referral link landing route (currently `GAM-04` territory)
- `partner.signup_converted` fires in `auth.ts` magic-link verify route when `referral_code` query param is valid
- `partner.first_session_started` fires alongside `first_session_started` in session lifecycle when team has a `referral_source` set
- No PII in any event (partner_id is an opaque partner tenant ID, not an email or name)
- Escalation: backend-dev to add `referral_source` field to `TEAMS_KV` schema so partner attribution persists after signup

**Data prerequisite:** GAM-04 referral link generation (Sprint 5 reference arc) must be live.

---

### OBS-PARTNER-CONV-01 · 5 pts · P1

**Story:** As an analytics operator, I need the `partner.signup_converted` and `partner.first_session_started` events confirmed firing with non-zero counts in AE within 7 days of OBS-PARTNER-01 ship.

**Acceptance Criteria:**
- Data quality check: `SELECT COUNT(*) FROM qesto_events WHERE blob1 IN ('partner.referral', 'partner.signup_converted', 'partner.first_session_started') AND timestamp > NOW() - INTERVAL '7' DAY`
- If any count = 0 after 7d: escalate to backend-dev with AE completeness report
- Zero-count report filed to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_partner_event_check.md`

**Data prerequisite:** OBS-PARTNER-01 live.

---

### ANALYTICS-PARTNER-FUNNEL-01 · 8 pts · P1

**Story:** As a partnerships team, I can query the partner acquisition funnel showing click-to-signup, signup-to-activation, and activation-to-paid conversion rates by partner_id.

**Query used:**
```sql
-- Partner funnel (30d, by partner)
SELECT
  blob6                                                                   AS partner_id,
  SUM(CASE WHEN blob1 = 'partner.referral'           THEN 1 ELSE 0 END)  AS clicks,
  SUM(CASE WHEN blob1 = 'partner.signup_converted'   THEN 1 ELSE 0 END)  AS signups,
  SUM(CASE WHEN blob1 = 'partner.first_session_started' THEN 1 ELSE 0 END) AS activated,
  SUM(CASE WHEN blob1 = 'first_paid'
        AND blob6 = blob6 THEN 1 ELSE 0 END)                              AS converted,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'partner.signup_converted' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'partner.referral' THEN 1 ELSE 0 END), 0),
    1
  ) AS click_to_signup_pct,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'partner.first_session_started' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'partner.signup_converted' THEN 1 ELSE 0 END), 0),
    1
  ) AS signup_to_activation_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
  AND blob1 IN ('partner.referral','partner.signup_converted','partner.first_session_started','first_paid')
GROUP BY partner_id
ORDER BY signups DESC
```

**Acceptance Criteria:**
- Query returns non-zero rows for at least one active partner
- Results segmented by plan where `partner.first_session_started` carries plan field
- Requires ≥30d data post OBS-PARTNER-01 (min 1 month accumulation)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_partner_funnel.md`
- Anomaly: any partner with click_to_signup_pct < 5% flagged as `⚠️ LOW_CONVERSION`

**Data prerequisite:** OBS-PARTNER-01 + OBS-PARTNER-CONV-01, ≥30d data.

---

### ANALYTICS-PARTNER-REPORT-01 · 8 pts · P1

**Story:** As a partnerships manager, I can view a partner metrics tab on the admin dashboard showing monthly referred signups, activation, conversion, and estimated revenue attribution per partner.

**Acceptance Criteria:**
- Admin dashboard `/dashboard/admin` gains a "Partners" tab (admin-only, 403 for non-admin)
- Table: partner_id | clicks (30d) | signups | activation_rate | paid_conversions | est_MRR_attributed
- MRR attribution = paid_conversions × plan_ARPU (read from `wrangler.toml [vars]`)
- Data sourced from `GET /api/admin/metrics/partners` endpoint backed by ANALYTICS-PARTNER-FUNNEL-01 query
- No raw partner email or personal data surfaced (partner_id is opaque)

**Data prerequisite:** ANALYTICS-PARTNER-FUNNEL-01 endpoint live.

---

## Sprint 63 — Scale Proof AQL + SLO Alerting

**Sprint window:** ~2027-07-27 → 2027-08-10  
**OBS+ANALYTICS budget:** 34 pts

### ANALYTICS-SCALE-AQL-01 · 8 pts · P1

**Story:** As a GTM engineer, I have a reproducible AQL evidence package proving Qesto's edge architecture can sustain enterprise-scale concurrent usage.

**Five scale proof queries:**

```sql
-- (1) Peak concurrent voter observation (approximation via ws.voter_joined density)
SELECT
  toStartOfHour(timestamp) AS hour,
  COUNT(DISTINCT blob2)    AS peak_concurrent_voters_proxy,
  COUNT(DISTINCT blob3)    AS active_sessions
FROM qesto_events
WHERE blob1 = 'ws.voter_joined'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY hour
ORDER BY peak_concurrent_voters_proxy DESC
LIMIT 10

-- (2) Capacity event rate (ws.capacity_exceeded per session)
SELECT
  blob4                                                               AS plan,
  COUNT(CASE WHEN blob1 = 'ws.capacity_exceeded' THEN 1 END)        AS capacity_hits,
  COUNT(CASE WHEN blob1 = 'ws.voter_joined'       THEN 1 END)       AS join_attempts,
  ROUND(
    100.0 * COUNT(CASE WHEN blob1 = 'ws.capacity_exceeded' THEN 1 END)
          / NULLIF(COUNT(CASE WHEN blob1 = 'ws.voter_joined' THEN 1 END), 0),
    2
  )                                                                   AS capacity_hit_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
  AND blob1 IN ('ws.capacity_exceeded', 'ws.voter_joined')
GROUP BY plan

-- (3) Vote throughput peak (votes per minute, highest observed)
SELECT
  toStartOfMinute(timestamp) AS minute,
  COUNT(*)                   AS votes_in_minute
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY minute
ORDER BY votes_in_minute DESC
LIMIT 5

-- (4) DO storage fault rate
SELECT
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'do.storage_fault' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'ws.vote_submitted' THEN 1 ELSE 0 END), 0),
    4
  ) AS storage_fault_rate_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY

-- (5) Reconnect ratio (proxy: ws.voter_joined duplicates on same sessionId)
SELECT
  blob3 AS sessionId,
  COUNT(*) AS join_events,
  COUNT(DISTINCT blob2) AS unique_voters,
  COUNT(*) - COUNT(DISTINCT blob2) AS reconnects
FROM qesto_events
WHERE blob1 = 'ws.voter_joined'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY sessionId
HAVING join_events > unique_voters
ORDER BY reconnects DESC
LIMIT 10
```

**Acceptance Criteria:**
- All 5 queries return non-zero results from production AE
- Evidence doc saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_scale_proof_aql.md`
- GTM claim matrix: capacity_hit_pct < 1% for enterprise plan; storage_fault_rate_pct < 0.01%; vote throughput peak documented
- Anomaly: if capacity_hit_pct > 5% for free plan, flag as `⚠️ UPSELL_SIGNAL` (capacity upgrade trigger per MKTG-003)

**Data prerequisite:** `ws.voter_joined`, `ws.capacity_exceeded`, `ws.vote_submitted`, `do.storage_fault` all ≥30d in AE (✅ S30+).

---

### OBS-SCALE-02 · 5 pts · P1

**Story:** As an analytics operator, I need `blob7=peak_concurrent` (integer snapshot) added to `session.closed` events so post-session capacity analytics are possible without joining on ws.voter_joined.

**New field:** `session.closed` events gain `detail = String(peak_concurrent_count)` (mapped to `blob6`).

**Acceptance Criteria:**
- `SessionRoom.ts` tracks a `peakConcurrent` counter incremented on each `ws.voter_joined` and snapshotted on `session.closed`
- Counter resets to 0 on DO initialization (no bleed across DO restarts)
- `session.closed` event writes `detail: String(peakConcurrent)` via `writeEvent()`
- Existing `session.closed` events (pre-OBS-SCALE-02) have `blob6=''`; queries use `CASE WHEN blob6 != '' THEN toInt32(blob6) ELSE NULL END`

**Escalation:** Backend-dev must modify `SessionRoom.ts` to track and emit peak concurrent counter.

---

### ANALYTICS-SLO-ALERT-01 · 13 pts · P0

**Story:** As an ops engineer, I can query `GET /api/admin/slo/status` to get current SLO burn rates for all defined SLOs, and receive webhook alerts when a SLO breaches its error budget.

**SLO burn-rate AQL queries:**

```sql
-- SLO-VOTE-LATENCY burn rate (rolling 30d)
SELECT
  blob4                                                             AS plan,
  ROUND(
    100.0 * SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
    3
  )                                                                 AS error_rate_pct,
  100.0 * (1 - 0.999)                                              AS budget_pct,
  CASE WHEN
    (100.0 * SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))
    > (100.0 * (1 - 0.999))
  THEN 'BREACHED' ELSE 'OK' END                                    AS status
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND blob4 IN ('pro', 'enterprise_standard', 'enterprise_plus')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY plan

-- SLO-API-ERROR burn rate (rolling 24h)
SELECT
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'error.api' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
    3
  ) AS error_rate_pct,
  0.5 AS budget_pct,
  CASE WHEN
    (100.0 * SUM(CASE WHEN blob1 = 'error.api' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))
    > 0.5
  THEN 'BREACHED' ELSE 'OK' END AS status
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '24' HOUR
```

**Acceptance Criteria:**
- `GET /api/admin/slo/status` returns `{slos: [{name, status, error_rate_pct, budget_pct, window_hours}]}`
- If any SLO `status = 'BREACHED'`, a `webhook.delivery_attempted` event fires to the configured admin webhook (requires WEBHOOK-01, S33)
- Alert includes: SLO name, breach severity (error_rate / budget), measurement window, affected plan(s)
- Webhook fires at most once per 30-minute window per SLO to prevent alert storms (KV dedup key)
- Endpoint is admin-only; responses are cached for 5 minutes

**Data prerequisite:** ANALYTICS-SLO-DEFINE-01 (SLO thresholds defined). WEBHOOK-01 (S33) for alert dispatch.

---

### ANALYTICS-SLO-DASH-01 · 8 pts · P1

**Story:** As an ops team, I can view an SLO burn-rate dashboard in the admin panel with traffic-light status, error budget remaining, and 7d/30d trend for each SLO.

**Acceptance Criteria:**
- Admin dashboard gains "SLO Health" tab with 4 cards (one per SLO from ANALYTICS-SLO-DEFINE-01)
- Each card: SLO name, current status (🟢 OK / 🟡 AT_RISK >50% budget consumed / 🔴 BREACHED), error budget remaining %, burn rate trend sparkline
- AT_RISK threshold: error_rate > 50% of error budget consumed within 7d (fast burn indicator)
- Trend sparkline: 14d daily error rate vs budget line
- Powered by `GET /api/admin/slo/status?trend=14d`

**Data prerequisite:** ANALYTICS-SLO-ALERT-01.

---

## Sprint 64 — Cohort Analytics + Churn Measurement

**Sprint window:** ~2027-08-10 → 2027-08-24  
**OBS+ANALYTICS budget:** 30 pts

### OBS-RETENTION-01 · 5 pts · P0

**Story:** As an analytics operator, I need a `team.churn_signal` AE event emitted weekly by a scheduled Worker so I can query churn directly from AE without a D1 join.

**New event:**
- `team.churn_signal` — emitted by scheduled Worker cron (`0 9 * * MON`) for each team with no `session.started` in 14 days
- `teamId=team_id`, `plan=current_plan`, `detail=days_since_last_session` (as string)
- If team has never had a session, event is not emitted (not a churn signal, it's an activation gap)

**Acceptance Criteria:**
- Worker cron queries D1: `SELECT team_id, plan FROM teams WHERE last_session_at < NOW() - 14 DAYS AND first_session_at IS NOT NULL`
- For each returned team, calls `writeEvent(ae, { name: 'team.churn_signal', teamId, plan, detail: daysStr })`
- Max 500 teams per cron run to avoid AE write rate limits; pagination with continuation token in KV
- Event appears in AE within 10 minutes of cron execution
- Escalation: backend-dev must add `last_session_at` and `first_session_at` columns to D1 `teams` table (or compute from `sessions` table)

**Data prerequisite:** D1 `teams` table with session timestamps.

---

### ANALYTICS-COHORT-01 · 8 pts · P1

**Story:** As a product owner, I can query weekly signup cohort retention showing session activity in weeks 1, 4, and 8 after signup, segmented by plan.

**Query approach (D1 + AE join, executed server-side):**
```sql
-- D1 side: get signup cohort
SELECT user_id, DATE_TRUNC('week', created_at) AS signup_week, plan
FROM users
WHERE created_at > CURRENT_DATE - INTERVAL '90' DAY

-- AE side (per cohort): count session.started events by user in week offsets
-- (executed as separate AQL queries per cohort week, joined in application layer)
SELECT blob2 AS userId, COUNT(*) AS sessions
FROM qesto_events
WHERE blob1 = 'session.started'
  AND timestamp BETWEEN :cohort_start AND :cohort_start + INTERVAL '7' DAY
GROUP BY userId
```

**Acceptance Criteria:**
- `GET /api/admin/metrics/cohorts?window=90d` returns cohort table: `[{signup_week, plan, cohort_size, w1_retained, w4_retained, w8_retained, w1_rate_pct, w4_rate_pct, w8_rate_pct}]`
- Cohort computation joins D1 userId with AE `session.started` blob2; documented as approximate (blob2 userId ≠ sessionId mapping gap)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_cohort_retention.md`
- Anomaly: if w4_retained < 20% for any plan, flag `⚠️ RETENTION_DROP`

**Data prerequisite:** `session.started` with userId in blob2 (requires `first_session_started` userId fix from ANALYTICS-FUNNEL-01 note).

---

### ANALYTICS-CHURN-01 · 8 pts · P1

**Story:** As a CRM/marketing operator, I can query a churn signal dashboard showing at-risk teams by plan and days-since-last-session, feeding re-engagement campaigns (MKTG-008).

**Query used:**
```sql
-- Churn signal dashboard (from team.churn_signal events)
SELECT
  blob4                               AS plan,
  CAST(blob6 AS INTEGER)              AS days_since_last_session,
  COUNT(DISTINCT blob3)               AS at_risk_teams
FROM qesto_events
WHERE blob1 = 'team.churn_signal'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY plan, days_since_last_session
ORDER BY plan, days_since_last_session
```

**Acceptance Criteria:**
- Dashboard `/dashboard/admin` "Churn" tab shows bar chart: at-risk teams by plan × days bucket (14-20, 21-30, 30+ days)
- Data sourced from `team.churn_signal` events (requires OBS-RETENTION-01)
- Export: `GET /api/admin/metrics/churn?format=csv` returns anonymized team IDs + plan + days for MKTG-008 re-engagement list (no PII — only opaque team IDs)
- Anomaly: if at-risk teams grow >20% week-over-week, auto-flag to SLO-ALERT webhook channel

**Data prerequisite:** OBS-RETENTION-01 live ≥2 weeks.

---

### ANALYTICS-LTV-01 · 8 pts · P1

**Story:** As a CFO / growth team, I can query LTV by signup cohort and plan from AE billing events.

**Query used:**
```sql
-- LTV proxy: cumulative billing value per cohort (from billing events)
SELECT
  toStartOfMonth(MIN_signup_ts) AS cohort_month,
  blob4                         AS plan,
  COUNT(DISTINCT blob3)         AS teams,
  SUM(double3)                  AS total_eur_billed,
  ROUND(SUM(double3) / NULLIF(COUNT(DISTINCT blob3), 0), 2) AS avg_ltv_eur
FROM (
  SELECT blob3, blob4, double3,
    MIN(timestamp) OVER (PARTITION BY blob3) AS MIN_signup_ts
  FROM qesto_events
  WHERE blob1 IN ('billing.plan_upgraded', 'billing.webhook_received')
    AND double3 > 0
    AND timestamp > NOW() - INTERVAL '12' MONTH
)
GROUP BY cohort_month, plan
ORDER BY cohort_month DESC, plan
```

**Acceptance Criteria:**
- Query returns non-zero `total_eur_billed` for paid plan cohorts
- Results include `billing.payment_failed` deduction note (failures logged but not deducted from LTV sum — AE doesn't support joins; document limitation)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_ltv_cohort.md`
- If `avg_ltv_eur` < €X (threshold from PO) for any cohort: flag `⚠️ LTV_BELOW_TARGET`

**Data prerequisite:** `billing.plan_upgraded` and `billing.webhook_received` events with `value` (EUR) in `double3` — requires OBS-01 billing events (S18).

---

## Sprint 65 — North-Star Dashboard v2 + AI Metrics

**Sprint window:** ~2027-08-24 → 2027-09-07  
**OBS+ANALYTICS budget:** 37 pts

### OBS-AI-QUALITY-01 · 5 pts · P1

**Story:** As an analytics operator, I need `ai.inference` events (wizard generation path) to carry an `acceptance_rate` blob so I can track whether AI suggestions are being accepted over time.

**New field:** `ai.inference` events from the wizard generation path gain `detail = acceptance_rate_pct` (e.g. `"72"` = 72% of generated questions accepted). Value is populated at `wizard.completed` event time and backfilled onto the preceding `ai.inference` event via a shared `traceId`.

**Acceptance Criteria:**
- `wizard.completed` event carries `detail=acceptance_rate_pct` (ratio of AI questions kept vs generated, ×100, integer string)
- `ai.inference` events from wizard path carry the same `traceId` as `wizard.completed`
- AQL query: `SELECT CAST(blob6 AS FLOAT) AS acceptance_rate FROM qesto_events WHERE blob1 = 'ai.inference' AND blob6 != '' ORDER BY timestamp DESC LIMIT 100` returns non-null values
- Escalation: wizard `acceptance_rate` already tracked in `S19-MEASURE-01`; backend-dev to wire it into `ai.inference` blob6

**Data prerequisite:** `ai.inference` events (✅ S18), wizard acceptance tracking (✅ S19).

---

### ANALYTICS-NS-DASH-03 · 8 pts · P1

**Story:** As a product owner, I can view an AI adoption overlay on the north-star chart showing % of sessions using AI-generated questions and % with sentiment analysis active.

**Query used:**
```sql
-- AI adoption overlay (monthly)
SELECT
  toStartOfMonth(timestamp) AS month,
  COUNT(DISTINCT CASE WHEN blob1 = 'session.started' THEN blob3 END)          AS total_sessions,
  COUNT(DISTINCT CASE WHEN blob1 = 'wizard.completed'
                       AND blob6 != '0' THEN blob3 END)                        AS ai_sessions,
  COUNT(DISTINCT CASE WHEN blob1 = 'ai.sentiment_analysis' THEN blob3 END)    AS sentiment_sessions,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN blob1 = 'wizard.completed'
                                 AND blob6 != '0' THEN blob3 END)
          / NULLIF(COUNT(DISTINCT CASE WHEN blob1 = 'session.started' THEN blob3 END), 0),
    1
  ) AS ai_adoption_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY month ORDER BY month DESC
```

**Acceptance Criteria:**
- ANALYTICS-NS-DASH-01 endpoint extended with `ai_adoption_pct` field per month
- Admin north-star chart gains a secondary axis showing AI adoption % trend
- `ai_adoption_pct` target: ≥50% (from WIZ-AI-01 KPI); flag `⚠️ AI_ADOPTION_BELOW_TARGET` if below

**Data prerequisite:** OBS-AI-QUALITY-01 + AI-SENTIMENT-01 (S34) ≥90d data.

---

### ANALYTICS-AI-BENCH-01 · 8 pts · P1

**Story:** As an AI/engineering team, I can run an AI inference quality benchmark report showing model distribution, retry patterns, and latency trends segmented by plan.

**Query used:**
```sql
-- AI inference benchmark (30d, by model + plan)
SELECT
  blob6                            AS model,
  blob4                            AS plan,
  COUNT(*)                         AS calls,
  AVG(double2)                     AS avg_retry_count,
  quantileExact(0.50)(double1)     AS p50_ms,
  quantileExact(0.95)(double1)     AS p95_ms,
  SUM(CASE WHEN double2 > 0 THEN 1 ELSE 0 END) AS calls_with_retry,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'error.ai_timeout' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
    2
  ) AS timeout_rate_pct
FROM qesto_events
WHERE blob1 IN ('ai.inference', 'error.ai_timeout')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY model, plan
ORDER BY calls DESC
```

**Acceptance Criteria:**
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_ai_benchmark.md`
- Anomaly: `avg_retry_count > 1.5` flags `⚠️ MODEL_DEGRADED` for affected model
- Anomaly: `p95_ms > 3000` for any paid plan flags `⚠️ AI_SLO_AT_RISK`
- Anomaly: `timeout_rate_pct > 2%` flags `⚠️ TIMEOUT_SPIKE` — escalate to backend-dev (RES-TIMEOUT-01 AbortController threshold review)

**Data prerequisite:** `ai.inference` with blob6=model ≥30d (✅ S18).

---

### ANALYTICS-SENTIMENT-TREND-01 · 8 pts · P1

**Story:** As a product owner, I can see a session sentiment trend report showing aggregate mood signal over time and by plan, requiring no individual attribution.

**Query used:**
```sql
-- Sentiment trend (weekly, plan-segmented, no individual attribution)
SELECT
  toStartOfWeek(timestamp)   AS week,
  blob4                      AS plan,
  COUNT(*)                   AS sentiment_events,
  AVG(double1)               AS avg_sentiment_score,
  SUM(CASE WHEN double1 > 0.6 THEN 1 ELSE 0 END)  AS positive_sessions,
  SUM(CASE WHEN double1 < 0.4 THEN 1 ELSE 0 END)  AS concerning_sessions
FROM qesto_events
WHERE blob1 = 'ai.sentiment_analysis'
  AND timestamp > NOW() - INTERVAL '90' DAY
GROUP BY week, plan
ORDER BY week DESC, plan
```

**Note:** `double1` in `ai.sentiment_analysis` carries the aggregate mood score (0=very negative, 1=very positive). This is a per-session aggregate, never per-participant. PII guard: do not surface `blob2` (sessionId) in reports.

**Acceptance Criteria:**
- Zero individual participant scores surfaced (aggregate only, k≥5 enforced per AI-SENTIMENT-01)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_sentiment_trend.md`
- Anomaly: if `avg_sentiment_score < 0.35` for ≥3 consecutive weeks for a plan, flag `⚠️ SENTIMENT_DROP` — recommend product review of that plan tier's session quality

**Data prerequisite:** AI-SENTIMENT-01 (S34) active ≥90d.

---

### ANALYTICS-FUNNEL-S65-01 · 8 pts · P1

**Story:** As a product owner, I can compare activation funnel snapshots quarterly to surface CRO deltas and validate improvement initiatives.

**Acceptance Criteria:**
- Funnel snapshot taken at S49 baseline, S60, and S65 (from `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_activation_funnel_v2.md` files)
- Comparison table: step → S49_rate → S60_rate → S65_rate → delta_pct
- Statistical note: conversion rate changes < 5 percentage points flagged as `WITHIN_NOISE` (small sample sizes on free plan)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_funnel_evolution.md`

**Data prerequisite:** ANALYTICS-FUNNEL-01 (S60) baseline + ≥2 quarterly snapshots.

---

## Sprint 66 — Integration Analytics Maturity

**Sprint window:** ~2027-09-07 → 2027-09-21  
**OBS+ANALYTICS budget:** 31 pts

### ANALYTICS-INTEGRATION-FUNNEL-01 · 8 pts · P1

**Story:** As a product manager, I can query the integration adoption funnel by integration type and plan.

**Query used:**
```sql
-- Integration adoption funnel (90d, by type + plan)
SELECT
  blob6                                                               AS integration_type,
  blob4                                                               AS plan,
  SUM(CASE WHEN blob1 = 'integration.connected'   THEN 1 ELSE 0 END) AS connections,
  SUM(CASE WHEN blob1 = 'export.initiated'        THEN 1 ELSE 0 END) AS export_initiations,
  SUM(CASE WHEN blob1 = 'export.completed'        THEN 1 ELSE 0 END) AS export_completions,
  ROUND(
    100.0 * SUM(CASE WHEN blob1 = 'export.completed' THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN blob1 = 'export.initiated' THEN 1 ELSE 0 END), 0),
    1
  ) AS export_completion_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '90' DAY
  AND blob1 IN ('integration.connected','export.initiated','export.completed')
GROUP BY integration_type, plan
ORDER BY connections DESC
```

**Acceptance Criteria:**
- Non-zero rows for at least 2 integration types (slack, teams, webhook) — requires OBS-INTEGRATION-01 (S33) ≥90d
- Anomaly: `export_completion_pct < 80%` flags `⚠️ EXPORT_FAILURE_RATE` — escalate to backend-dev
- Anomaly: zero `integration.connected` for a shipped integration type flags `⚠️ INTEGRATION_INSTRUMENTATION_GAP`
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_integration_funnel.md`

**Data prerequisite:** OBS-INTEGRATION-01 (S33) ≥90d data.

---

### OBS-EXPORT-01 · 5 pts · P1

**Story:** As an analytics operator, I need `export.pdf_completed` and `export.json_completed` distinguishable as separate event variants in AE so I can segment export analytics by format.

**Change:** `QestoEvent.name` union extended with `'export.pdf_completed'` and `'export.json_completed'`; existing `'export.completed'` call sites in PDF and JSON export routes updated to use the specific variants. `double1=durationMs`, `detail=file_size_kb` (as string).

**Escalation:** Backend-dev to update `EXPORT-PDF-01` and `EXPORT-RICH-01-A` routes to emit format-specific events.

---

### ANALYTICS-WEBHOOK-HEALTH-01 · 5 pts · P1

**Story:** As an ops team, I can query webhook delivery health showing success/retry/failure rates per plan.

**Query used:**
```sql
-- Webhook delivery health (7d)
SELECT
  blob4                                                               AS plan,
  SUM(CASE WHEN double2 = 0 THEN 1 ELSE 0 END)                      AS first_try_success,
  SUM(CASE WHEN double2 BETWEEN 1 AND 3 THEN 1 ELSE 0 END)          AS retried_success,
  SUM(CASE WHEN double2 > 3 THEN 1 ELSE 0 END)                      AS failed_after_retries,
  COUNT(*)                                                            AS total_deliveries,
  ROUND(
    100.0 * SUM(CASE WHEN double2 > 3 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 2
  )                                                                   AS failure_rate_pct
FROM qesto_events
WHERE blob1 = 'webhook.delivery_attempted'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY plan
```

**Acceptance Criteria:**
- `double2` in `webhook.delivery_attempted` = retry count (verify against OBS-01 schema — currently `double2=count`; if count ≠ retryCount, escalate to backend-dev for schema clarification)
- Anomaly: `failure_rate_pct > 10%` for any plan flags `⚠️ WEBHOOK_RELIABILITY` — review DO alarm retry logic

**Data prerequisite:** `webhook.delivery_attempted` events ≥7d (WEBHOOK-01, S33).

---

### ANALYTICS-EXPORT-ADOPTION-01 · 8 pts · P1

**Story:** As a product manager, I can see an export adoption report showing which formats are used by which plan tier and the correlation with retention.

**Acceptance Criteria:**
- `GET /api/admin/metrics/exports` returns per-format, per-plan export volume (monthly)
- Retention correlation: teams that exported ≥1 session in month N have session_frequency in month N+1 compared to non-exporting teams (requires ANALYTICS-COHORT-01 + D1 join)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_export_adoption.md`

**Data prerequisite:** OBS-EXPORT-01 + ANALYTICS-COHORT-01.

---

### ANALYTICS-INTEGRATION-RETENTION-01 · 5 pts · P1

**Story:** As a product manager, I can query whether teams with active integrations show higher session frequency than non-integrated teams.

**Query approach:** D1 `integrations` table (team_id, type, connected_at) joined with AE `session.started` count per team per month. Executed server-side, no PII surfaced.

**Acceptance Criteria:**
- Report compares `sessions_per_month` for integrated vs non-integrated teams, by plan
- Statistical caveat documented: causation vs correlation (enterprise teams are more active regardless of integration)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_integration_retention_correlation.md`
- If integrated teams show ≥20% higher session frequency: surface as GTM claim with caveat

**Data prerequisite:** ANALYTICS-INTEGRATION-FUNNEL-01 + ANALYTICS-COHORT-01.

---

## Sprint 67 — Enterprise Scale Evidence Package

**Sprint window:** ~2027-09-21 → 2027-10-05  
**OBS+ANALYTICS budget:** 31 pts

### ANALYTICS-SCALE-PROOF-02 · 13 pts · P1

**Story:** As a GTM engineer, I have a comprehensive scale proof evidence document combining 6 months of production AE data across all scale dimensions.

**Evidence document structure (`knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_scale_proof_v2.md`):**
1. Peak concurrent voters (from ANALYTICS-SCALE-AQL-01 query 1, 6-month window)
2. Vote throughput peaks (query 3, all-time top 10 minutes)
3. Multi-region p95 latency evidence (from PERF-PROOF-02, colo-segmented)
4. DO storage fault rate (query 4, 6-month)
5. Capacity event rate by plan (query 2, showing enterprise headroom)
6. GTM claim matrix with supporting AQL output inline

**Acceptance Criteria:**
- All 5 scale queries re-run with 6-month window (`INTERVAL '6' MONTH`) for stronger evidence base
- GTM claim: "Qesto sustains [N] concurrent voters per session with p95 < 100ms at the edge" — backed by actual peak observed + p95 data
- Document cross-referenced from `SCALE-PROOF-01` (S32) to show progression
- Reviewed and approved by PO before inclusion in enterprise sales materials

**Data prerequisite:** OBS-VOTE-01 + OBS-WS-VOTER-01 + OBS-COLO-01 ≥6 months combined.

---

### OBS-ENTERPRISE-01 · 5 pts · P1

**Story:** As an analytics operator, I need enterprise-specific lifecycle events in AE so I can monitor enterprise account health independently from free/pro metrics.

**New event types:**
- `enterprise.seat_added` — fired on team membership growth for enterprise teams; `teamId`, `plan=enterprise_*`, `count=1`
- `enterprise.sso_login` — fired in SAML auth route for enterprise teams; `teamId`, `plan`, `durationMs=saml_verify_ms`
- `enterprise.custom_role_assigned` — fired in RBAC role assignment; `teamId`, `plan`, `detail=role_id`

**Acceptance Criteria:**
- All three events added to `QestoEvent` union; wired in respective routes (auth/saml.ts, teams.ts, rbac.ts)
- Escalation: backend-dev to add call sites; analytics-agent to verify AE counts within 7d of ship
- Zero PII: `detail=role_id` is opaque ID, not role name with personal context

**Escalation:** Backend-dev must wire `enterprise.sso_login` in `functions/api/routes/auth/saml.ts`.

---

### ANALYTICS-ENT-HEALTH-01 · 8 pts · P1

**Story:** As an enterprise account manager, I can view a per-account health dashboard showing MAU, session frequency, SSO ratio, and audit event volume.

**Query used:**
```sql
-- Enterprise account health (last 30d)
SELECT
  blob3                                                                      AS teamId,
  COUNT(DISTINCT CASE WHEN blob1 = 'session.started' THEN blob2 END)        AS mau,
  COUNT(CASE WHEN blob1 = 'session.started' THEN 1 END)                     AS sessions_30d,
  COUNT(CASE WHEN blob1 = 'enterprise.sso_login' THEN 1 END)               AS sso_logins,
  COUNT(CASE WHEN blob1 = 'enterprise.custom_role_assigned' THEN 1 END)    AS role_assignments,
  COUNT(CASE WHEN blob1 = 'enterprise.seat_added' THEN 1 END)              AS seats_added
FROM qesto_events
WHERE blob4 IN ('enterprise_standard', 'enterprise_plus')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY teamId
ORDER BY sessions_30d DESC
```

**Acceptance Criteria:**
- `GET /api/admin/metrics/enterprise-health` returns table — admin only, no PII (teamId is opaque)
- Anomaly: enterprise teams with `sessions_30d = 0` flagged `⚠️ ENTERPRISE_CHURN_RISK`
- UI: admin dashboard "Enterprise" tab with sortable table + CSV export
- CSV export uses opaque teamIds only — no account manager name, no contract value in export

**Data prerequisite:** OBS-ENTERPRISE-01 ≥30d.

---

### ANALYTICS-LDAP-FUNNEL-01 · 5 pts · P1

**Story:** As a product manager, I can measure LDAP sync adoption through a funnel showing connected → first sync → first LDAP-authenticated session.

**Acceptance Criteria:**
- AQL query joining `ldap.connected`, `ldap.sync_completed`, `enterprise.sso_login` (where `detail=ldap`) events
- Requires `ldap.connected` and `ldap.sync_completed` events to be added to `QestoEvent` (escalate to backend-dev alongside LDAP-01 ship, S38)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_ldap_adoption.md`

**Data prerequisite:** LDAP-01 (S38) active ≥30d + LDAP AE events.

---

## Sprint 68 — Mobile + PWA Analytics

**Sprint window:** ~2027-10-05 → 2027-10-19  
**OBS+ANALYTICS budget:** 26 pts

### OBS-MOBILE-01 · 5 pts · P0

**Story:** As an analytics operator, I need device type context on `ws.vote_submitted` events so I can split vote analytics by mobile vs desktop.

**Change:** `ws.vote_submitted` gains `detail = device_type` where `device_type ∈ ['pwa', 'mobile_web', 'desktop', 'tablet']`, derived from `User-Agent` header in `SessionRoom.ts` WebSocket upgrade.

**Escalation:** Backend-dev to parse User-Agent in `SessionRoom.onConnect()` and attach device_type to subsequent `ws.vote_submitted` events via connection-level state.

---

### ANALYTICS-MOBILE-FUNNEL-01 · 8 pts · P1

**Story:** As a product manager, I can query mobile vs desktop vote completion rate and session join distribution.

**Query used:**
```sql
-- Mobile vs desktop funnel (30d)
SELECT
  blob6                                                     AS device_type,
  blob4                                                     AS plan,
  COUNT(*)                                                  AS votes,
  COUNT(DISTINCT blob3)                                     AS sessions,
  quantileExact(0.95)(double1)                              AS p95_vote_ms
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND blob6 IN ('pwa','mobile_web','desktop','tablet')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY device_type, plan
ORDER BY votes DESC
```

**Acceptance Criteria:**
- Non-zero votes for at least `mobile_web` and `desktop` device types
- Anomaly: if mobile_web p95 latency > 2× desktop p95 → flag `⚠️ MOBILE_LATENCY_GAP`
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_mobile_funnel.md`

**Data prerequisite:** OBS-MOBILE-01 ≥30d.

---

### ANALYTICS-PWA-RETENTION-01 · 8 pts · P1

**Story:** As a product manager, I can determine whether PWA-installed teams show higher session frequency than mobile-web teams.

**Acceptance Criteria:**
- Compare `sessions_per_team_per_month` for teams where majority of votes come from `device_type=pwa` vs `device_type=mobile_web`
- Requires ≥30d of OBS-MOBILE-01 data + ≥20 pwa-classified sessions for statistical minimum
- Documented statistical caveat: PWA-installing teams are likely more engaged regardless (selection bias)
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_pwa_retention.md`

**Data prerequisite:** OBS-MOBILE-01 ≥30d + MOBILE-01 (S37).

---

### ANALYTICS-OFFLINE-01 · 5 pts · P1

**Story:** As a product manager, I can measure PWA offline join cache reliability.

**New event:** `session.offline_cache_miss` — emitted in ServiceWorker when a participant attempts to join via PWA while offline and the session data is not in cache. `detail=session_age_minutes`.

**Acceptance Criteria:**
- `session.offline_cache_miss` added to `QestoEvent`; ServiceWorker emits event via beacon API on cache miss
- AQL: cache miss rate = `session.offline_cache_miss` count / `ws.voter_joined` count (pwa only) — target < 5%
- Escalation: frontend team to add beacon emission in ServiceWorker (`MOBILE-01`, S37)

**Data prerequisite:** MOBILE-01 (S37) ServiceWorker active ≥7d.

---

## Sprint 69 — Tournament + Gamification Analytics Depth

**Sprint window:** ~2027-10-19 → 2027-11-02  
**OBS+ANALYTICS budget:** 29 pts

### OBS-TOURNAMENT-01 · 5 pts · P1

**Story:** As an analytics operator, I need tournament lifecycle AE events so I can measure adoption and completion funnels.

**New events:**
- `tournament.started` — `teamId`, `plan`, `detail=tournament_type` (quick_finger/team_quiz/battle_royale/bracket), `count=participant_count`
- `tournament.round_completed` — `teamId`, `plan`, `detail=tournament_type`, `durationMs=round_duration_ms`
- `tournament.winner_declared` — `teamId`, `plan`, `detail=tournament_type`, `durationMs=total_duration_ms`

**Escalation:** Backend-dev to add call sites in `routes/tournaments.ts` and `SessionRoom.ts` tournament state machine.

**Data prerequisite:** GAM-05 (S39) tournament mechanics active ≥30d.

---

### ANALYTICS-TOURNAMENT-FUNNEL-01 · 8 pts · P1

**Story:** As a gamification PM, I can compare session engagement for tournament vs energizer vs standard sessions.

**Query used:**
```sql
-- Tournament vs energizer engagement comparison (30d)
SELECT
  CASE
    WHEN blob1 = 'tournament.started'    THEN 'tournament'
    WHEN blob1 = 'ws.energizer_activated' THEN 'energizer'
    WHEN blob1 = 'session.started'        THEN 'standard'
  END                                                    AS session_type,
  blob4                                                  AS plan,
  COUNT(DISTINCT blob3)                                  AS sessions,
  AVG(double2)                                           AS avg_participant_count
FROM qesto_events
WHERE blob1 IN ('tournament.started','ws.energizer_activated','session.started')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY session_type, plan
ORDER BY avg_participant_count DESC
```

**Acceptance Criteria:**
- Non-zero sessions for all three types (requires GAM-05 + LIVE energizers active ≥30d)
- Anomaly: if tournament completion rate (winner_declared/started) < 70%, flag `⚠️ TOURNAMENT_ABANDON_RATE`
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_tournament_funnel.md`

**Data prerequisite:** OBS-TOURNAMENT-01 ≥30d.

---

### ANALYTICS-GAM-DEPTH-01 · 8 pts · P1

**Story:** As a gamification PM, I can view a comprehensive gamification depth report covering badge earn rates, leaderboard participation, and time-to-completion by plan.

**Query used:**
```sql
-- Gamification depth (90d, by plan)
SELECT
  blob4                                                              AS plan,
  COUNT(CASE WHEN blob1 = 'tournament.winner_declared' THEN 1 END)  AS tournaments_completed,
  COUNT(CASE WHEN blob1 = 'ws.energizer_completed'     THEN 1 END)  AS energizers_completed,
  AVG(CASE WHEN blob1 = 'tournament.winner_declared'
           THEN double1 END)                                         AS avg_tournament_ms,
  COUNT(CASE WHEN blob1 = 'tournament.started' THEN 1 END)          AS tournaments_started,
  ROUND(
    100.0 * COUNT(CASE WHEN blob1 = 'tournament.winner_declared' THEN 1 END)
          / NULLIF(COUNT(CASE WHEN blob1 = 'tournament.started' THEN 1 END), 0),
    1
  )                                                                  AS tournament_completion_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '90' DAY
GROUP BY plan
```

**Acceptance Criteria:**
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_gamification_depth.md`
- Anomaly: `tournament_completion_pct < 60%` flags `⚠️ HIGH_ABANDON` — surface to GAM roadmap
- Feeds `GAM-06` (S35) dashboard with production data

**Data prerequisite:** OBS-TOURNAMENT-01 ≥90d.

---

### ANALYTICS-COACHING-FEEDBACK-01 · 8 pts · P1

**Story:** As a product manager, I can measure AI coaching adoption and whether coached sessions show improved subsequent session quality.

**Query used:**
```sql
-- AI coaching adoption (30d)
SELECT
  blob4                                                                      AS plan,
  COUNT(CASE WHEN blob1 = 'ai.coaching_suggestions_viewed' THEN 1 END)      AS coaching_views,
  COUNT(CASE WHEN blob1 = 'session.closed' THEN 1 END)                       AS sessions_closed,
  ROUND(
    100.0 * COUNT(CASE WHEN blob1 = 'ai.coaching_suggestions_viewed' THEN 1 END)
          / NULLIF(COUNT(CASE WHEN blob1 = 'session.closed' THEN 1 END), 0),
    1
  )                                                                           AS coaching_view_rate_pct
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY plan
```

**Acceptance Criteria:**
- `ai.coaching_suggestions_viewed` event added to `QestoEvent` by backend-dev (escalation)
- Anomaly: `coaching_view_rate_pct < 20%` flags `⚠️ COACHING_LOW_ADOPTION` — surface to AI roadmap
- Requires AI-COACHING-01 (S39) active ≥30d

**Data prerequisite:** AI-COACHING-01 (S39) + `ai.coaching_suggestions_viewed` AE event.

---

## Sprint 70 — North-Star v3 + Annual Business Review

**Sprint window:** ~2027-11-02 → 2027-11-16  
**OBS+ANALYTICS budget:** 39 pts

### ANALYTICS-NS-DASH-04 · 8 pts · P1

**Story:** As a product / exec team, I can view a unified north-star dashboard v3 showing all key product health metrics in one view with quarterly trend comparison.

**Combined AQL view:**
```sql
-- North-star v3 unified view (quarterly comparison)
SELECT
  toStartOfQuarter(timestamp) AS quarter,
  blob4                       AS plan,
  COUNT(*)                    AS sessions_total,
  COUNT(DISTINCT blob3)       AS active_teams,
  ROUND(1.0 * COUNT(*) / NULLIF(COUNT(DISTINCT blob3), 0), 2) AS sessions_per_team
FROM qesto_events
WHERE blob1 = 'session.started'
  AND timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY quarter, plan
ORDER BY quarter DESC, plan
```

**Acceptance Criteria:**
- Endpoint extended with `activation_rate_pct` (from ANALYTICS-FUNNEL-01), `ai_adoption_pct` (ANALYTICS-NS-DASH-03), `churn_signal_teams` (ANALYTICS-CHURN-01) per quarter
- Single admin dashboard card shows product health score: composite of sessions/team (40%), activation rate (30%), churn signal (30%)
- "Quarter over quarter" delta column for each metric
- Quarterly comparison chart: stacked bars per plan, 4 trailing quarters

**Data prerequisite:** ANALYTICS-NS-DASH-01 + ANALYTICS-NS-DASH-03 + ANALYTICS-CHURN-01 all live.

---

### ANALYTICS-ABR-01 · 13 pts · P0

**Story:** As a CFO / board, I can generate a single comprehensive annual business review AQL package covering all key product, growth, and operational metrics for the trailing 12 months.

**12 queries included in report:**
1. North-star metric: sessions/active-team/month by plan (12 months)
2. Activation funnel: signup → first_session_started → first_paid by cohort quarter
3. Free→paid conversion by signup cohort (from ANALYTICS-LTV-01)
4. LTV distribution: 25th/50th/75th percentile by plan cohort
5. Top 10 AE event types by volume (platform engagement heatmap)
6. Integration adoption: connected teams by type (12 months)
7. Integration→retention correlation delta (from ANALYTICS-INTEGRATION-RETENTION-01)
8. Enterprise health: active enterprise teams + avg sessions/month (from ANALYTICS-ENT-HEALTH-01)
9. AI adoption trend: AI-generated sessions % monthly (from ANALYTICS-NS-DASH-03)
10. Churn signal teams by plan per month (from ANALYTICS-CHURN-01)
11. SLO burn rates quarterly (from ANALYTICS-SLO-ALERT-01)
12. Scale proof: peak concurrent voters + vote throughput (from ANALYTICS-SCALE-PROOF-02)

**Acceptance Criteria:**
- Stored to `knowledge-base/operations/monitoring/analytics/YYYY-Q4_annual_business_review.md` following output format
- All queries include `-- Query N: <title>` comments and actual AQL text
- Each section includes anomaly flags and interpretation
- Zero PII — all team/user references use opaque IDs or aggregate counts only
- Document reviewed and signed off by PO before board distribution

**Data prerequisite:** All prior ANALYTICS-* stories from S60–S69 must have ≥30d data.

---

### ANALYTICS-SLO-ANNUAL-01 · 8 pts · P1

**Story:** As an SRE / VP Engineering, I can review a full-year SLO burn report showing error budget consumption per quarter and incident MTTR.

**Query used:**
```sql
-- SLO annual burn (vote latency SLO, by quarter)
SELECT
  toStartOfQuarter(timestamp) AS quarter,
  blob4                       AS plan,
  COUNT(*)                    AS total_votes,
  SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) AS slo_violations,
  ROUND(
    100.0 * SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    3
  ) AS error_rate_pct,
  0.1 AS budget_pct,
  ROUND(
    (100.0 * SUM(CASE WHEN double1 > 100 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))
    / 0.1,
    2
  ) AS budget_burn_multiplier
FROM qesto_events
WHERE blob1 = 'ws.vote_submitted'
  AND blob4 IN ('pro', 'enterprise_standard', 'enterprise_plus')
  AND timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY quarter, plan
ORDER BY quarter DESC, plan
```

**Acceptance Criteria:**
- All 4 SLOs reported: VOTE-LATENCY, AI-LATENCY, WS-ERROR, API-ERROR
- `budget_burn_multiplier > 1.0` highlights quarter as `⚠️ BUDGET_EXCEEDED`
- Results saved to `knowledge-base/operations/monitoring/analytics/YYYY-Q4_slo_annual_burn.md`

**Data prerequisite:** OBS-COLO-01 + ANALYTICS-SLO-DEFINE-01 ≥12 months.

---

### OBS-AUDIT-COMPLETENESS-01 · 5 pts · P0

**Story:** As an analytics operator, I run a weekly Monday instrumentation completeness audit (per analytics.md §Data Quality Checks) against all expected events from the S30–S70 arc.

**Completeness check AQL:**
```sql
-- Instrumentation completeness audit (7d)
SELECT blob1 AS event, COUNT(*) AS count_7d
FROM qesto_events
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob1 ORDER BY count_7d ASC
```

**Expected event set (must all have count > 0):**
`signup`, `team_created`, `first_session_started`, `first_paid`, `session.started`, `session.closed`, `ws.vote_submitted`, `ws.voter_joined`, `ws.capacity_exceeded`, `ai.inference`, `error.api`, `integration.connected`, `export.initiated`, `export.completed`, `webhook.delivery_attempted`, `ai.sentiment_analysis`, `gdpr.deletion_requested`, `tournament.started`, `partner.referral`, `enterprise.sso_login`

**Acceptance Criteria:**
- Any event with count = 0 in a 7-day window is flagged `❌ INSTRUMENTATION_GAP` and escalated to backend-dev
- Report saved to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_completeness_audit.md`
- Completeness score = (non-zero events / expected events) × 100%; target: 100%
- Run weekly every Monday per analytics.md §Data Quality Checks; cron-backed where possible

---

### ANALYTICS-GROWTH-MODEL-01 · 5 pts · P1

**Story:** As a growth team / investor relations, I can generate a monthly AARRR growth accounting report showing new, retained, resurrected, and churned teams by plan.

**Query approach:**
```sql
-- Growth accounting: new teams this month
SELECT 'new' AS status, blob4 AS plan, COUNT(DISTINCT blob3) AS teams
FROM qesto_events
WHERE blob1 = 'team_created'
  AND toStartOfMonth(timestamp) = toStartOfMonth(NOW())
GROUP BY plan

-- Retained: session.started in both current month and previous month (AQL UNION approach)
-- Resurrected: session.started in current month, NOT in previous 2 months but in month -3+
-- Churned: session.started in previous month, NOT in current month
-- (Executed as separate queries + joined in application layer)
```

**Acceptance Criteria:**
- `GET /api/admin/metrics/growth-accounting?month=YYYY-MM` returns AARRR breakdown per plan
- AARRR identity verified: `new + retained + resurrected = active` for each month
- Results stored monthly to `knowledge-base/operations/monitoring/analytics/YYYY-MM_growth_accounting.md`
- Feeds investor / GTM narrative: "MoM net team growth rate"

**Data prerequisite:** `team_created` + `session.started` events ≥3 months for resurrection calculation.

---

## Escalation Summary

Stories requiring backend-dev action before analytics work can proceed:

| Story | Backend-dev task | Escalation urgency |
|-------|-----------------|-------------------|
| OBS-COLO-01 | Add `colo` field to `QestoEvent`; wire CF-Ray header in `SessionRoom.ts` and AI wrapper | P1 — blocks SUB100MS_PROOF |
| OBS-PLAN-TIERS-02 | Extend `PlanTier` type with enterprise sub-tiers | P1 |
| OBS-PARTNER-01 | Add `partner.*` event types; wire call sites in referral + auth routes; add `referral_source` to TEAMS_KV | P1 — blocks partner funnel |
| OBS-RETENTION-01 | Add cron job; add `last_session_at` to D1 teams; wire `team.churn_signal` | P1 |
| OBS-ENTERPRISE-01 | Add `enterprise.*` event types; wire in saml.ts, teams.ts, rbac.ts | P1 |
| OBS-MOBILE-01 | Parse User-Agent in `SessionRoom.onConnect()`; attach device_type to vote events | P1 |
| OBS-TOURNAMENT-01 | Add `tournament.*` event types; wire in tournaments.ts and SessionRoom | P1 |
| ANALYTICS-COACHING-FEEDBACK-01 | Add `ai.coaching_suggestions_viewed` event; wire in AI coaching route | P1 |
| ANALYTICS-OFFLINE-01 | Add ServiceWorker beacon for `session.offline_cache_miss` | P2 |

---

## North-Star Trend Reporting Checklist (Weekly, Every Monday)

Per `analytics.md §Data Quality Checks` and this document:

- [ ] Run `OBS-AUDIT-COMPLETENESS-01` completeness check — all expected events non-zero
- [ ] Run north-star AQL (ANALYTICS-NS-DASH-01 query) — flag if `sessions_per_active_team` drops >10% week-over-week
- [ ] Run activation funnel (ANALYTICS-FUNNEL-01 query) — flag `activation_rate_pct` drops below 35%
- [ ] Check SLO status: run ANALYTICS-SLO-ALERT-01 queries — flag any `BREACHED` status
- [ ] Run churn signal check: `team.churn_signal` event volume — flag if at-risk teams > prior week by >20%
- [ ] Check data freshness: `MAX(timestamp)` within 30 minutes of current time
- [ ] Archive any new anomalies to `knowledge-base/operations/monitoring/analytics/YYYY-MM-DD_weekly_audit.md`

---

_Filed by: qesto-analytics agent_  
_Query protocol: all AQL queries are read-only against Analytics Engine. No D1 mutations. No PII surfaced._  
_Next review: before S60 sprint planning ceremony._
