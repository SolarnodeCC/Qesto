# Qesto Admin Pages & Observability Infrastructure Audit

**Date:** 2026-06-05  
**Scope:** Admin endpoints, event instrumentation (Analytics Engine), monitoring dashboards, and observability gaps for Phase 2 infrastructure  
**Audit Type:** Comprehensive infrastructure health monitoring review  

---

## EXECUTIVE SUMMARY

Qesto has a **mature admin platform with 13 documented endpoints** covering metrics, KPIs, ops summaries, audit trails, and engagement analytics. The observability foundation is built on:

- **Analytics Engine (AE)** for event streaming — 68 event types fully instrumented
- **KV metrics snapshots** for live aggregation (5-min windows)
- **D1 event history** for historical querying (sprint19_events, audit_events, metrics_summary tables)
- **Admin-only routes** secured with JWT + role middleware

**Critical Gap:** Infrastructure Phase 2 additions (AI Gateway caching, WAF rules, Queues DLQ, DO vote buffering, R2 snapshots) **have zero observability wired.** No dashboards exist for cache efficiency, queue failure rates, vote buffer depth, or recovery success metrics.

---

## 1. ADMIN ENDPOINTS INVENTORY

### 1.1 Metrics & Live Dashboard
| Endpoint | Purpose | Data Source | Refresh Rate |
|----------|---------|-------------|--------------|
| `GET /api/admin/metrics/live` | Real-time platform metrics (active sessions, participants, error rate, reconnects) | METRICS_KV (5-min rolling) | ~5 min |
| `GET /api/admin/metrics/historical` | Historical metrics by time range + optional route filter | D1 `metrics_summary` table | On-demand (up to 30-day range, 8641 limit) |
| `POST /api/admin/metrics/export` | CSV export of metrics for offline analysis | D1 `metrics_summary` | On-demand (max 10k rows) |

### 1.2 Platform KPIs & Operations
| Endpoint | Purpose | Data Source | Details |
|----------|---------|-------------|---------|
| `GET /api/admin/kpis` | Daily/monthly session counts, live sessions, AI cost estimate | D1 `sessions` + METRICS_KV live | Returns: `live_sessions`, `total_users`, `sessions_today`, `sessions_this_month`, `total_sessions`, `ai_cost_estimate_cents` |
| `GET /api/admin/ops/summary` | Infrastructure health snapshot (D1, KV, Workers AI, DO, WebSocket errors) | D1 `metrics_summary`, `incidents`, `audit_events` | Status: healthy/degraded/down; SLO violation counts (sev1/2/3); worst issues in 24h; optional 24h hourly correlation (energizer_activations vs ws_reconnects) |

### 1.3 Analytics & Engagement
| Endpoint | Purpose | Data Source | Metrics |
|----------|---------|-------------|---------|
| `GET /api/admin/analytics` | Comprehensive platform analytics (sessions, decisions, engagement) | D1 tables + METRICS_KV | sessions_today, sessions_this_month, consent_rate, energizer completions/dropouts, badge breakdown, ws_error_rate, reconnect_rate |
| `GET /api/admin/analytics/activation-funnel` | User acquisition & conversion funnel (30-day trailing) | D1 `users`, `sprint19_events` | signup → team_created → first_session_started → first_paid with conversion rates |
| `GET /api/admin/engagement/summary` | Per-energizer-kind metrics (quick-finger, team-quiz, word-cloud, etc.) | D1 `energizers`, `energizer_votes` | total, active, completed, participants per energizer type |
| `GET /api/admin/engagement/export.csv` | Engagement CSV dump (badges, leaderboard, energizers) | D1 gamification tables | CSV format with badge breakdown by type |

### 1.4 Performance & Sub-100ms Proof
| Endpoint | Purpose | Data Source | Target |
|----------|---------|-------------|--------|
| `GET /api/admin/perf/reporting` | Per-team session & live session counts | D1 `sessions` | Breakdown by status |
| `GET /api/admin/perf/sub100ms-proof` | Vote latency percentiles (p95/p99) last 7 days | D1 `sprint19_events` (ws.vote_submitted) | **Target:** p95 < 100ms; currently measured without geographic colo segmentation |
| `GET /api/admin/perf/latency-dashboard` | 24h latency buckets from metrics_summary | D1 `metrics_summary` | Hourly error rates, request counts |
| `GET /api/admin/sprint19-baseline` | AI wizard funnel metrics (wizard completion, launchpad success, suggestion acceptance) | D1 `sessions`, `sprint19_events` | Preflight failure rate, inline AI acceptance, launch failures |

