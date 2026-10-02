---
id: RUNBOOK-DEBUG-GUIDE
type: runbook
category: operations
status: active
version: 1.0
created: 2026-10-02
updated: 2026-10-02
tags:
  - observability
  - debugging
  - logging
  - alerts
relates_to:
  - ALERTING_SETUP
  - OBSERVABILITY
---

# Debug guide — where to look when something breaks

Structured logs are JSON lines from `safeLogContext` / `logEvent` / `logBestEffort` /
`logExternalFailure` (`functions/api/lib/log.ts`). Critical paging goes through
`alertCritical` (`functions/api/lib/alerts.ts`). Setup: [ALERTING_SETUP.md](./ALERTING_SETUP.md).

## Log fields (always safe)

| Field | Meaning |
|-------|---------|
| `level` | `error` \| `warn` \| `info` |
| `traceId` | Request / job correlation (`X-Trace-Id` / `trace_id`) |
| `route` | HTTP path or logical route (`SessionRoom.webSocketMessage`, `cron.*`) |
| `operation` | Sub-step (`d1.schema_patch`, `webhook.exhausted`, `resend.emails`) |
| `errorClass` | Error name / stable class |
| `errorMessage` | Sanitized; stripped in production when `process.env.ENV=production` |
| `stack` | Sanitized, ≤2048 chars |
| `sessionId` / `teamId` | Non-secret ids when known |
| `details.*` | Extra non-PII (`provider`, `httpStatus`, `attempt`, `bestEffort`, …) |
| `duration` | ms for the failing call when measured |

Never expect emails, JWTs, Stripe/Resend secrets, or magic-link tokens in logs
(redaction patterns in `log.ts`). Dev email fallback redacts `to=` but may still
include the magic-link URL for local sign-in.

## Symptom → where to look

| Symptom | Cloudflare / app place | Filter hints |
|---------|------------------------|--------------|
| API 5xx | Pages Functions (`qesto`) **and** Worker `qesto-api` Log Explorer | `level":"error"`, `route` matches path, `traceId` from response |
| Auth / magic-link fail | Same + `route` like `[auth] magic-link *` | Also `event":"email.*"` / `provider":"resend"` |
| Session start/close fail | API logs + AE `session.started` / `session.closed` | `lifecycle-start` / `lifecycle-close` routes |
| LIVE WS / votes broken | Worker DO logs (`SessionRoom.*`) | `do.ws_message_fault`, `do.storage_fault`, `SessionRoom.scheduleFlush` |
| D1 / KV / R2 glitches | `operation` starts with `d1.` / `kv.` / DO storage | `SchemaPatchError` only for *unexpected* DDL; duplicate-column is silent |
| Workers AI / Vectorize | `ai.gateway`, `ai-insights`, `worker/kb-health` | `ai_gateway_fallback:*`, `KbVectorDrift` |
| Queues / post-session | Worker queue consumer + `queues/producer` | Missing `INSIGHTS_QUEUE` → error + `waitUntil` fallback |
| Crons | Worker scheduled handler | `cron.*`, `mention_monitor.skipped`, KB health |
| Outbound webhooks | `webhooks.deliver` + AE `webhook.*` | Final failure: `operation":"webhook.exhausted"`; DLQ growth → `alertCritical` |
| Slack / Teams notify | `integrations.slack.send` / `integrations.teams.send` | `provider":"slack"` / `teams` |
| Stripe payment calls | Should be rare — payments gated off (#942) | `event":"stripe.disabled"` or `provider":"stripe"` if re-enabled |
| Operator page / GitHub issue | Secrets + label `auto-alert` | See [ALERTING_SETUP.md](./ALERTING_SETUP.md) |

### Pages vs Worker

HTTP API often runs on **Pages Functions** (`functions/[[path]].ts` → `createApp()`).
Cron, queues, and DO hibernation run on **Worker `qesto-api`**. Enable observability
on **both** (manual dashboard step — see ALERTING_SETUP). If you only see cron
lines on the Worker, check Pages logs for request traffic.

### Analytics Engine

`writeEvent` / metrics bindings (`METRICS_AE`) carry coarse counters (webhook
attempts, WS joins, session lifecycle). Use AE for volume/trends; use Log Explorer
JSON for stack + `traceId` root-cause.

## What we deliberately do *not* log

- Expected D1 schema-patch “duplicate column / already exists” (warm D1).
- Successful hot-path noise (every vote, every WS ping).
- Per-attempt webhook retries (AE counters only; one warn after exhaustion).
- Recipient emails / raw magic-link tokens in production error paths.
- Stripe/Resend/Reddit/YouTube when disabled — only a single `*.disabled` event
  if a gated route is hit.

## Volume controls

- Schema patch: unexpected failures warn **once per isolate** (`ignoreSchemaPatchError`).
- Best-effort paths: `level: warn` + `details.bestEffort: true` — never `alertCritical`.
- `alertCritical`: 5xx `onError`, cron/queue hard failures, webhook DLQ growth —
  GitHub channel rate-limited / fingerprint-deduped.
