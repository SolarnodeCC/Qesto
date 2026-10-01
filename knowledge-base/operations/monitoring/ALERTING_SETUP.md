---
id: RUNBOOK-ALERTING-SETUP
type: runbook
category: operations
status: active
version: 1.0
created: 2026-10-01
updated: 2026-10-01
tags:
  - alerting
  - observability
  - github
  - secrets
---

# Alerting & monitoring setup (manual Cloudflare / GitHub steps)

Code wires critical failures (`app.onError` 5xx, cron failures, webhook DLQ growth,
queue consumer failures) through `functions/api/lib/alerts.ts` → `dispatchAlert` /
`alertCritical`. Channels are **opt-in via secrets**; unset secrets are safe no-ops.

## Secrets (Worker `qesto-api` + Pages project `qesto`)

Set on **both** the Worker and Pages Functions (dual entry):

```bash
# Slack / generic incoming webhook (optional)
wrangler secret put ALERT_WEBHOOK_URL
# Pages: Dashboard → Workers & Pages → qesto → Settings → Variables and secrets

# Optional Sentry DSN — HTTP store API, no SDK wrap required
wrangler secret put SENTRY_DSN

# GitHub auto-issues (optional)
wrangler secret put GITHUB_ALERT_TOKEN
```

### `GITHUB_ALERT_TOKEN` (fine-grained PAT)

1. GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate.
2. Resource owner: **SolarnodeCC** (or the org that owns the repo).
3. Repository access: **Only select repositories** → `Qesto`.
4. Permissions: **Issues → Read and write** (nothing else).
5. Store the token only via `wrangler secret put GITHUB_ALERT_TOKEN` / Pages secrets UI.
6. Create (once) the label **`auto-alert`** on `SolarnodeCC/Qesto` (Issues → Labels), or let the first create fail until the label exists — GitHub requires the label to exist when passed in `labels: []`.

### Vars (non-secret)

Already in `wrangler.toml` `[vars]`:

```toml
GITHUB_ALERT_REPO = "SolarnodeCC/Qesto"
```

Override per env if needed. Format must be `owner/repo`.

## Cloudflare Queues (post-session work)

Producer binding `INSIGHTS_QUEUE` + consumer are declared in `wrangler.toml`.
**One-time account setup before deploy** (or close falls back to `waitUntil`):

```bash
wrangler queues create qesto-insights
wrangler queues create qesto-insights-dlq
```

Then deploy the Worker so the consumer (`worker/index.ts` → `queue`) attaches.

## Cloudflare Observability / Notifications (dashboard)

Manual (not in repo):

1. **Workers Observability** — already enabled in `wrangler.toml` `[observability]`. Confirm Log Explorer for `qesto-api`.
2. **Pages Observability** — Pages → `qesto` → Settings → Functions → enable Workers Logs / Observability if available on the plan.
3. **Cloudflare Notifications** — Account → Notifications → add Worker error / Queue backlog alerts as a second line of defence (complements app-level `ALERT_WEBHOOK_URL`).

## Anti-spam (GitHub channel)

| Control | Behaviour |
|--------|-----------|
| Fingerprint | `route` (IDs collapsed) + error class → KV key `alert:gh:fp:*` |
| Dedupe | Existing open issue → comment with recurrence count (min 15 min between comments) |
| Rate limit | Max 5 **new** issues / hour (`alert:gh:rate:*`) |
| Closed issue | Fingerprint cleared; next fire creates a new issue |
| Body | Route, error class, env, opaque `trace_id` only — **no PII** |

## What was intentionally not removed

Stripe / Resend / Reddit / YouTube **product code** remains (billing, magic links, marketing OAuth pages). Only the **Mention Monitor cron** (`0 */3 * * *`) was disabled because Reddit/YouTube are not connected and previously logged `"not connected"` noise every 3 hours. `mention-monitor.ts` now soft-skips unconnected platforms if re-enabled later.

## Related code

- `functions/api/lib/alerts.ts` — thresholds + dispatch
- `functions/api/app.ts` — `onError` → `safeLogContext` + `alertCritical`
- `worker/index.ts` — cron / queue failure paging
- `functions/api/lib/queues/producer.ts` — queue + waitUntil fallback
- `tests/unit/alerts.test.ts`, `tests/unit/queues-producer.test.ts`