### 1.5 Audit & Compliance
| Endpoint | Purpose | Data Source | Scope |
|----------|---------|-------------|-------|
| `GET /api/admin/audit` | Queryable audit log (by actor, action, subject_type, timestamp range) | D1 `audit_events` | Returns: ts, actor_id, action, subject_type, subject_id, before_json, after_json |
| `GET /api/admin/audit/forensic.csv` | Full audit trail CSV (unfiltered, up to 5000 rows) | D1 `audit_events` | Forensic export with before/after snapshots |

### 1.6 Help System Admin (Week 4)
| Endpoint | Purpose | Data Source | Operations |
|----------|---------|-------------|------------|
| `GET /api/admin/help/review-queue` | Flagged help documents pending review (downvotes > threshold) | D1 `help_documents_review_queue`, `help_documents` | Lists recent downvotes, review status |
| `POST /api/admin/help/prompt-versions` | Create new system prompt version | D1 `help_prompt_versions` | Content, topic, trigger_event, version numbering |
| `GET /api/admin/help/prompt-versions` | List all prompt versions | D1 `help_prompt_versions` | Sorted by version DESC, limit 50 |
| `GET /api/admin/help/prompt-versions/:id` | Fetch specific prompt version | D1 `help_prompt_versions` | Full content + metadata |
| `POST /api/admin/help/documents/dismiss-flag` | Mark review queue entry as resolved | D1 `help_documents_review_queue` | Records reviewed_at, reviewed_by, action taken |

### 1.7 User Management
| Endpoint | Purpose | Data Source | Operations |
|----------|---------|-------------|------------|
| `GET /api/admin/users` | List all users with search (email/display_name) | D1 `users`, `user_roles` | Paginated; returns email, plan, created_at, last_login_at, admin_role |
| `POST /api/admin/users` | Create new user + optionally assign admin role | D1 insert | Triggers audit event |
| `PATCH /api/admin/users/:id` | Update user plan, suspend, assign role | D1 update | Triggers audit event |

### 1.8 Knowledge Base Sync (Admin Key Auth)
| Endpoint | Purpose | Data Source | Operations |
|----------|---------|-------------|------------|
| `POST /api/admin/kb-sync` | Vectorize knowledge base documents into DECISIONS_VECTORIZE | D1 + DECISIONS_VECTORIZE | Uses `x-admin-key` header (not JWT); chunks docs, calls Workers AI embedding model |

---

## 2. EVENT INSTRUMENTATION (ANALYTICS ENGINE)

### 2.1 Complete Event Catalog (68 Event Types)

Qesto instruments **68 distinct event types** across the platform. All events are written via `writeEvent(ae, event)` to Cloudflare Analytics Engine.

#### Session Lifecycle (4 events)
- `session.started` — Session transitioned to LIVE status
- `session.closed` — Session transitioned to CLOSED status  
- `first_session_started` — User created + started first session (signup funnel)
- `session.joined_mobile` — (Proposed S68) Mobile participant join

#### User Acquisition (3 events)
- `signup` — User account created
- `team_created` — Team created by user
- `first_paid` — Team converted to paid plan

#### WebSocket Realtime (11 events)
- `ws.voter_joined` — Participant connected to session
- `ws.voter_disconnected` — Participant disconnected
- `ws.capacity_exceeded` — Max concurrent voters breached
- `ws.token_bucket_contention` — Rate limit window full
- `ws.vote_submitted` — Vote recorded (p95 latency tracked here)
- `ws.energizer_activated` — Energizer started via WebSocket
- `ws.energizer_activation_denied` — Energizer start rejected
- `ws.energizer_advanced` — Energizer state advanced (e.g., tournament round)
- `ws.energizer_advance_denied` — Advance rejected
- `ws.energizer_answered` — Participant submitted energizer response
- `ws.energizer_completed` — Energizer finished
- `ws.energizer_timeout` — Energizer auto-closed due to inactivity

#### Energizers & Gamification (2 events)
- `tournament.started` — Tournament energizer created
- `tournament.completed` — Tournament finished with winner

#### API & Rate Limiting (2 events)
- `api.request` — REST API request received (public API auth)
- `rate_limit.hit` — Public API quota exceeded

