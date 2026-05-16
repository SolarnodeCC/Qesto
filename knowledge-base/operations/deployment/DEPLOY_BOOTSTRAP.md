---
id: RUNBOOK-DEPLOY_BOOTSTRAP
type: runbook
category: incident
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - incident-response
  - operations
  - procedures
relates_to:
  - OBSERVABILITY
---

# Qesto — Cloudflare Deploy Bootstrap

One-time provisioning steps to populate `wrangler.toml` with real D1 and KV
IDs. Run these from a machine with a logged-in `wrangler` (i.e. `wrangler
login` completed).

## 1. Provision D1

```bash
wrangler d1 create qesto-prod
# → prints database_id = "…"
wrangler d1 create qesto-preview
# → prints database_id = "…"
```

Paste each `database_id` into the matching `[[d1_databases]]` /
`[[env.preview.d1_databases]]` block in `wrangler.toml` and uncomment the
block. Then apply the initial schema:

```bash
wrangler d1 execute qesto-prod    --remote --file=./migrations/0000_init.sql
wrangler d1 execute qesto-preview --remote --file=./migrations/0000_init.sql
```

## 2. Provision KV namespaces

For each of the seven bindings — `USERS_KV`, `SESSIONS_KV`, `TEAMS_KV`,
`TEMPLATES_KV`, `DECISIONS_KV`, `AUDIT_KV`, `ACTIONS_KV` — create a
production and a preview namespace:

```bash
for ns in USERS SESSIONS TEAMS TEMPLATES DECISIONS AUDIT ACTIONS; do
  wrangler kv namespace create "${ns}_KV"
  wrangler kv namespace create "${ns}_KV" --preview
done
```

Paste each returned `id` into the matching `[[kv_namespaces]]` (production)
and `[[env.preview.kv_namespaces]]` (preview) block in `wrangler.toml`, then
uncomment them.

## 3. Secrets

`JWT_SECRET` must be set before magic-link auth works:

```bash
openssl rand -hex 32 | wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY   # paste your Resend API key
```

Preview env:

```bash
wrangler secret put JWT_SECRET     --env preview
wrangler secret put RESEND_API_KEY --env preview
```

For password + Google/Microsoft SSO login, also configure OAuth provider secrets:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MICROSOFT_CLIENT_ID
wrangler secret put MICROSOFT_CLIENT_SECRET
wrangler secret put MICROSOFT_TENANT_ID   # optional; defaults to "common"
```

## 4. Public pricing metadata

The pricing page reads quota limits from `GET /api/plans/catalog`. That same
catalog can expose non-secret Stripe price IDs and display amounts so the
marketing page stays aligned with checkout configuration.

Configure these as Cloudflare vars (not secrets) once live Stripe prices are
final:

```bash
wrangler pages deployment tail # optional sanity check for the Pages project/env

# Production Pages project variables:
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_TEAM_ANNUAL_PRICE_ID=price_...        # optional
STARTER_MONTHLY_EUR_CENTS=2900
STARTER_ANNUAL_EUR_CENTS=2400
TEAM_ANNUAL_EUR_CENTS=0                      # optional; omit for custom pricing
```

These values are public identifiers/amounts, unlike `STRIPE_SECRET_KEY`, which
must remain a secret. If unset, the frontend falls back to the static display
copy (`€24` annualized, `€29` monthly for Signal).

## 5. Verify

```bash
npm run deploy:api:dry-run
# Should list DB, all *_KV, SESSION_ROOM, AI, METRICS_KV, METRICS_AE, and COMMIT_SHA under bindings.

npm run deploy:api
# First real upload from a clean working tree.
```

The deploy script injects the current short git commit into `COMMIT_SHA` so `/api/version` and `x-qesto-api-commit` can prove deployed-code parity. It refuses a dirty working tree unless `--allow-dirty` is passed for an intentional non-release dry-run.

Then hit `https://qesto-api.oostelaar.workers.dev/api/admin/health` →
expect `{ "ok": true, "data": { "env": "production", … } }`.

Also verify that the deployed API commit matches your local checkout:

```bash
npm run verify:deploy -- https://qesto-api.oostelaar.workers.dev
```

Expected result: `Result       : match`

If Cloudflare Access is enabled, allow unauthenticated GET access to
`/api/version` so commit parity checks can run from CI and local scripts.

## Why bindings are commented out by default

Cloudflare's API rejects uploads that reference D1/KV IDs that don't exist in
the account. The repo ships with `[[d1_databases]]` and `[[kv_namespaces]]`
blocks commented out so CI (`wrangler versions upload`) can deploy the SPA +
`/api/admin/health` on a fresh account without pre-provisioning. Routes that
need `DB` (e.g. `/api/auth/*`) will 500 until step 1 is completed.
