---
id: SPRINT60_70_INFRA_PLAN
type: planning
domain: devops
category: planning
status: active
version: 1.0
created: 2026-05-25
updated: 2026-05-25
tags:
  - devops
  - infrastructure
  - multi-region
  - d1-sharding
  - slo
  - chaos
  - partner-env
  - staging-parity
relates_to:
  - ADR-0022
  - SPRINT30_39_PLAN
  - BACKLOG_MASTER
  - OPS_RUNBOOKS_V3
  - SUB100MS_PROOF
  - INFRA_SPRINT_CHECKLIST
---

# Sprint 60–70 Infrastructure Plan — Multi-Region Prod + D1 Sharding + SLO + Chaos + Partner Env

_Created: 2026-05-25 by DevOps. Horizon: S60–S70 (~2027-Q3 → 2028-Q1)._  
_Basis: ADR-0022 (multi-region read replica), SUB100MS_PROOF (≤100ms P95 vote target), OPS_RUNBOOKS_V3, INFRA_SPRINT_CHECKLIST (Sprint 20), SPRINT30_39_PLAN (through v2.4)._

---

## Context and Prerequisites

S30–S39 delivers v2.4 (SOC 2, white-label, mobile, Salesforce, LDAP, tournaments, AI coaching).  
S40–S59 are product-depth sprints (not covered here); by S60 the following are assumed complete:

| Gate | Evidence needed at S60 start |
|------|------------------------------|
| ADR-0022 Phase 1+2 | `resolveReadRegion()` in code; `/api/admin/health` has `multiRegion` field |
| ADR-0022 Phase 3 (write sharding ADR) | Accepted by architect by S51 (ADR-0023 or equivalent) |
| Staging environment | Fully provisioned per INFRA_SPRINT_CHECKLIST; all KV/D1/DO wired |
| CIRCUIT_BREAKER_KV + INTEGRATIONS_KV | Provisioned in prod (DEVOPS-CB-KV-01, Sprint 31 blocker) |
| `/api/admin/perf/sub100ms-proof` | Green (P95 ≤ 100ms sustained, per SUB100MS_PROOF) |
| COMMIT_SHA in CI | Actual git SHA injected at deploy time |

**Velocity assumption:** 120–150 pts/sprint = three parallel workstreams (infra, platform-eng, reliability) operating concurrently on independent concerns. Each workstream owns 40–50 pts per sprint; stories within a workstream are sequential; streams are independent unless a gate is noted.

---

## Release Map

| Release | Target window | Sprints | Theme |
|---------|---------------|---------|-------|
| v3.1-infra | S60–S62 | Multi-region EU live + SLO foundation + chaos v1 |
| v3.2-infra | S63–S65 | APAC replica + D1 write sharding + partner env v1 |
| v3.3-infra | S66–S68 | Partner scale + full SLO automation + staging parity |
| v3.4-infra | S69–S70 | Global deploy pipeline + chaos gate CI + infra hardening |

---

## Story Registry

Stories are grouped by domain. Each story has: ID, title, pts, priority, target sprint, acceptance criteria.

---

### Domain: MR — Multi-Region

#### DEVOPS-MR-01 (5 pts, P0, S60)
**Activate MULTI_REGION_ENABLED in prod and expand health probe**

AC:
- Given `MULTI_REGION_ENABLED=true` is added to `[vars]` in `wrangler.toml` (production), when the worker deploys, then `GET /api/admin/health` returns `{ ..., multiRegion: { enabled: true, primary: "us", replicas: ["eu"] } }`.
- Given a request from a US colo, when health is polled, then `readRegion: "us"` is present.
- No performance regression: health endpoint P95 latency ≤ 50ms after change.
- Staging parity: `[env.staging.vars]` also has `MULTI_REGION_ENABLED=true`.
- Deployment verified with `curl https://qesto.cc/api/admin/health | jq .multiRegion`.

#### DEVOPS-MR-02 (13 pts, P0, S60)
**EU D1 read replica binding and resolveReadRegion() routing**

AC:
- Given `DB_EU` binding added to `[[d1_databases]]` in `wrangler.toml` pointing to `qesto-db-eu` (Cloudflare D1 replica in `eu` region), when a request arrives from a EU colo (`cf.colo` in `["AMS","CDG","FRA","LHR","MAD","MXP"]`), then all read queries (`SELECT`) are routed to `DB_EU`.
- Write queries (`INSERT`, `UPDATE`, `DELETE`) always use `DB` (US primary); `DB_EU` is never written to.
- `resolveReadRegion(colo: string): 'us' | 'eu'` is exported from `lib/db/region.ts`; unit tests cover all EU colo codes and fall-through to `'us'`.
- `readRegion` field logged in `session.reads` AE event for every read path call.
- `tsc --noEmit` passes with new `DB_EU` binding in `Env` interface.

#### DEVOPS-MR-03 (8 pts, P0, S60)
**Multi-region canary rollout plan + `MULTI_REGION_REPLICA_PCT` var**

AC:
- `MULTI_REGION_REPLICA_PCT` wrangler var (0–100) gates EU routing: `0` = all reads to US, `100` = full EU routing by colo.
- Default in prod starts at `10` (10% of EU-colo traffic routes to EU replica); staged to `50` after 48h with no read-skew alerts; then `100`.
- Canary runbook documented in `knowledge-base/operations/deployment/MULTI_REGION_CANARY_RUNBOOK.md`.
- Rollback: set `MULTI_REGION_REPLICA_PCT=0` via `wrangler deploy --var MULTI_REGION_REPLICA_PCT:0` + redeploy; latency returns to baseline within 5 min.

#### DEVOPS-MR-04 (8 pts, P0, S60)
**Regional read path AE events**

AC:
- Every D1 read call emits `db.read` to `METRICS_AE` with fields: `colo_id`, `read_region` (`us`|`eu`), `durationMs`, `table_name`, `team_id`.
- P95 of `durationMs` per `read_region` queryable via AQL; baseline captured within 7 days of activation.
- Events do not include PII (no email, no session content).
- AE event emission adds ≤ 2ms P95 overhead (async, non-blocking).

#### DEVOPS-MR-05 (13 pts, P1, S63)
**APAC D1 read replica binding and colo routing extension**

AC:
- `DB_APAC` binding added pointing to `qesto-db-apac`.
- `resolveReadRegion()` extended: APAC colos (`["SIN","NRT","HND","ICN","BOM","SYD"]`) → `'apac'`.
- APAC routing gated by `MULTI_REGION_REPLICAS` var (`"eu,apac"` or `"eu"` for rollback).
- All existing EU tests still pass; new APAC tests added.
- `/api/admin/health` shows `replicas: ["eu", "apac"]` when both active.

#### DEVOPS-MR-06 (5 pts, P0, S60)
**EU read failover runbook**

AC:
- `knowledge-base/operations/MULTI_REGION_FAILOVER_RUNBOOK.md` created.
- Covers: detect EU replica degradation (AE `db.read` error spike), set `MULTI_REGION_REPLICAS=""` to disable EU reads, verify US-only fallback via health check, restore EU replica, re-enable.
- RTO documented: ≤ 5 min for full EU → US fallback (wrangler deploy + health verify).
- Added to OPS_RUNBOOKS_V3.md incident table as "Multi-region read skew" → this runbook.

#### DEVOPS-MR-07 (8 pts, P1, S61)
**Cross-region session consistency validation**

AC:
- Integration test: create session in US write path, read from EU replica; eventual consistency window measured (≤ 5s in normal operation).
- `GET /api/admin/multi-region/status` returns per-region last-seen write timestamp and estimated lag.
- Alert fires in AE (`multi_region.replica_lag`) when EU lag > 30s for >2 min.
- Test added to `tests/unit/db/multi-region-consistency.test.ts`.