#### AI & Language Model (7 events)
- `ai.inference` — Workers AI model invoked (latency, model ID in blob6)
- `ai.cache_hit` — AI Gateway cache hit (includes cache age in seconds)
- `ai.cache_miss` — AI Gateway cache miss
- `ai.gateway_latency` — AI Gateway round-trip time (ms)
- `ai.sentiment_analysis` — Sentiment analysis on session responses
- `ai.sentiment_analysis_failed` — Sentiment analysis error
- `ai.sentiment_retry_exhausted` — Sentiment retries exhausted
- `ai.rate_limited` — Workers AI rate limit hit
- `error.ai_timeout` — AI inference timeout (>30s)

#### Insights & Coaching (3 events)
- `insight.aggregated` — Insights post-processing completed
- `coaching.suggestion_accepted` — User accepted AI suggestion
- `coaching.suggestion_dismissed` — User dismissed AI suggestion
- `coaching.export_emailed` — Coaching insights emailed to user

#### Integrations & Webhooks (8 events)
- `integration.connected` — Third-party integration (Slack, Teams, Zapier) linked
- `export.initiated` — Session data export started
- `export.completed` — Session data export finished
- `webhook.delivery_attempted` — Webhook delivery attempt sent
- `webhook.delivered` — Webhook delivery confirmed
- `webhook.failed` — Webhook delivery permanent failure
- `webhook.retried` — Webhook delivery retry

#### Admin & Compliance (6 events)
- `gdpr.deletion_requested` — GDPR data deletion initiated
- `gdpr.deletion_completed` — GDPR data deletion finished
- `compliance.pentest_started` — Penetration test initiated
- `compliance.pentest_resolved` — Pentest finding resolved
- `compliance.audit_prep` — SOC 2 audit evidence collected
- `compliance.soc2_type2_completed` — SOC 2 Type II audit complete

#### Knowledge Base & RAG (3 events)
- `kb_rag.query` — RAG query to knowledge base
- `kb_rag.result_returned` — RAG result delivered to client
- `kb_rag.similar_sessions` — Similar session RAG lookup

#### Wizard & Session Setup (4 events)
- `wizard.opened` — AI session wizard opened
- `wizard.completed` — AI session wizard completed
- `launchpad.opened` — Session launch interface opened
- `launchpad.launch_attempt` — User clicked "Start Session"
- `launchpad.launch_failed` — Session start failed (e.g., preflight)
- `launchpad.launch_success` — Session successfully launched
- `preflight.checked` — Preflight validation run
- `preflight.failed` — Preflight validation failure
- `ai.suggestions_resolved` — Inline AI suggestion acted upon (accepted/dismissed)

#### Multi-Region & Failover (2 events)
- `multi_region.write_routed` — Data write routed to secondary region
- `multi_region.failover_triggered` — Primary region failover activated

#### Durable Objects & Infrastructure (1 event)
- `do.storage_fault` — DO storage operation failed

#### Federation (2 events)
- `federation.link_created` — Cross-team federation link created
- `federation.consent_granted` — Federation consent granted

#### Partner Ecosystem (4 events)
- `partner.marketplace_viewed` — Partner marketplace accessed
- `partner.account_created` — Partner account created
- `partner.secret_rotated` — Partner API secret rotated
- `partner.payout_initiated` — Partner payout processed

#### Realtime Protocol Negotiation (1 event)
- `realtime.v2_negotiated` — WebSocket v2 protocol negotiated

---

### 2.2 Analytics Engine Schema (AE Blobs & Doubles)

All events conform to this schema:

```
blobs[0]   → event name (required)
blobs[1]   → userId | sessionId (optional)
blobs[2]   → teamId (optional)
blobs[3]   → plan tier (free/starter/team/enterprise) (optional)
blobs[4]   → traceId (optional)
blobs[5]   → detail (variable: model ID, integration type, export format, webhook_id, cache status, etc.) (optional)
blobs[6]   → (Reserved for future: colo tag, region, or additional metadata) (NOT YET WIRED)

doubles[0] → durationMs (optional)
doubles[1] → count (optional)
doubles[2] → value (EUR) (optional)
doubles[3] → cacheAge (seconds, for ai.cache_hit) (optional)
doubles[4] → gatewayMs (AI Gateway latency, for ai.gateway_latency) (optional)
```

**Event Location:** `/home/user/Qesto/functions/api/lib/observability.ts` (lines 101–220)

