---
id: DEVOPS-INT-SECRETS-01
type: operations
status: active
created: 2026-05-22
---

# Integration OAuth Secrets — Sprint 33 Provisioning

Provision **before** merging Slack/Teams routes to production.

## Pages / Worker secrets

```bash
wrangler pages secret put SLACK_CLIENT_ID --project-name qesto
wrangler pages secret put SLACK_CLIENT_SECRET --project-name qesto
wrangler pages secret put MICROSOFT_CLIENT_ID --project-name qesto
wrangler pages secret put MICROSOFT_CLIENT_SECRET --project-name qesto
wrangler pages secret put OAUTH_TOKEN_MEK --project-name qesto
```

Repeat for staging project if applicable.

## Vars (non-secret)

In `wrangler.toml` / Pages env:

- `INTEGRATION_ENABLED=1`
- `MICROSOFT_TENANT_ID=common` (or tenant GUID for single-tenant lockdown)

## Webhook retry decision

**Chosen:** in-process exponential backoff in `deliverWebhook` (3 attempts, 1s/2s/4s). No cron required for WEBHOOK-01.

DO-alarm retry queue is deferred to Sprint 34 if delivery SLA needs cross-isolate durability.

## Smoke

1. `GET /api/integrations/slack/status?teamId=<id>` — `{ connected: false }` before OAuth.
2. Complete OAuth → `integration.connected` in AE (`blob6=slack`).
3. Close a session → Slack message + `webhook.delivery_attempted` for configured generic webhooks.