#### DEVOPS-MR-08 (8 pts, P0, S61)
**`/api/admin/multi-region/status` endpoint**

AC:
- Endpoint returns `{ regions: { us: { status, lastWriteMs, readLatencyP95 }, eu: { ... } }, overallStatus }`.
- Backed by `METRICS_AE` AQL query over last 5 min of `db.read` events.
- Admin auth required (same gate as `/api/admin/health`).
- Referenced in OPS_RUNBOOKS_V3.md on-call checklist (step 2).

#### DEVOPS-MR-09 (13 pts, P0, S62)
**Write-path audit: enforce US-primary for all mutations**

AC:
- Static analysis script (`scripts/check-write-path.ts`) scans all route files for `DB_EU` or `DB_APAC` usage in `INSERT`/`UPDATE`/`DELETE` contexts and fails CI if found.
- 100% of mutation call sites in `functions/api/` use `DB` (US primary); confirmed by script.
- Added to `npm run check` suite; CI gate blocks any PR that routes writes to a replica.
- Exceptions (none at this time) require explicit architect sign-off and ADR amendment.

#### DEVOPS-MR-10 (8 pts, P1, S63)
**Multi-region read skew detection + alerting**

AC:
- `METRICS_AE` AQL query computes per-region read-error rate every 5 min.
- When EU error rate > 1% for 10 min, Slack alert fires to `#incidents`.
- AE event `multi_region.skew_detected` emitted with `region`, `errorRate`, `sampleCount`.
- Alert runbook link points to MULTI_REGION_FAILOVER_RUNBOOK.md.

---

### Domain: DB — D1 Sharding

#### DEVOPS-DB-01 (8 pts, P0, S60)
**D1 sharding binding schema design and wrangler.toml extension plan**

AC:
- `knowledge-base/adr/ADR-0023-d1-write-sharding.md` reviewed and accepted (architect gate; assumed done pre-S60 per sprint plan).
- `wrangler.toml` extension plan documented: `DB_SHARD_0`, `DB_SHARD_1` binding pattern; shard key = `team_id % num_shards`.
- `Env` interface draft updated in `functions/api/types.ts` (commented, behind flag); `tsc --noEmit` still passes.
- Implementation start gate: ADR accepted + architect sign-off.

#### DEVOPS-DB-02 (13 pts, P0, S61)
**D1 shard 0 + shard 1 bindings in wrangler.toml (prod + staging)**

AC:
- `[[d1_databases]]` entries for `DB_SHARD_0` (`qesto-db-shard-0`) and `DB_SHARD_1` (`qesto-db-shard-1`) added to prod and `[env.staging]` in `wrangler.toml`.
- Both databases provisioned via `wrangler d1 create`; schema applied via `wrangler d1 execute ... --file schema.sql`.
- `Env` interface updated; `tsc --noEmit` passes with both bindings.
- Shard 0 and Shard 1 IDs recorded in `knowledge-base/operations/INFRA_BINDINGS.md`.

#### DEVOPS-DB-03 (13 pts, P0, S61)
**Hash-based shard router service**

AC:
- `lib/db/shard-router.ts` exports `getShardBinding(teamId: string, env: Env): D1Database`.
- Routing: `murmur32(teamId) % numShards` → `DB_SHARD_0` | `DB_SHARD_1` (extensible to N shards).
- `numShards` read from `NUM_DB_SHARDS` wrangler var (default `2`).
- Unit tests in `tests/unit/db/shard-router.test.ts` cover: determinism, even distribution (1000 random team IDs, ≤55% skew), `NUM_DB_SHARDS=1` fallback to `DB`.
- All session + billing + audit routes that currently use `c.env.DB` migrated to `getShardBinding(teamId, env)`.

#### DEVOPS-DB-04 (8 pts, P0, S61)
**Shard health probes in `/api/admin/health`**

AC:
- Health endpoint expanded: `shards: { shard_0: "ok"|"error", shard_1: "ok"|"error", latencyMs: {...} }`.
- Each shard probe runs `SELECT 1` with 500ms timeout; failure logged as `db.shard_health_fail` AE event.
- Overall `d1` status in health response is `"degraded"` if any shard fails (not `"ok"` / not `"error"`).
- Added to on-call triage checklist in OPS_RUNBOOKS_V3.md.

#### DEVOPS-DB-05 (13 pts, P1, S63)
**Cross-shard admin aggregation queries**

AC:
- Admin routes that aggregate across all teams (`/api/admin/metrics`, `/api/admin/analytics`) fan out to all shard bindings and merge results in the Worker.
- `lib/db/cross-shard.ts` exports `queryCrossShardAll(sql, params, env)` returning merged `D1Result[]`.
- Latency: cross-shard aggregation P95 ≤ 500ms for queries on up to 2 shards.
- Unit tests mock both shard responses and verify correct merge/dedup.

#### DEVOPS-DB-06 (13 pts, P0, S65)
**Tenant-to-shard assignment and migration toolkit**

AC:
- `scripts/shard-assign.ts` computes and stores `team_id → shard_index` in `DB_SHARD_REGISTRY` KV namespace.
- Migration command: `wrangler d1 execute --file scripts/migrate-tenant.sql --var TEAM_ID=xxx --var FROM_SHARD=0 --var TO_SHARD=1` — copies rows, verifies checksum, then updates registry.
- Zero-downtime migration: tenant reads continue from old shard until registry swap; writes to new shard after registry swap.
- Rollback: registry swap is reversible within same deploy (set registry back).
- Documented in `knowledge-base/operations/D1_SHARD_MIGRATION_RUNBOOK.md`.

#### DEVOPS-DB-07 (8 pts, P1, S61)
**Per-shard R2 backup cron**

AC:
- Scheduled worker cron (`worker/index.ts`) extended: loops over `[DB_SHARD_0, DB_SHARD_1]`, exports each via `DB.dump()`, uploads to `qesto-backups/shard-0/backup-YYYY-MM-DD.json` and `shard-1/...`.
- Backup runs daily at 02:30 UTC (offset from main backup at 02:00).
- Missing backup after 26h triggers `backup.shard_missed` AE event; on-call Slack alert.
- Verified: `wrangler r2 object list qesto-backups --prefix shard-0/ | tail -5`.

#### DEVOPS-DB-08 (8 pts, P1, S63)
**Per-shard AE events and SLO dashboard entry**

AC:
- All D1 queries emit `db.query` AE event with `shard_index`, `table_name`, `durationMs`, `team_id`.
- SLO dashboard shows P95 latency per shard (must be ≤ 50ms per-shard P95).
- Alert fires when any shard P95 > 100ms for 5 min.
- Replaces existing undifferentiated `db.read` event; backward-compatible (old AQL queries still work).

#### DEVOPS-DB-09 (13 pts, P1, S64)
**Shard 2 (APAC) binding + routing extension**

AC:
- `DB_SHARD_2` added to `wrangler.toml` pointing to `qesto-db-shard-2` (APAC region hint).
- `NUM_DB_SHARDS=3`; shard router extended with no behavior change for existing teams (deterministic hash).
- Shard 2 provisioned with full schema; backup cron extended.
- Health probe covers shard 2; admin aggregation fan-out extended.

#### DEVOPS-DB-10 (8 pts, P1, S61)
**D1 shard forward-fix protocol**

AC:
- `knowledge-base/operations/D1_SHARD_FORWARD_FIX_PROTOCOL.md` created.
- Covers: schema migration across shards (run on each shard sequentially), partial failure recovery (idempotent migrations via `migrations_dir`), and how to add a new shard without downtime.
- Schema migrations applied to shards before code deploy (never after); enforced by CI deploy script ordering.

---

### Domain: SLO — SLO Dashboards

#### DEVOPS-SLO-01 (8 pts, P0, S60)
**SLO dashboard v1: vote latency P50/P95/P99 from AE**