**Usage Pattern:**
```typescript
writeEvent(c.env.METRICS_AE, {
  name: 'session.started',
  sessionId: session.id,
  teamId: session.team_id,
  plan: c.get('plan'),
  traceId: c.get('trace_id'),
  durationMs: Date.now() - sessionCreatedAt
})
```

---

## 3. DASHBOARDS & ANALYTICS QUERIES

### 3.1 Existing Dashboards (Admin UI)

The `src/components/admin/` folder contains three React components:

#### AdminOpsTab.tsx
- Displays `GET /api/admin/ops/summary` results
- Shows service health (D1, KV, Workers AI, SessionRoom)
- Lists severity-1/2/3 incidents from past 24h
- WebSocket error rate + reconnect rate
- Top 10 error types

#### AdminAnalyticsTab.tsx
- Displays `GET /api/admin/analytics` results
- Sessions today/this month, consent rate
- Per-day session chart (14-day trailing)
- Session status breakdown (draft/live/closed/archived)
- Engagement: energizer activations, participants, completions, badge breakdown
- AI cost estimate

#### AdminUsersTab.tsx
- Displays `GET /api/admin/users` with search
- User list: email, plan, created_at, last_login_at, admin_role
- Create/patch user actions
- User suspension

### 3.2 AQL (Analytics Query Language) Queries — Known Capabilities

Based on the proposals doc (`2026-05-25_sprint60-70-obs-analytics-proposals.md`), the following AQL queries are **possible but not yet implemented in UI dashboards:**

#### Activation Funnel (30-day rolling)
```sql
SELECT
  toStartOfMonth(timestamp) AS month,
  blob4                     AS plan,
  SUM(CASE WHEN blob1 = 'signup'                THEN 1 ELSE 0 END) AS signups,
  SUM(CASE WHEN blob1 = 'team_created'          THEN 1 ELSE 0 END) AS teams_created,
  SUM(CASE WHEN blob1 = 'first_session_started' THEN 1 ELSE 0 END) AS activated,
  SUM(CASE WHEN blob1 = 'first_paid'            THEN 1 ELSE 0 END) AS converted
FROM qesto_events
GROUP BY month, plan
ORDER BY month DESC, plan
```

#### Sub-100ms Performance Proof (No colo segmentation yet)
```sql
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

#### North-Star Metric (Sessions per Active Team per Month)
```sql
SELECT
  toStartOfMonth(timestamp) AS month,
  blob4                     AS plan,
  COUNT(*)                  AS sessions_total,
  COUNT(DISTINCT blob3)     AS active_teams,
  ROUND(1.0 * COUNT(*) / NULLIF(COUNT(DISTINCT blob3), 0), 2) AS sessions_per_active_team
FROM qesto_events
WHERE blob1 = 'session.started'
  AND timestamp > NOW() - INTERVAL '12' MONTH
