---
id: OPS_S99_CLOSEOUT_EVIDENCE
type: operations
domain: operations
category: release-closeout
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - ops-s99-closeout-01
  - rt-01
  - v7.0
relates_to:
  - SPRINT99_EXECUTION
  - BACKLOG_ACTIVE
  - RELEASE_HEALTH_DASHBOARD
  - V70_RC_SOAK_EVIDENCE
---

# S99 Ops Closeout Evidence — RT-01 (`OPS-S99-CLOSEOUT-01`)

_Closes SPRINT99_EXECUTION.md exit items #18–22 where automation or documentation is sufficient. Production AE pull requires operator credentials._

---

## Summary

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 18 | XR smoke (device/emulator) | ⚠️ Manual | Unit: [`xr-spatial.test.tsx`](../../../tests/unit/xr-spatial.test.tsx); manual checklist §XR below |
| 19 | 2D voting + fallback smoke | ✅ Automated | [`xr-spatial.test.tsx`](../../../tests/unit/xr-spatial.test.tsx) L304–325 `fallback_notice`; vote path not gated on XR |
| 20 | Production deploy + rollback | ✅ CI + runbook | `.github/workflows/ci.yml` staging→prod; §Deploy/rollback below |
| 21 | AE metrics green | ⚠️ Operator | §Analytics Engine below — run after deploy |
| 22 | Marketing GA copy | ✅ Draft | [`MKTG_V70_GA_ANNOUNCEMENT.md`](../marketing/MKTG_V70_GA_ANNOUNCEMENT.md) |

---

## Platform smoke (`/api/platform/*`)

### Automated (CI + local)

```bash
node scripts/smoke-platform.mjs https://qesto.cc   # after prod deploy
```

**CI wiring (2026-06-19):** `ci.yml` runs platform smoke after the production health check.

**Local contract tests:** [`tests/unit/platform-v7-ga.test.ts`](../../../tests/unit/platform-v7-ga.test.ts) — version `7.0.0`, certification, v6-sunset.

### Operator sign-off

When GitHub billing is restored, confirm the `Platform v7 smoke` CI step is green on `main`. That satisfies staging + production platform endpoint verification.

---

## Deploy & rollback runbook

### Happy path (automated on `main` push)

1. `quality-gates · audit` — `ops/ci/quality-gates.sh`
2. `build · deploy` — `wrangler pages deploy` → `qesto` + cache purge + `verify-deploy.mjs` + health + platform smoke

### Rollback (manual, < 15 min)

| Step | Action |
|------|--------|
| 1 | Cloudflare Pages → **qesto** project → **Deployments** → select last known-good deployment → **Rollback to this deployment** |
| 2 | Purge CDN cache (same as CI `Purge Cloudflare cache` step) |
| 3 | `node scripts/smoke-platform.mjs https://qesto.cc` |
| 4 | `curl -sf https://qesto.cc/api/admin/health \| jq` — D1/KV/DO = `ok` |
| 5 | If API worker regression: redeploy previous `functions` bundle via matching Pages deployment (DO state is not rolled back) |

**Do not** roll back D1 migrations — v7.0 is additive per ADR-0063.

---

## Analytics Engine — error rate check (#21)

Run in Cloudflare dashboard → Analytics Engine → `QESTO_EVENTS` (or `qesto_metrics` per env).

### API error rate (last 24h) — green if errors < 1% of request volume

```sql
SELECT
  countIf(blob1 = 'error.api') AS api_errors,
  countIf(blob1 LIKE 'http.%') AS http_events
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '24' HOUR
```

**Green:** `api_errors / http_events < 0.01` (or flat error count < 100/day at current traffic).

### Realtime error budget (v7 soak baseline)

Per [`V70_RC_SOAK_EVIDENCE.md`](./V70_RC_SOAK_EVIDENCE.md): overall 5xx + WS abnormal close **0.18%** (< 1% budget).

### Session latency (sanity)

```sql
SELECT
  quantile(0.95)(double1) AS vote_p95_ms
FROM QESTO_EVENTS
WHERE timestamp > NOW() - INTERVAL '1' HOUR
  AND blob1 = 'ws.vote_submitted'
```

**Green:** `vote_p95_ms ≤ 500` (S99 monitoring target; soak showed < 50ms p95).

### Operator record template

| Check | Value | Threshold | Pass? | Date |
|-------|-------|-----------|-------|------|
| API error rate (24h) | _fill_ | < 1% | | |
| Vote p95 (1h) | _fill_ ms | ≤ 500 ms | | |
| Platform smoke prod | green/red | green | | |

---

## XR manual smoke checklist (#18)

_Device lab optional — not blocking code-complete GA claim._

| Step | Device | Pass? |
|------|--------|-------|
| Join LIVE session with `beta-xr` enabled + WebXR-capable browser | Quest 3 / iOS Safari 16+ | |
| XR launcher button visible only when `navigator.xr` supports immersive-vr/ar | | |
| Non-WebXR browser shows `fallback_notice`; vote still works | Desktop Chrome | |
| No vote blocked when XR session fails to start | | |

---

## Sign-off

| Role | Item | Date |
|------|------|------|
| DevOps | Smoke script + CI steps merged | 2026-06-19 |
| PO | Marketing draft approved for external use | pending |
| Operator | AE table filled post-deploy | pending billing fix |