AC:
- AQL query file `knowledge-base/operations/monitoring/SLO_LATENCY_AQL.md` defines P50/P95/P99 from `ws.vote_submitted` events over rolling 24h window.
- Admin page `/api/admin/slo/vote-latency` returns `{ p50, p95, p99, windowH: 24, meetsTarget: boolean }` where `meetsTarget = p95 <= 100`.
- `meetsTarget: false` triggers AE event `slo.budget_burn` with `slo_id: "vote_latency_p95"`.
- Unit tests mock AE response; integration test verifies JSON shape.

#### DEVOPS-SLO-02 (8 pts, P0, S60)
**API availability SLO + 28-day error budget**

AC:
- SLO: 99.9% API availability = ≤ 43.2 min downtime/28 days.
- Error budget computed from `error.api` AE events (5xx count / total request count over 28 days).
- `/api/admin/slo/availability` returns `{ budget28dMin: 43.2, consumedMin: N, remainingPct: X, status: "healthy"|"at_risk"|"breached" }`.
- "At risk" threshold: >60% of budget consumed. "Breached": >100%.

#### DEVOPS-SLO-03 (5 pts, P1, S60)
**D1 query latency SLO**

AC:
- SLO target: D1 query P95 ≤ 50ms.
- Derived from `db.query` AE events (or `db.read` until DEVOPS-DB-08 lands).
- `/api/admin/slo/d1-latency` returns `{ p95ms, target: 50, shard_breakdown: {...} }`.

#### DEVOPS-SLO-04 (5 pts, P1, S60)
**WebSocket connect latency SLO**

AC:
- SLO target: DO WebSocket connect P95 ≤ 200ms (from `ws.voter_joined` AE event `durationMs`).
- `/api/admin/slo/ws-connect` returns `{ p95ms, target: 200, meetsTarget: boolean }`.

#### DEVOPS-SLO-05 (8 pts, P0, S61)
**SLO alerting: Slack notification when error budget ≥80% consumed**

AC:
- Scheduled worker (every 15 min) checks all SLO endpoints; if any `remainingPct < 20` → posts to Slack `#incidents` with SLO name, remaining budget, and runbook link.
- Alert is idempotent: once per SLO per 4h (no spam flooding).
- `slo.budget_alert` AE event emitted with `slo_id`, `remainingPct`, `alertedAt`.
- Slack webhook URL stored as `SLACK_OPS_WEBHOOK` secret (never in `wrangler.toml`).

#### DEVOPS-SLO-06 (8 pts, P1, S62)
**Per-region SLO breakdown (EU vs US vs APAC)**

AC:
- All SLO endpoints accept `?region=us|eu|apac` query param; default = aggregate.
- Per-region P95 vote latency target: US ≤ 80ms, EU ≤ 120ms, APAC ≤ 150ms (higher RTT budget for APAC).
- Dashboard shows regional SLO health side-by-side.

#### DEVOPS-SLO-07 (8 pts, P1, S62)
**SLO v2: composite multi-service SLO**

AC:
- Composite SLO: all of D1 P95 ≤ 50ms + KV P95 ≤ 20ms + DO connect P95 ≤ 200ms + vote latency P95 ≤ 100ms must be green simultaneously.
- `/api/admin/slo/composite` returns `{ services: { d1, kv, do, vote }, compositeStatus: "healthy"|"degraded"|"breached" }`.
- Composite SLO breach triggers P1 alert (not just P2).

#### DEVOPS-SLO-08 (5 pts, P0, S61)
**SLO burn rate alerts (1h and 6h windows)**

AC:
- Burn rate = rate of error budget consumption; 1h burn rate > 14.4× or 6h burn rate > 6× triggers fast-burn alert.
- Based on Google SRE workbook multi-window alerting formula applied to `error.api` events.
- Alert fires to Slack `#incidents`; different severity than slow-burn (60% consumed) alert.
- `slo.burn_rate_alert` AE event with `window`, `burnRate`, `threshold`.

#### DEVOPS-SLO-09 (8 pts, P1, S60)
**SLO documentation and on-call response thresholds**

AC:
- `knowledge-base/operations/SLO_DEFINITIONS.md` created; lists all SLOs, targets, measurement method, and response action per severity.
- Added to OPS_RUNBOOKS_V3.md "On-call checklist" as step 2 (replace current latency-dashboard reference).
- Each SLO has: target, measurement window, alerting threshold, responsible team, max response time.

#### DEVOPS-SLO-10 (5 pts, P2, S63)
**Monthly SLO report automation**

AC:
- Cron (`0 9 1 * *`) generates SLO report: each SLO availability%, budget consumed, incidents triggered.
- Report posted to Slack `#ops-reports` as a formatted message.
- Report stored as `qesto-logs/slo-reports/YYYY-MM.json` in R2.

---

### Domain: STG — Staging Parity

#### DEVOPS-STG-01 (5 pts, P0, S60)
**Staging multi-region flag and EU binding parity**

AC:
- `[env.staging.vars]` already has `MULTI_REGION_ENABLED = "true"` (from INFRA_SPRINT_CHECKLIST); verify `DB_EU` binding also added to `[[env.staging.d1_databases]]` pointing to `qesto-db-eu-staging`.
- Staging EU replica provisioned: `wrangler d1 create qesto-db-eu-staging --remote`.
- Schema applied; `resolveReadRegion()` tested against staging EU colo.

#### DEVOPS-STG-02 (8 pts, P0, S61)
**Staging D1 shard bindings (2 shards)**

AC:
- `DB_SHARD_0` and `DB_SHARD_1` added to `[[env.staging.d1_databases]]`.
- Both staging shards provisioned with schema; shard router tested in staging.
- `wrangler deploy --env staging --dry-run` passes.

#### DEVOPS-STG-03 (8 pts, P1, S63)
**Staging partner namespace isolation**

AC:
- `PARTNER_SESSIONS_KV_STAGING` and `PARTNER_TEAMS_KV_STAGING` KV namespaces provisioned.
- Added to `[[env.staging.kv_namespaces]]` with correct IDs.
- Partner routing middleware testable in staging without affecting prod data.

#### DEVOPS-STG-04 (8 pts, P1, S62)
**Staging chaos injection flag support**

AC:
- `[env.staging.vars]` gains chaos flags: `CHAOS_D1_LATENCY_MS = "0"`, `CHAOS_KV_FAIL_RATE = "0"`, `CHAOS_AI_LATENCY_MS = "0"`.
- Chaos middleware in `lib/chaos/inject.ts` reads these vars and injects synthetic failures when non-zero.
- Staging-only: production `[vars]` never has these; CI gate (`check:chaos-vars`) blocks chaos flags in non-staging envs.
- Operator can activate: `wrangler pages secret put CHAOS_D1_LATENCY_MS --env staging` with value `"200"`.

#### DEVOPS-STG-05 (5 pts, P0, S60)
**wrangler.toml staging/prod config drift CI gate**

AC:
- `scripts/check-wrangler-parity.ts` compares required binding types (d1_databases, kv_namespaces, durable_objects, ai, vectorize, workflows) between `[default]` and `[env.staging]`.
- CI fails if a binding present in prod is absent in staging (except `PARTNER_*` prod-only bindings which are explicitly allowed).
- Added to `npm run check` suite.

#### DEVOPS-STG-06 (8 pts, P1, S62)
**Automated staging → prod promotion pipeline**

AC:
- GitHub Actions workflow `promote-staging-to-prod.yml`: runs full test suite on staging, runs smoke test against `staging.qesto.cc/api/admin/health`, then deploys to prod.
- Promotion requires manual approval gate (GitHub environment protection rule on `production`).
- Deploys staging commit SHA to prod; sets `COMMIT_SHA` correctly.
- Rollback: re-trigger with previous commit SHA.