GROUP BY month, plan
ORDER BY month DESC, plan
```

---

## 4. MONITORING GAPS: PHASE 2 INFRASTRUCTURE

### 4.1 AI Gateway (Caching & Rate Limiting)

**Status:** ❌ **Zero observability wired**

**What's missing:**
1. **Cache efficiency dashboard** — No visibility into:
   - Cache hit/miss ratio by model (meta/llama, openai/gpt, anthropic/claude)
   - Cache age distribution (how fresh are cached responses?)
   - Cost savings from cache hits (inference cost avoided)
   
2. **Events shipping but dashboard missing:**
   - `ai.cache_hit` ✓ shipped, with `cacheAge` (seconds) in `double3`
   - `ai.cache_miss` ✓ shipped
   - `ai.gateway_latency` ✓ shipped, with `gatewayMs` in `double4`
   - `ai.inference` ✓ shipped, model ID in `blob6`

3. **Recommended AQL dashboard:**
   ```sql
   SELECT
     blob6                                        AS model_id,
     SUM(CASE WHEN blob1 = 'ai.cache_hit' THEN 1 ELSE 0 END) AS cache_hits,
     SUM(CASE WHEN blob1 = 'ai.cache_miss' THEN 1 ELSE 0 END) AS cache_misses,
     ROUND(
       100.0 * SUM(CASE WHEN blob1 = 'ai.cache_hit' THEN 1 ELSE 0 END)
       / NULLIF(SUM(CASE WHEN blob1 IN ('ai.cache_hit', 'ai.cache_miss') THEN 1 ELSE 0 END), 0),
       2
     ) AS hit_rate_pct,
     quantileExact(0.95)(double4) AS p95_gateway_latency_ms
   FROM qesto_events
   WHERE (blob1 = 'ai.cache_hit' OR blob1 = 'ai.cache_miss' OR blob1 = 'ai.gateway_latency')
     AND timestamp > NOW() - INTERVAL '7' DAY
   GROUP BY model_id
   ORDER BY cache_hits DESC
   ```

**Impact:** Without cache visibility, we cannot measure cost savings or detect cache misconfiguration (e.g., cache TTL too short, causing thrashing).

---

### 4.2 WAF (Web Application Firewall)

**Status:** ❌ **Zero observability wired**

**What's missing:**
1. **No WAF rule event instrumentation** — Cloudflare WAF rule matches are not logged to Analytics Engine
2. **No dashboards for:**
   - Rules triggered per day (DDoS vs SQL injection vs bot signatures)
   - False positive rate (legitimate traffic blocked)
   - Geographic origin of blocked requests
   - Which API endpoints are under attack

3. **Recommended action:**
   - Wire Cloudflare WAF events into custom event emitter on function entry
   - Capture: `cf.threat_score`, `cf.bot_score`, `cf.waf_matched_rules` (if available via headers)
   - Emit event: `waf.rule_triggered` with rule_id, threat_type, origin_country in blob6

**Impact:** Security blind spot. Cannot correlate attacks with application behavior or detect abuse patterns.

---

### 4.3 Queues (Async Task Processing) — Phase 2.1

**Status:** ❌ **Zero observability wired** (Feature not yet shipped as of 2026-06-05)

**What's missing:**
1. **DLQ (Dead Letter Queue) monitoring** — When tasks fail after max retries:
   - No event emitted to AE
   - No dashboard to query failed task types
   - No alerting on DLQ growth

2. **Queue depth & latency** — No visibility into:
   - Pending message count per queue (insights, webhooks, slack, teams)
   - Time-to-first-delivery (task enqueue → consumer start)
   - Time-to-completion (consumer start → ack)
   
3. **Recommended events (pre-ship checklist):**
   - `queue.message_enqueued` — Message added to queue (count, task_type)
   - `queue.message_consumed` — Consumer started processing (latency_to_start_ms)
   - `queue.message_acked` — Task completed (duration_ms, task_type)
   - `queue.message_failed` — Max retries exhausted → DLQ (error_code, task_type)
   - `queue.dlq_size` — Periodic snapshot of DLQ depth (count)

4. **Recommended dashboard (post-ship):**
   ```sql
   SELECT
     blob6                                        AS task_type,
     SUM(CASE WHEN blob1 = 'queue.message_enqueued' THEN 1 ELSE 0 END) AS enqueued,
     SUM(CASE WHEN blob1 = 'queue.message_acked' THEN 1 ELSE 0 END) AS completed,
     SUM(CASE WHEN blob1 = 'queue.message_failed' THEN 1 ELSE 0 END) AS failed,
     quantileExact(0.95)(double1) AS p95_completion_ms
   FROM qesto_events
   WHERE blob1 IN ('queue.message_enqueued', 'queue.message_acked', 'queue.message_failed')
     AND timestamp > NOW() - INTERVAL '1' DAY
   GROUP BY task_type
   ORDER BY failed DESC, enqueued DESC
   ```

**Impact:** High-severity gap. Queue failures (e.g., Slack notification deadlock, insight computation crash) will silently accumulate in DLQ with zero visibility.

---

### 4.4 Durable Objects (DO) Vote Buffering — Phase 2.2

**Status:** ⚠️ **Partial instrumentation** — Infrastructure feature not shipped; events designed but not wired

**Current state:**
- `do.storage_fault` event ✓ exists in observability.ts (line 148)
- `ws.vote_submitted` event ✓ shipped with latency tracking

**Missing:**
1. **Vote buffer depth monitoring** — No event for:
   - Current buffer queue depth (pending votes awaiting flush)
   - Flush frequency (how often buffer → KV happens)
   - Flush duration (time to persist batch)
   - Buffer overflow (votes dropped due to memory pressure)

2. **Recovery semantics** — When DO recovers from eviction:
   - No event: `do.recovery_started` / `do.recovery_completed`
   - No visibility into whether recovery from R2 snapshot succeeded
   - No correlation between snapshot freshness and vote loss

3. **Recommended new events (pre-ship):**
   - `do.vote_buffer_depth` — Periodic snapshot (count = pending votes)
   - `do.vote_buffer_flush` — Batch flush to KV (count, duration_ms)
   - `do.recovery_from_snapshot` — DO resumed from R2 (snapshot_age_seconds, votes_recovered)
   - `do.recovery_failed` — R2 snapshot corruption or unavailable

4. **Recommended dashboard (post-ship):**
   ```sql
   SELECT
     toStartOfInterval(timestamp, INTERVAL 1 MINUTE) AS minute,
     MAX(CAST(detail AS UInt32)) AS max_buffer_depth,  -- assumes detail = stringified count
     AVG(double1) AS avg_flush_duration_ms,
     COUNT(*) AS flush_count
   FROM qesto_events
   WHERE blob1 IN ('do.vote_buffer_depth', 'do.vote_buffer_flush')
     AND timestamp > NOW() - INTERVAL '1' HOUR
   GROUP BY minute
   ORDER BY minute DESC
   ```

**Impact:** Medium-severity gap. If buffer flushes fail silently or votes are lost during DO eviction, no alerting mechanism exists.

---

### 4.5 R2 Snapshots (DO Recovery) — Phase 2.3

**Status:** ❌ **Zero observability wired** (Feature not yet shipped)

**What's missing:**
1. **Snapshot freshness** — No dashboard for:
   - Last successful snapshot timestamp per session/DO
   - Snapshot age distribution (min/p50/p95 age)
   - Snapshots failing to upload to R2 (no error event)

2. **Recovery success rate** — After DO eviction + recovery:
   - No metric on whether R2 snapshot was readable
   - No count of votes recovered vs votes lost
   - No time-to-recovery metric

3. **Recommended events (pre-ship):**
   - `r2.snapshot_uploaded` — Snapshot written to R2 (size_bytes, session_id in blob2, duration_ms)
   - `r2.snapshot_read_on_recovery` — R2 snapshot fetched during recovery (snapshot_age_seconds, votes_in_snapshot in count)
   - `r2.snapshot_stale` — Snapshot older than threshold (e.g., >5 min)
   - `r2.snapshot_corrupted` — Snapshot unreadable on recovery

4. **Recommended dashboard (post-ship):**
   ```sql
   SELECT
     toStartOfInterval(timestamp, INTERVAL 5 MINUTE) AS five_min,
     COUNT(CASE WHEN blob1 = 'r2.snapshot_uploaded' THEN 1 ELSE 0 END) AS snapshots_written,
     COUNT(CASE WHEN blob1 = 'r2.snapshot_read_on_recovery' THEN 1 ELSE 0 END) AS recoveries,
     COUNT(CASE WHEN blob1 = 'r2.snapshot_stale' THEN 1 ELSE 0 END) AS stale_snapshots,
     COUNT(CASE WHEN blob1 = 'r2.snapshot_corrupted' THEN 1 ELSE 0 END) AS corrupted
   FROM qesto_events
   WHERE blob1 IN ('r2.snapshot_uploaded', 'r2.snapshot_read_on_recovery', 'r2.snapshot_stale', 'r2.snapshot_corrupted')
     AND timestamp > NOW() - INTERVAL '1' DAY
   GROUP BY five_min
   ORDER BY five_min DESC
   ```

**Impact:** High-severity gap. DO recovery is critical for vote durability; without observability, vote loss from failed snapshots is undetectable.

---

### 4.6 Realtime Observability Gaps (Existing, Not Phase 2)

**Partially instrumented but no dashboard:**

1. **Capacity headroom** — `ws.capacity_exceeded` events exist but:
   - No p95 max concurrent users per session
   - No forecasting for capacity constraints
   - No per-region load distribution

2. **Reconnect patterns** — `ws.voter_disconnected` exists but:
   - No root cause (network loss vs user leave vs timeout)
   - No correlation with error events

3. **Energy loss** — Energizer dropout rate calculated in admin analytics but:
   - No per-energizer-kind dropout rate (quick-finger vs word-cloud may have different abandonment)
   - No funnel: activated → answered → completed per energizer

---

## 5. MONITORING RECOMMENDATIONS

### 5.1 Phase 2 Infrastructure Dashboards (Post-Ship Checklist)

#### AI Gateway Cache Dashboard
- **Route:** `GET /api/admin/ai-gateway/cache-stats`
- **Refresh:** 1h (daily window)
- **Metrics:** Hit/miss ratio, avg cache age, model breakdown, cost savings estimate
- **Alert threshold:** Hit rate < 40% (cache misconfiguration)

#### WAF Activity Dashboard
- **Route:** `GET /api/admin/security/waf-events`
- **Refresh:** Real-time (5m bucket)
- **Metrics:** Rules triggered, threat_score distribution, blocked vs allowed, top-blocked IPs
- **Alert threshold:** >100 blocks/min or threat_score > 80 on legitimate endpoint

#### Queue Health Dashboard
- **Route:** `GET /api/admin/queues/health`
- **Refresh:** 1m
- **Metrics:** Pending per queue, DLQ depth, p95 completion time, failure rate by task_type
- **Alert threshold:** DLQ > 10 messages or completion time > 5min

#### DO Vote Buffer Dashboard
- **Route:** `GET /api/admin/do/vote-buffer`
- **Refresh:** 1m
- **Metrics:** Buffer depth, flush frequency, flush duration, recovery count, vote loss rate
- **Alert threshold:** Buffer depth > 1000 or flush duration > 2s

#### R2 Snapshot Freshness Dashboard
- **Route:** `GET /api/admin/r2/snapshot-health`
- **Refresh:** 5m
- **Metrics:** Snapshot age distribution (p50/p95), upload success rate, recovery success rate, stale snapshot count
- **Alert threshold:** Snapshot age > 10min or corrupted count > 0

---

### 5.2 Infrastructure Code Changes Required

#### 1. Add new event types to `functions/api/lib/observability.ts`

```typescript
export type QestoEvent = {
  name:
    // ... existing 68 events ...
    | 'ai_gateway.cache_hit'
    | 'ai_gateway.cache_miss'
    | 'ai_gateway.latency'
    | 'waf.rule_triggered'
    | 'queue.message_enqueued'
    | 'queue.message_acked'
    | 'queue.message_failed'
    | 'queue.dlq_size_snapshot'
    | 'do.vote_buffer_depth_snapshot'
    | 'do.vote_buffer_flush'
    | 'do.recovery_from_snapshot'
    | 'do.recovery_failed'
    | 'r2.snapshot_uploaded'
    | 'r2.snapshot_read_on_recovery'
    | 'r2.snapshot_corrupted'
    | 'ws.reconnect_pattern'
  // ... rest of QestoEvent type ...
}
```

#### 2. Wire events at infrastructure boundaries

- **AI Gateway:** `/functions/api/lib/ai/ai-gateway.ts` — emit cache_hit/miss/latency
- **WAF:** Custom middleware or worker entry point — capture CF headers, emit waf.rule_triggered
- **Queues:** Producer (`lib/queues/producer.ts`) + consumer (`worker/index.ts`) — emit enqueued/acked/failed
- **DO Buffer:** `functions/api/SessionRoom.ts` — emit buffer_depth/flush metrics
- **R2 Snapshot:** `functions/api/lib/session-room-recovery.ts` — emit upload/read/corrupt events

#### 3. Create admin endpoints for new dashboards

```typescript
// functions/api/routes/admin/ai-gateway-stats.ts
app.get('/ai-gateway/cache-stats', authMiddleware, adminMiddleware, async (c) => {
  // Query AE for ai.cache_hit, ai.cache_miss over trailing 24h
  // Compute hit_rate, avg_cache_age, cost savings, model breakdown
})