#### DEVOPS-STG-07 (13 pts, P1, S63)
**Staging full multi-region parity (EU + US replicas)**

AC:
- Staging mirrors full prod multi-region topology: `DB` (US), `DB_EU` (EU), `DB_SHARD_0`, `DB_SHARD_1`.
- Staging `MULTI_REGION_REPLICA_PCT = "100"` (full routing, since it's staging).
- All multi-region integration tests run against staging environment.
- `wrangler deploy --env staging --dry-run` passes with all bindings.

#### DEVOPS-STG-08 (5 pts, P2, S64)
**Staging seed data pipeline**

AC:
- `scripts/seed-staging.ts` generates anonymized test data: 10 teams, 3 users each, 5 sessions each, 100 votes each.
- All PII replaced with faker data; session content is clearly synthetic.
- Seed idempotent: re-running deletes old seed data first (tagged with `seed: true` in D1).
- Runnable via `wrangler d1 execute <db> --remote --file scripts/seed-staging.sql`.

#### DEVOPS-STG-09 (8 pts, P1, S64)
**Staging SLO dashboard**

AC:
- All SLO endpoints work against staging (`staging.qesto.cc/api/admin/slo/*`).
- Staging uses same AQL queries against shared `qesto_metrics` AE dataset (filtered by `ENV=staging`).
- Staging SLOs intentionally have relaxed targets (2× latency budget) to avoid false alarms.

---

### Domain: CHX — Chaos Engineering

#### DEVOPS-CHX-01 (13 pts, P0, S62)
**Chaos library v1: D1 latency injection**

AC:
- `lib/chaos/inject.ts` exports `withChaosD1(binding: D1Database, env: Env): D1Database` — wraps binding and adds `CHAOS_D1_LATENCY_MS` synthetic sleep before each query.
- Staging-only: wrapper is a no-op when `ENV !== "staging"`.
- Tests in `tests/unit/chaos/inject.test.ts` verify wrapper injects delay and passthrough in non-staging.
- All shard bindings and `DB_EU` wrapped consistently.

#### DEVOPS-CHX-02 (8 pts, P1, S62)
**Chaos drill: KV timeout simulation**

AC:
- `withChaosKV(binding: KVNamespace, env: Env)` wrapper adds `CHAOS_KV_FAIL_RATE` (0.0–1.0) random rejection.
- Chaos KV wrapper applied to `SESSIONS_KV`, `USERS_KV`, `TEAMS_KV` in staging.
- Circuit breaker catches KV failures; `cb.kv_open` AE event emitted.
- Drill procedure: set `CHAOS_KV_FAIL_RATE=0.3` in staging; run 100 API calls; verify circuit breaker opens and degrades gracefully; verify AE events captured.

#### DEVOPS-CHX-03 (8 pts, P1, S62)
**Chaos drill: DO restart under load**

AC:
- Drill: create 5 concurrent LIVE sessions in staging, kill DO instances via `wrangler delete` (or re-deploy), verify clients reconnect within 10s.
- Reconnect success rate ≥ 95% in test.
- `do.restart_detected` AE event emitted on cold start.
- Drill runbook in `knowledge-base/operations/CHAOS_DO_RESTART_RUNBOOK.md`.

#### DEVOPS-CHX-04 (13 pts, P0, S63)
**Chaos drill: multi-region read failover**

AC:
- Drill: set `DB_EU` binding to an invalid database ID in staging, deploy; verify EU reads fall back to `DB` (US primary); verify no user-visible error (transparent fallover).
- `multi_region.replica_failover` AE event emitted with `region: "eu"`, `fallbackTo: "us"`.
- Full drill takes < 15 min end-to-end (detect → failback → restore).
- Drill evidence stored in `qesto-logs/chaos-evidence/YYYY-MM-DD-mr-failover.json`.

#### DEVOPS-CHX-05 (5 pts, P0, S61)
**Chaos drill runbook template and evidence format**

AC:
- `knowledge-base/operations/CHAOS_DRILL_TEMPLATE.md` defines: drill name, target component, hypothesis, blast radius, rollback trigger, success/failure criteria, evidence format.
- Evidence format: JSON in R2 `qesto-logs/chaos-evidence/` with `drillId`, `component`, `startedAt`, `endedAt`, `outcome`, `aeEventCount`, `rollbackTriggered`.
- Monthly drill calendar added to `knowledge-base/operations/CHAOS_DRILL_CALENDAR.md`.

#### DEVOPS-CHX-06 (5 pts, P1, S64)
**Chaos drill CI gate (monthly cron)**

AC:
- GitHub Actions workflow `chaos-drill-reminder.yml` runs on `schedule: cron('0 9 1 * *')`: opens a GitHub issue titled "Monthly Chaos Drill Required — [Month YYYY]" if no chaos drill evidence file exists in R2 for the past 30 days.
- Issue assigned to DevOps team; auto-closes when evidence file appears (webhook).
- `chaos.drill_overdue` AE event emitted if 35 days pass without evidence.

#### DEVOPS-CHX-07 (8 pts, P1, S62)
**Chaos drill: Stripe circuit breaker trip and recovery**

AC:
- Drill: set `CHAOS_STRIPE_FAIL_RATE=1.0` in staging; make 5 billing API calls; verify `CircuitBreaker.STRIPE` transitions to OPEN state within 3 failures.
- Verify `/api/billing/*` returns 503 with `{ error: "billing_unavailable" }` (not 500 stack trace).
- After 30s, breaker half-opens; next successful probe closes it; verify `cb.stripe_closed` AE event.
- Drill adds `cb.stripe_open` and `cb.stripe_closed` events to AE.

#### DEVOPS-CHX-08 (8 pts, P1, S64)
**Chaos drill: AI inference timeout**

AC:
- `CHAOS_AI_LATENCY_MS=30000` causes Workers AI wrapper to time out before AbortController fires.
- Verify AI routes return 503 with graceful degradation (cached result or "AI unavailable" message).
- `cb.ai_open` AE event emitted; session creation continues without AI suggestions.

#### DEVOPS-CHX-09 (8 pts, P1, S65)
**Chaos drill: D1 shard failure**

AC:
- Drill: point `DB_SHARD_1` at invalid D1 ID in staging; send requests from teams on shard 1; verify `/api/admin/health` shows `shards.shard_1: "error"`; verify affected teams get 503 with `{ error: "shard_unavailable" }`.
- Verify shard-0 teams are unaffected (blast radius limited to shard 1).
- Restore: fix binding, redeploy, verify shard 1 recovers.
- RTO: ≤ 5 min to detect + communicate; ≤ 10 min to restore.

---

### Domain: PRT — Partner Environment Isolation

#### DEVOPS-PRT-01 (13 pts, P0, S63)
**Partner D1 database provisioning runbook + wrangler.toml partner binding template**

AC:
- `knowledge-base/operations/PARTNER_PROVISIONING_RUNBOOK.md` created.
- Runbook: `wrangler d1 create qesto-partner-{ORG_ID} --remote`, apply schema, add `DB_PARTNER_{ORG_ID}` binding to `wrangler.toml`, deploy.
- `wrangler.toml` has commented-out partner binding template (`[[d1_databases]] binding = "DB_PARTNER_ACME" ...`) as canonical example.
- Each partner gets a dedicated D1; no shared shard with other tenants.
- Onboarding verified by `curl .../api/admin/health` showing new partner binding health.

#### DEVOPS-PRT-02 (8 pts, P1, S63)
**Partner KV namespace isolation**

AC:
- Partner namespace naming convention: `PARTNER_{ORG_ID}_{STORE}_KV` (e.g., `PARTNER_ACME_SESSIONS_KV`).
- `lib/partner/bindings.ts` exports `getPartnerKV(orgId, store, env)` resolving the correct namespace from `env`.
- CI gate: no cross-partner KV access (namespace name must not cross `orgId`).
- Provisioning runbook extended with KV step.

#### DEVOPS-PRT-03 (13 pts, P0, S64)
**Partner routing middleware (X-Partner-Org header → binding resolution)**

AC:
- Hono middleware reads `X-Partner-Org` header (set by Cloudflare Access rule or partner subdomain).
- Middleware resolves `orgId → DB_PARTNER_{ORG_ID}` and `PARTNER_{ORG_ID}_*_KV` bindings; sets them on `c.var.partnerDb` and `c.var.partnerKv`.
- Routes that support partner isolation use `c.var.partnerDb ?? c.env.DB` (fallback for non-partner requests).
- Unit tests cover: valid org, unknown org → 403, missing header → default bindings.
- `tsc --noEmit` passes with dynamic binding access pattern.

#### DEVOPS-PRT-04 (8 pts, P0, S64)
**Partner secret management (per-partner JWT_SECRET and Stripe keys)**

AC:
- Partners get isolated secrets: `PARTNER_{ORG_ID}_JWT_SECRET`, `PARTNER_{ORG_ID}_STRIPE_SECRET_KEY`.
- `lib/partner/secrets.ts` exports `getPartnerJwtSecret(orgId, env): string` — falls back to global `JWT_SECRET` for non-partner requests.
- Rotation: `wrangler pages secret put PARTNER_{ORG_ID}_JWT_SECRET` + redeploy; only that partner's sessions invalidated.
- Documented in `knowledge-base/operations/PARTNER_SECRET_ROTATION_RUNBOOK.md`.

#### DEVOPS-PRT-05 (5 pts, P0, S63)
**Partner onboarding runbook (provision → deploy → smoke)**

AC:
- `knowledge-base/operations/PARTNER_ONBOARDING_CHECKLIST.md` covers all steps: D1 create + schema, KV namespaces (8), secrets, wrangler.toml update, deploy, health check, smoke test.
- Estimated onboarding time: < 2h with checklist.
- Smoke test script: `scripts/smoke-partner.sh {ORG_ID}` — creates test session, starts, closes, verifies audit.

#### DEVOPS-PRT-06 (8 pts, P1, S63)
**Partner observability (partner_id dimension in AE events)**

AC:
- All AE events gain optional `partner_id` field (null for non-partner requests).
- Set by partner routing middleware from `X-Partner-Org` header.
- AQL queries support `WHERE partner_id = 'acme'` for per-partner SLO tracking.
- `db.query`, `ws.vote_submitted`, `session.started`, `error.api` all confirmed to carry `partner_id`.

#### DEVOPS-PRT-07 (13 pts, P1, S64)
**Partner staging sandbox**

AC:
- `[env.staging-partner-demo]` wrangler env added as reference partner env.
- Uses `DB_PARTNER_DEMO`, `PARTNER_DEMO_SESSIONS_KV`, etc. (all staged IDs).
- Partner routing middleware verifiable in staging with `X-Partner-Org: demo`.
- `wrangler deploy --env staging-partner-demo --dry-run` passes.

#### DEVOPS-PRT-08 (8 pts, P1, S65)
**Partner SLO tracking (per-org SLO breakdown)**

AC:
- All SLO dashboard endpoints accept `?partner_id=acme` filter.
- Per-partner P95 vote latency and API availability tracked independently.
- Partner SLO breach triggers partner-specific Slack alert (if `PARTNER_{ORG_ID}_SLACK_WEBHOOK` secret configured).

#### DEVOPS-PRT-09 (8 pts, P1, S65)
**Partner backup isolation (per-partner R2 prefix)**

AC:
- D1 backup cron extended: for each `DB_PARTNER_*` binding, backup to `qesto-backups/partners/{ORG_ID}/backup-YYYY-MM-DD.json`.
- Backup verification: `wrangler r2 object list qesto-backups --prefix partners/acme/ | tail -5`.
- Missing partner backup after 26h: `backup.partner_missed` AE event + Slack alert.

#### DEVOPS-PRT-10 (5 pts, P2, S66)
**Partner decommission runbook**

AC:
- `knowledge-base/operations/PARTNER_DECOMMISSION_RUNBOOK.md`: export all partner D1 data to R2 signed URL, delete KV namespaces, remove wrangler.toml bindings, redeploy, verify partner routing returns 404.
- Data retention: exported backup retained for 90 days post-decommission.
- Runbook tested in staging with `demo` partner env.

---

### Domain: CI — CI/CD Pipeline

#### DEVOPS-CI-01 (5 pts, P1, S60)
**Vitest shard split for CI parallelism**

AC:
- CI matrix runs Vitest with `--shard=1/4`, `2/4`, `3/4`, `4/4` across 4 parallel jobs.
- Total CI time target: ≤ 4 min (currently ~12 min for 485+ tests).
- All shards must pass; any shard failure fails the build.
- Coverage merged across shards using `vitest merge-coverage`.

#### DEVOPS-CI-02 (8 pts, P0, S61)
**Production deploy canary gate (CF traffic split)**

AC:
- Deploy workflow: deploys new Pages version as `preview` first; then increments traffic 0% → 10% → 50% → 100% with 5-min health check between each step.
- If health check fails at any step: automatic rollback (revert traffic split to previous version).
- Traffic split managed via Cloudflare Pages `wrangler pages deployment activate` or CF API.
- Gate documented in `knowledge-base/operations/deployment/CANARY_DEPLOY_RUNBOOK.md`.

#### DEVOPS-CI-03 (8 pts, P1, S62)
**Multi-region deploy pipeline (US first, EU/APAC after health gate)**

AC:
- Deploy workflow runs in stages: deploy US bindings → health check US → deploy EU bindings → health check EU → deploy APAC.
- Each stage runs `curl .../api/admin/multi-region/status` and asserts `overallStatus: "healthy"`.
- Failure at any stage halts deployment; on-call Slack alert sent.
- `knowledge-base/operations/deployment/MULTI_REGION_DEPLOY_RUNBOOK.md` updated.

#### DEVOPS-CI-04 (5 pts, P0, S60)
**Commit SHA injection fix**

AC:
- CI deploy step sets `COMMIT_SHA=$(git rev-parse --short HEAD)` and passes as `--var COMMIT_SHA:$COMMIT_SHA` to wrangler deploy.
- `GET /api/version` returns `{ "version": "3.x.y", "commit": "abc1234", "env": "production" }`.
- `COMMIT_SHA` must not be `"dev"` in production deployments; CI gate fails if it is.
- Resolves known gap in INFRA_SPRINT_CHECKLIST Phase 1.

#### DEVOPS-CI-05 (8 pts, P1, S62)
**Blue/green deploy for Pages Functions**

AC:
- Two named Pages project slots: `qesto-blue` and `qesto-green`; DNS CNAME points to active slot.
- Deploy to inactive slot; run smoke tests; flip DNS CNAME to new slot.
- Rollback: flip CNAME back (< 60s DNS propagation with low TTL).
- Runbook: `knowledge-base/operations/deployment/BLUE_GREEN_RUNBOOK.md`.

#### DEVOPS-CI-06 (5 pts, P0, S61)
**Post-deploy automated smoke tests**

AC:
- `scripts/smoke-deploy.sh` runs after every production deploy: hits `/api/admin/health`, `/api/version`, creates a test session (dry run mode), verifies D1 + KV probes.
- Failure triggers automatic rollback (calls rollback step in CI pipeline).
- Smoke test runtime ≤ 60s.
- Added as post-deploy step in `.github/workflows/deploy.yml`.

---

### Domain: OBS — Observability

#### DEVOPS-OBS-01 (8 pts, P0, S60)
**Distributed trace x-trace-id propagation to R2 and AE**

AC:
- All requests already propagate `x-trace-id` (from SUB100MS_PROOF); this story verifies full propagation to R2 log tail and AE.
- Tail worker in `worker/tail/tail.ts` extracts `x-trace-id` from request and includes in R2 log line JSON.
- All AE events gain `trace_id` field (from `c.req.header('x-trace-id')` or generated UUID if absent).
- Cross-service trace stitching testable: given a `vote.submitted` AE event + R2 log entry, both carry the same `trace_id` for the same request.

#### DEVOPS-OBS-02 (8 pts, P1, S61)
**CF Analytics Engine real-time infra health dashboard AQL library**

AC:
- `knowledge-base/operations/monitoring/INFRA_AQL_LIBRARY.md` documents 10 canned AQL queries: vote latency P95, error rate, shard health, multi-region lag, KV miss rate, DO cold starts, AI timeout rate, backup recency.
- Queries tested against real AE dataset in staging.
- Admin can run any query via `GET /api/admin/ae/query?preset=vote_latency_p95&window=1h`.

#### DEVOPS-OBS-03 (8 pts, P1, S62)
**Per-region latency heatmap (colo-level AE data)**

AC:
- AE events include `colo_id` (from `cf.colo`); heatmap query groups `db.query` and `ws.vote_submitted` by `colo_id` and `hour`.
- `/api/admin/slo/latency-heatmap` returns `{ colos: [{ id, avgMs, p95Ms, requestCount }] }`.
- Top 20 colos by request volume included; sorted by P95 latency.

#### DEVOPS-OBS-04 (5 pts, P1, S60)
**AQL query library for on-call canned queries**

AC:
- `knowledge-base/operations/monitoring/ONCALL_AQL_PLAYBOOK.md` lists 6 emergency queries: error spike, vote latency regression, shard failure, KV exhaustion, AI timeout rate, DO capacity exceeded.
- Each query includes: AQL statement, expected normal output, red-flag threshold, next step if threshold exceeded.
- Referenced in OPS_RUNBOOKS_V3.md incident table.

#### DEVOPS-OBS-05 (8 pts, P1, S63)
**Partner-scoped observability (partner_id dimension everywhere)**

AC:
- See DEVOPS-PRT-06; this story is the observability-side mirror.
- Verifies all existing AE events (error.api, session.started, ws.vote_submitted) carry `partner_id` correctly.
- Admin can query `GET /api/admin/ae/query?preset=error_rate&partner_id=acme`.

---

### Domain: SEC — Security and Secrets

#### DEVOPS-SEC-01 (8 pts, P1, S62)
**Secret rotation automation (monthly reminder + wrangler CLI script)**

AC:
- GitHub Actions workflow `secret-rotation-reminder.yml` opens issue on `schedule: cron('0 9 1 */3 *')` (quarterly).
- Issue lists: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `JWT_SECRET`, `OAUTH_TOKEN_MEK`, `PARTNER_*_JWT_SECRET` — with rotation runbook links.
- `scripts/rotate-secret.sh <SECRET_NAME>` prompts for new value, runs `wrangler pages secret put`, deploys, runs smoke test.
- JWT_SECRET rotation includes pre-rotation warning template for user comms.

#### DEVOPS-SEC-02 (8 pts, P0, S60)
**R2 cross-region backup EU replication**

AC:
- `qesto-backups-eu` R2 bucket created in EU jurisdiction.
- Daily backup cron copies `qesto-backups/backup-YYYY-MM-DD.json` to `qesto-backups-eu/backup-YYYY-MM-DD.json` after primary backup completes.
- Replication verified: `wrangler r2 object list qesto-backups-eu | tail -3` shows same date as `qesto-backups`.
- Recovery runbook updated to cover EU backup as secondary restore path.

#### DEVOPS-SEC-03 (5 pts, P0, S61)
**OAUTH_TOKEN_MEK rotation procedure and staging test**

AC:
- `knowledge-base/operations/OAUTH_TOKEN_MEK_ROTATION_RUNBOOK.md` created.
- Rotation: generate new MEK, `wrangler pages secret put OAUTH_TOKEN_MEK`, deploy; all stored OAuth tokens re-encrypted on next access (lazy migration in `EncryptedTokenStore`).
- Staging test: rotate MEK in staging, verify Slack/Teams OAuth tokens still work post-rotation.
- Rotation window: no downtime for non-OAuth features; OAuth integrations may fail for ≤ 30s during lazy re-encryption.

#### DEVOPS-SEC-04 (5 pts, P0, S60)
**Secrets-in-vars CI audit check**

AC:
- `scripts/check-secrets-in-vars.ts` scans `wrangler.toml` `[vars]` blocks for known secret patterns (`_KEY`, `_SECRET`, `_TOKEN`, `_CERT`, `_PASSWORD`).
- CI fails if any secret-looking key appears in `[vars]` (not `[[secrets]]`).
- Added to `npm run check` suite.
- Currently `wrangler.toml` passes (no secrets in vars); gate prevents future regressions.

---

## Sprint Table

| Sprint | Window (est.) | Theme | Stories | Pts |
|--------|---------------|-------|---------|-----|
| **S60** | 2027-Q3 W1–W2 | Multi-region prod activation + SLO foundation + CI baseline | DEVOPS-MR-01/02/03/04/06, DEVOPS-SLO-01/02/03/04/09, DEVOPS-STG-01/05, DEVOPS-CI-01/04, DEVOPS-OBS-01/04, DEVOPS-DB-01, DEVOPS-SEC-02/04 | **130** |
| **S61** | 2027-Q3 W3–W4 | D1 shard bindings v1 + canary deploy gate + SLO alerting | DEVOPS-DB-02/03/04/07/10, DEVOPS-MR-07/08, DEVOPS-STG-02, DEVOPS-SLO-05/08, DEVOPS-CI-02/06, DEVOPS-OBS-02, DEVOPS-SEC-03, DEVOPS-CHX-05 | **135** |
| **S62** | 2027-Q4 W1–W2 | Chaos library v1 + SLO v2 + blue-green deploy + write-path audit | DEVOPS-CHX-01/02/03/07, DEVOPS-SLO-06/07, DEVOPS-STG-04/06, DEVOPS-CI-03/05, DEVOPS-OBS-03, DEVOPS-MR-09, DEVOPS-SEC-01, DEVOPS-DB-10 | **128** |
| **S63** | 2027-Q4 W3–W4 | APAC replica + cross-shard queries + partner env design | DEVOPS-MR-05/10, DEVOPS-DB-05/08, DEVOPS-PRT-01/02/05/06, DEVOPS-STG-03/07, DEVOPS-SLO-10, DEVOPS-CHX-04, DEVOPS-OBS-05 | **136** |
| **S64** | 2027-Q4 W5–2028-Q1 W1 | Partner isolation v1 + D1 shard 3 + chaos CI gate | DEVOPS-PRT-03/04/07, DEVOPS-DB-09, DEVOPS-CHX-06/08, DEVOPS-STG-08/09, DEVOPS-MR-07 *(re-verify APAC)* | **130** |
| **S65** | 2028-Q1 W2–W3 | D1 write sharding + tenant migration + partner SLO/backup | DEVOPS-DB-06, DEVOPS-PRT-08/09, DEVOPS-CHX-09, DEVOPS-SLO-08 *(per-region tuning)* | **134** |
| **S66** | 2028-Q1 W4–W5 | Partner decommission + multi-region write routing + chaos shard | DEVOPS-PRT-10, DEVOPS-MR-09 *(APAC write audit)*, DEVOPS-DB-06 *(APAC shard migration)* | **125** |
| **S67** | 2028-Q2 W1–W2 | SLO automation + error budget alerts + staging full parity | DEVOPS-SLO-05 *(multi-partner)*, DEVOPS-STG-07 *(APAC shard)*, DEVOPS-OBS-02 *(partner queries)* | **130** |
| **S68** | 2028-Q2 W3–W4 | Partner secret hardening + infra health dashboard v2 + CI hardening | DEVOPS-SEC-01 *(partner rotation)*, DEVOPS-OBS-03 *(APAC heatmap)*, DEVOPS-CI-03 *(APAC stage)* | **128** |
| **S69** | 2028-Q2 W5–Q3 W1 | Global deploy pipeline + APAC failover runbook + chaos monthly | DEVOPS-CHX-06 *(APAC variant)*, DEVOPS-MR-06 *(APAC runbook)*, DEVOPS-CI-02 *(APAC canary)* | **130** |
| **S70** | 2028-Q3 W2–W3 | Infra hardening + runbook finalization + v3.4-infra release gate | All runbooks reviewed, gaps closed; RC health check; release sign-off | **128** |

**Total committed: ~1,434 pts across 11 sprints (avg 130 pts/sprint)**

---

## Detailed Sprint Breakdown

### Sprint 60 — Multi-Region Prod Activation + SLO Foundation + CI Baseline

**Target: 130 pts** | Workstreams: Infra (MR activation), Platform-Eng (SLO), Reliability (CI baseline)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-MR-01 | Activate MULTI_REGION_ENABLED + health probe expansion | 5 | Infra |
| DEVOPS-MR-02 | EU D1 read replica binding + resolveReadRegion() | 13 | Infra |
| DEVOPS-MR-03 | Multi-region canary rollout + MULTI_REGION_REPLICA_PCT var | 8 | Infra |
| DEVOPS-MR-04 | Regional read path AE events (colo_id, read_region) | 8 | Infra |
| DEVOPS-MR-06 | EU read failover runbook | 5 | Infra |
| DEVOPS-SLO-01 | SLO dashboard v1: vote latency P50/P95/P99 | 8 | Platform-Eng |
| DEVOPS-SLO-02 | API availability SLO + 28-day error budget | 8 | Platform-Eng |
| DEVOPS-SLO-03 | D1 query latency SLO | 5 | Platform-Eng |
| DEVOPS-SLO-04 | WebSocket connect latency SLO | 5 | Platform-Eng |
| DEVOPS-SLO-09 | SLO documentation + on-call response thresholds | 8 | Platform-Eng |
| DEVOPS-STG-01 | Staging multi-region flag + EU binding parity | 5 | Reliability |
| DEVOPS-STG-05 | wrangler.toml staging/prod drift CI gate | 5 | Reliability |
| DEVOPS-CI-01 | Vitest shard split (--shard=N/4) | 5 | Reliability |
| DEVOPS-CI-04 | Commit SHA injection fix | 5 | Reliability |
| DEVOPS-OBS-01 | x-trace-id propagation to R2 + AE | 8 | Reliability |
| DEVOPS-OBS-04 | AQL on-call query playbook | 5 | Reliability |
| DEVOPS-DB-01 | D1 sharding ADR review + binding schema design | 8 | Infra |
| DEVOPS-SEC-02 | R2 cross-region EU backup replication | 8 | Reliability |
| DEVOPS-SEC-04 | Secrets-in-vars CI audit check | 5 | Reliability |
| **Total** | | **130** | |

**Gates:** EU D1 replica must be provisioned before DEVOPS-MR-02 starts (wrangler d1 create). ADR-0023 accepted before DEVOPS-DB-01.

---

### Sprint 61 — D1 Shard Bindings v1 + Canary Deploy Gate + SLO Alerting

**Target: 135 pts** | Workstreams: Infra (DB sharding), Platform-Eng (SLO alerting + deploy), Reliability (staging + ops)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-DB-02 | D1 shard 0 + shard 1 prod bindings | 13 | Infra |
| DEVOPS-DB-03 | Hash-based shard router service | 13 | Infra |
| DEVOPS-DB-04 | Shard health probes in /api/admin/health | 8 | Infra |
| DEVOPS-DB-07 | Per-shard R2 backup cron | 8 | Infra |
| DEVOPS-DB-10 | D1 shard forward-fix protocol doc | 8 | Infra |
| DEVOPS-MR-07 | Cross-region session consistency check | 8 | Platform-Eng |
| DEVOPS-MR-08 | /api/admin/multi-region/status endpoint | 8 | Platform-Eng |
| DEVOPS-SLO-05 | SLO alerting: Slack when error budget ≥80% | 8 | Platform-Eng |
| DEVOPS-SLO-08 | SLO burn rate alerts (1h + 6h windows) | 5 | Platform-Eng |
| DEVOPS-STG-02 | Staging D1 shard bindings (2 shards) | 8 | Reliability |
| DEVOPS-CI-02 | Production deploy canary gate | 8 | Reliability |
| DEVOPS-CI-06 | Post-deploy automated smoke tests | 5 | Reliability |
| DEVOPS-OBS-02 | CF AE real-time infra health dashboard AQL | 8 | Reliability |
| DEVOPS-SEC-03 | OAUTH_TOKEN_MEK rotation procedure | 5 | Reliability |
| DEVOPS-CHX-05 | Chaos drill runbook template + evidence format | 5 | Reliability |
| **Total** | | **128** | |

_Note: DEVOPS-DB-03 (shard router) is a gate for all subsequent DB-dependent stories in S62+._

---

### Sprint 62 — Chaos Library v1 + SLO v2 + Blue-Green Deploy + Write-Path Audit

**Target: 128 pts** | Workstreams: Reliability (chaos), Platform-Eng (SLO v2), Infra (deploy hardening)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-CHX-01 | Chaos library v1: D1 latency injection | 13 | Reliability |
| DEVOPS-CHX-02 | Chaos drill: KV timeout simulation | 8 | Reliability |
| DEVOPS-CHX-03 | Chaos drill: DO restart under load | 8 | Reliability |
| DEVOPS-CHX-07 | Chaos drill: Stripe CB trip + recovery | 8 | Reliability |
| DEVOPS-SLO-06 | Per-region SLO breakdown (EU vs US) | 8 | Platform-Eng |
| DEVOPS-SLO-07 | SLO v2: composite multi-service SLO | 8 | Platform-Eng |
| DEVOPS-STG-04 | Staging chaos injection flag support | 8 | Platform-Eng |
| DEVOPS-STG-06 | Automated staging → prod promotion pipeline | 8 | Infra |
| DEVOPS-CI-03 | Multi-region deploy pipeline (US → EU staged) | 8 | Infra |
| DEVOPS-CI-05 | Blue/green deploy for Pages Functions | 8 | Infra |
| DEVOPS-OBS-03 | Per-region latency heatmap (colo-level AE) | 8 | Platform-Eng |
| DEVOPS-MR-09 | Write-path audit: enforce US-primary only | 13 | Infra |
| DEVOPS-SEC-01 | Secret rotation automation (quarterly reminder) | 8 | Reliability |
| **Total** | | **124** | |

---

### Sprint 63 — APAC Replica + Cross-Shard Queries + Partner Env Design

**Target: 136 pts** | Workstreams: Infra (APAC + sharding), Partner-Eng (partner env), Reliability (chaos + staging)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-MR-05 | APAC D1 read replica + colo routing extension | 13 | Infra |
| DEVOPS-MR-10 | Multi-region read skew detection + alerting | 8 | Infra |
| DEVOPS-DB-05 | Cross-shard admin aggregation queries | 13 | Infra |
| DEVOPS-DB-08 | Per-shard AE events + SLO dashboard entry | 8 | Infra |
| DEVOPS-PRT-01 | Partner D1 provisioning runbook + binding template | 13 | Partner-Eng |
| DEVOPS-PRT-02 | Partner KV namespace isolation pattern | 8 | Partner-Eng |
| DEVOPS-PRT-05 | Partner onboarding runbook | 5 | Partner-Eng |
| DEVOPS-PRT-06 | Partner observability (partner_id AE dimension) | 8 | Partner-Eng |
| DEVOPS-STG-03 | Staging partner namespace isolation | 8 | Reliability |
| DEVOPS-STG-07 | Staging full multi-region parity (EU + US) | 13 | Reliability |
| DEVOPS-SLO-10 | Monthly SLO report automation | 5 | Reliability |
| DEVOPS-CHX-04 | Chaos drill: multi-region read failover | 13 | Reliability |
| DEVOPS-OBS-05 | Partner-scoped observability (partner_id everywhere) | 8 | Partner-Eng |
| **Total** | | **123** | |

---

### Sprint 64 — Partner Env Isolation v1 + D1 Shard 3 + Chaos CI Gate

**Target: 130 pts** | Workstreams: Partner-Eng (isolation), Infra (shard 3 + APAC), Reliability (chaos CI)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-PRT-03 | Partner routing middleware (X-Partner-Org) | 13 | Partner-Eng |
| DEVOPS-PRT-04 | Partner secret management (per-partner JWT) | 8 | Partner-Eng |
| DEVOPS-PRT-07 | Partner staging sandbox (demo env) | 13 | Partner-Eng |
| DEVOPS-DB-09 | Shard 2 (APAC) binding + routing | 13 | Infra |
| DEVOPS-CHX-06 | Chaos drill CI gate (monthly cron) | 5 | Reliability |
| DEVOPS-CHX-08 | Chaos drill: AI inference timeout | 8 | Reliability |
| DEVOPS-STG-08 | Staging seed data pipeline | 5 | Reliability |
| DEVOPS-STG-09 | Staging SLO dashboard | 8 | Reliability |
| DEVOPS-MR-03 | Multi-region canary: advance to 100% EU | 8 | Infra |
| DEVOPS-SLO-05 | SLO alerting: extend to APAC region | 8 | Platform-Eng |
| DEVOPS-DB-04 | Shard health probes: add shard 2 | 5 | Infra |
| DEVOPS-OBS-02 | AQL library: add APAC + shard-2 queries | 8 | Reliability |
| **Total** | | **102** | |

_Note: Lower total because DEVOPS-PRT-03 + DB-09 both require 2-week coordination with architect; pad with 2-3 stretch items from S65:_

Carry-forward from S65 into S64 stretch:
- DEVOPS-DB-06 (13 pts, begin only) = add 13 → total 115. Add DEVOPS-SEC-01 (quarterly check) = 123. Add DEVOPS-CI-02 (APAC canary gate) partial = 8 → **131** ✓

---

### Sprint 65 — D1 Write Sharding + Tenant Migration + Partner SLO/Backup

**Target: 134 pts** | Workstreams: Infra (write sharding), Partner-Eng (SLO/backup), Reliability (chaos + hardening)

| ID | Title | Pts | Stream |
|----|-------|-----|--------|
| DEVOPS-DB-06 | Tenant-to-shard assignment + migration toolkit | 13 | Infra |
| DEVOPS-PRT-08 | Partner SLO tracking (per-org breakdown) | 8 | Partner-Eng |
| DEVOPS-PRT-09 | Partner backup isolation (per-partner R2 prefix) | 8 | Partner-Eng |
| DEVOPS-CHX-09 | Chaos drill: D1 shard failure | 8 | Reliability |
| DEVOPS-SLO-06 | Per-region SLO: add APAC targets | 8 | Platform-Eng |
| DEVOPS-MR-09 | Write-path audit: extend to APAC | 8 | Infra |
| DEVOPS-DB-05 | Cross-shard queries: extend to 3 shards | 8 | Infra |
| DEVOPS-OBS-03 | Latency heatmap: APAC colos added | 8 | Platform-Eng |
| DEVOPS-STG-07 | Staging: add APAC shard binding | 8 | Reliability |
| DEVOPS-CI-03 | Multi-region deploy: add APAC stage | 8 | Infra |
| DEVOPS-SLO-07 | Composite SLO: add shard health dimension | 5 | Platform-Eng |
| DEVOPS-SEC-02 | R2 backup: add APAC bucket replication | 8 | Reliability |
| DEVOPS-DB-08 | AE events: shard 2 telemetry | 5 | Infra |
| DEVOPS-CHX-04 | Chaos drill: APAC failover variant | 8 | Reliability |
| **Total** | | **111** | |

_Add DEVOPS-PRT-01 extension (partner 2nd org onboarding run-through, 5 pts) + DEVOPS-MR-07 APAC consistency test (8 pts) + DEVOPS-CI-06 smoke test APAC health (5 pts) = **129** ≈ 134_ ✓

---

### Sprints 66–70 — Summary

S66–S70 are rolling consolidation and scale-out sprints. Full breakdowns follow the same pattern as S60–S65.

| Sprint | Theme | Key Stories | Pts Target |
|--------|-------|-------------|------------|
| **S66** | Partner decommission + multi-region write routing + chaos shard | DEVOPS-PRT-10, DEVOPS-MR-09 APAC audit extension, DEVOPS-DB-06 APAC migration, cross-shard query tuning | 125 |
| **S67** | SLO automation + error budget + staging full parity | DEVOPS-SLO-05 multi-partner, DEVOPS-STG-07 APAC shard, DEVOPS-OBS-02 partner AQL, burn rate refinement | 130 |
| **S68** | Partner secret hardening + infra health dashboard v2 + CI hardening | DEVOPS-SEC-01 partner rotation, DEVOPS-OBS-03 APAC heatmap, DEVOPS-CI-03 APAC canary, blue/green APAC | 128 |
| **S69** | Global deploy pipeline + APAC failover runbook + chaos monthly CI | DEVOPS-CHX-06 APAC variant, DEVOPS-MR-06 APAC runbook, DEVOPS-CI-02 APAC canary gate, all chaos drills verified | 130 |
| **S70** | Infra hardening + runbook finalization + v3.4-infra release gate | Runbook review sweep, gap analysis, SLO annual review, ADR documentation sweep, RC health check, release sign-off | 128 |

---

## ADR Calendar (S60–S70)

| ADR | Accept by | Blocks |
|-----|-----------|--------|
| ADR-0023 (D1 write sharding) | Pre-S60 (architect gate) | DEVOPS-DB-01 through DB-10 |
| ADR-0024 (partner env isolation) | Pre-S63 | DEVOPS-PRT-01 through PRT-10 |
| ADR-0025 (multi-region write routing) | Pre-S65 | DEVOPS-DB-06 write sharding |
| ADR-0026 (chaos engineering standards) | Pre-S62 | DEVOPS-CHX-01 through CHX-09 |

---

## Escalation Gates

| Trigger | Action |
|---------|--------|
| EU D1 replica lag > 60s sustained | Escalate to architect; consider disabling EU reads |
| D1 shard imbalance > 70/30 | Architect reviews hash function; tenant migration may be needed |
| Partner onboarding stalls > 2h | Escalate to DevOps lead; check wrangler account D1 limits |
| SLO budget breached (100% consumed) | P0 incident; all hands |
| Chaos drill evidence missing 35 days | P1 operational risk; schedule drill immediately |

---

## Docs to Update (per story completion)

| Change | Doc |
|--------|-----|
| Any new D1 binding | `knowledge-base/architecture/ARCHITECTURE.md` infra section |
| Any new KV namespace | `knowledge-base/architecture/ARCHITECTURE.md` + INFRA_BINDINGS.md |
| New runbook | `knowledge-base/operations/OPS_RUNBOOKS_V3.md` incident table |
| New SLO | `knowledge-base/operations/SLO_DEFINITIONS.md` |
| New chaos drill evidence | `qesto-logs/chaos-evidence/` R2 + CHAOS_DRILL_CALENDAR.md |
| Sprint complete | `BACKLOG_MASTER.md` §Sprint 60–70 story status |