// functions/api/routes/admin/queue-health.ts
app.get('/queues/health', authMiddleware, adminMiddleware, async (c) => {
  // Query AE for queue.* events over trailing 1h
  // Compute DLQ depth, p95 completion, failure rate per task_type
})

// ... similar for WAF, DO buffer, R2 snapshot ...
```

---

### 5.3 Observability Maturity Roadmap

| Sprint | Component | Work | Priority |
|--------|-----------|------|----------|
| S60 | AI Gateway | Emit cache_hit/miss events; add dashboard | P1 (cost control) |
| S60 | WAF | Wire CF threat headers; emit waf.rule_triggered | P1 (security) |
| S61 | Queues (Phase 2.1) | Pre-ship: design queue.* events, emit from producer+consumer | P1 (data durability) |
| S61 | DO Buffer | Pre-ship: emit do.vote_buffer_* + do.recovery_* events | P1 (vote safety) |
| S62 | R2 Snapshots (Phase 2.3) | Pre-ship: emit r2.snapshot_* events, add recovery alerting | P1 (recovery SLO) |
| S63 | Dashboard consolidation | Merge all Phase 2 metrics into unified infra health view | P2 (observability UX) |
| S64 | Alerting rules | Define SLO breach thresholds, configure PagerDuty/Slack hooks | P2 (on-call) |

---

## 6. SUMMARY: OBSERVABILITY HEALTH SCORECARD

| Component | Coverage | Gap | Recommendation |
|-----------|----------|-----|-----------------|
| **Admin Endpoints** | 13 endpoints, well-designed | None — mature | Maintain current structure |
| **Event Instrumentation** | 68 event types, comprehensive | No Phase 2 events wired | Add 15+ new event types before Phase 2 ship |
| **Realtime Dashboards** | 3 React components (Ops, Analytics, Users) | Limited to D1/KV snapshots; no AQL yet | Build AQL dashboard layer for activation funnel, north-star |
| **AI Gateway** | Events exist (cache_hit, latency) | No dashboard; cache efficiency blind | Build cache stats dashboard + cost savings estimate |
| **WAF** | Not instrumented | Complete gap — no events, no dashboard | Wire CF threat headers; emit waf.rule_triggered |
| **Queues (Phase 2.1)** | Not shipped yet | Complete gap — no events designed | Design queue.* event schema before feature ship |
| **DO Vote Buffer (Phase 2.2)** | Partial (do.storage_fault exists) | Missing buffer depth, flush metrics, recovery events | Add 4 new event types (buffer_depth, flush, recovery_*) |
| **R2 Snapshots (Phase 2.3)** | Not shipped yet | Complete gap — no events, no recovery SLO | Design r2.snapshot_* events before feature ship |
| **Multi-Region** | Events exist (multi_region.*) | No dashboard, no failover metrics | Add regional latency dashboard segmented by CF colo |
| **Activation Funnel** | AQL query known, events shipped | No dashboard UI | Build `/api/admin/analytics/funnel-quarterly` dashboard |

**Overall Maturity:** ⭐⭐⭐⭐☆ (4/5)
- Strengths: 68 comprehensive event types, mature admin platform, D1 audit trail
- Weaknesses: Phase 2 infrastructure invisible, no AQL dashboards, WAF/multi-region blind spots

---

## 7. APPENDIX: File References

### Admin Routes
- `/home/user/Qesto/functions/api/routes/admin.ts` — Main mount point
- `/home/user/Qesto/functions/api/routes/admin/metrics.ts` — Live + historical metrics
- `/home/user/Qesto/functions/api/routes/admin/ops.ts` — Infrastructure health
- `/home/user/Qesto/functions/api/routes/admin/platform-routes.ts` — Platform KPIs + analytics
- `/home/user/Qesto/functions/api/routes/admin/users.ts` — User management
- `/home/user/Qesto/functions/api/routes/admin/audit.ts` — Audit log queries
- `/home/user/Qesto/functions/api/routes/admin/help.ts` — Help system admin
- `/home/user/Qesto/functions/api/routes/admin/journey-events.ts` — Sprint 19 wizard analytics
- `/home/user/Qesto/functions/api/routes/admin/kpis.ts` — Platform KPI snapshot
- `/home/user/Qesto/functions/api/routes/admin/platform/analytics.ts` — Engagement + analytics
- `/home/user/Qesto/functions/api/routes/admin/platform/perf.ts` — Performance proofs
- `/home/user/Qesto/functions/api/routes/admin/platform/engagement-analytics.ts` — Sprint 19 baseline

### Observability Core
- `/home/user/Qesto/functions/api/lib/observability.ts` — Event schema + writeEvent() function
- `/home/user/Qesto/functions/api/lib/audit.ts` — Audit event recording

### Admin UI Components
- `/home/user/Qesto/src/components/admin/AdminAnalyticsTab.tsx` — Analytics dashboard
- `/home/user/Qesto/src/components/admin/AdminOpsTab.tsx` — Ops/health dashboard
- `/home/user/Qesto/src/components/admin/AdminUsersTab.tsx` — User management UI

### Infrastructure References
- `/home/user/Qesto/docs/PHASE2-INFRASTRUCTURE.md` — Phase 2 feature specs (Queues, DO buffering, R2 snapshots)
- `/home/user/Qesto/knowledge-base/operations/monitoring/2026-05-25_sprint60-70-obs-analytics-proposals.md` — Analytics & observability roadmap (S60–S70)
- `/home/user/Qesto/knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md` — Phase 2 decision record
