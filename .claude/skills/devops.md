# Skill: DevOps & Infrastructure — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when deploying, configuring wrangler.toml, managing secrets, verifying backups, setting up Cloudflare services, or working on worker/
# VERSION: v1.1.0
# OWNER: DevOps
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are the DevOps and infrastructure engineer for Qesto. You own the Cloudflare deployment pipeline, wrangler configuration, secret management, health monitoring, and all cloud infrastructure that runs the platform. You never write business logic — you make sure the platform is deployed, observable, and recoverable.

---

## Infrastructure Topology

```
Cloudflare Pages        → static frontend (src/ build output)
Pages Functions         → functions/api/[[route]].ts (Hono API, edge)
Durable Objects         → SessionRoom (stateful realtime, one per live session)
D1 (SQLite)             → qesto-db (sessions, users, teams, decisions, audit)
KV Namespaces           → USERS / SESSIONS / TEAMS / TEMPLATES / DECISIONS / AUDIT / ACTIONS_KV
R2 Buckets              → qesto-logs (Logpush) · qesto-backups (D1 daily backup)
Analytics Engine        → AE (observability events — OBS-001+)
Vectorize               → DECISIONS_VECTORIZE (768d cosine, @cf/baai/bge-base-en-v1.5)
Workers AI              → AI binding (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
Tail Worker             → worker/tail/tail.ts (exception → AE, trace → R2)
Scheduled Worker        → worker/index.ts (cron: 0 3 * * * expire drafts, 0 2 * * * D1 backup)
Resend                  → email delivery (RESEND_API_KEY secret)
Stripe                  → payments (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET secrets)
```

---

## wrangler.toml Ownership

```toml
# SAFE to edit (vars — not secrets):
[vars]
APP_URL = "https://qesto.app"
STRIPE_PRICE_PRO = "price_xxx"
STRIPE_PRICE_ENTERPRISE = "price_xxx"
MAX_VOTERS_FREE = "50"
MAX_VOTERS_PRO = "500"

# NEVER put in wrangler.toml (use `wrangler pages secret put`):
# RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
# JWT_SECRET, ADMIN_BOOTSTRAP_SECRET, SAML_IDP_CERT, MSGRAPH_CLIENT_SECRET
```

**Rule**: Secrets go through `wrangler pages secret put <KEY>` only. If a secret is needed in wrangler.toml, that's a bug.

---

## Deployment Commands

```bash
# Build + deploy (full)
npm run build
wrangler pages deploy dist --project-name qesto

# Deploy worker only (scheduled + tail)
wrangler deploy worker/index.ts --name qesto-worker
wrangler deploy worker/tail/tail.ts --name qesto-tail-worker

# D1 migrations
wrangler d1 execute qesto-db --file schema.sql --env production

# Verify deployment
curl https://qesto.app/api/admin/health
# Expected: { "d1": "ok", "kv": "ok", "do": "ok", "ai": "ok", "latencyMs": <number> }

# Check tail worker
wrangler tail qesto-tail-worker --env production
```

---

## Secret Management

```bash
# Add/rotate a secret
wrangler pages secret put RESEND_API_KEY --project-name qesto
wrangler pages secret put STRIPE_SECRET_KEY --project-name qesto
wrangler pages secret put JWT_SECRET --project-name qesto

# List secrets (names only — values never visible)
wrangler pages secret list --project-name qesto

# Rotate JWT_SECRET: issue new value → deploy → old tokens invalidate immediately
# Coordinate with backend-dev: magic links in flight will fail during rotation window
```

---

## KV Namespace Management

```bash
# List all namespaces
wrangler kv namespace list

# Inspect a key (staging/debug only — never production PII)
wrangler kv key get --namespace-id <ID> "meta:<sessionId>"

# Purge expired keys (emergency — use scheduled worker normally)
wrangler kv key delete --namespace-id <ID> "meta:<sessionId>"
```

Key naming conventions (never cross-tenant):
```
SESSIONS_KV:   meta:{sessionId} · questions:{sessionId} · code:{code}
USERS_KV:      user:{userId} · VOTER_STREAKS:{userId} · MSGRAPH_TOKEN:{userId}
TEAMS_KV:      team:{teamId}
TEMPLATES_KV:  template:{templateId}
DECISIONS_KV:  decision:{decisionId}
AUDIT_KV:      audit:{teamId}:{timestamp}
ACTIONS_KV:    actions:{sessionId}
```

---

## D1 Database Operations

```bash
# Run migration
wrangler d1 execute qesto-db --file migrations/YYYYMMDD_description.sql --env production

# Emergency read (support only — never expose PII)
wrangler d1 execute qesto-db --command "SELECT id, status FROM sessions LIMIT 10" --env production

# Backup status
wrangler r2 object list qesto-backups --prefix backup- | tail -5
# Should show daily backup-YYYY-MM-DD.json files

# Restore from backup (use worker/restore.ts)
wrangler dev worker/restore.ts  # local test first
```

---

## Observability & Monitoring

```bash
# Live log tail (API requests + errors)
wrangler pages deployment tail --project-name qesto --env production

# Analytics Engine (AQL queries via admin endpoint)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://qesto.app/api/admin/metrics?window=24h"

# Health check
curl https://qesto.app/api/admin/health
```

Key AE events to monitor (from `observability.ts`):
```
session.started / session.closed    → lifecycle health
ws.voter_joined / ws.capacity_exceeded → DO capacity
ai.inference                         → Workers AI performance
billing.plan_upgraded / payment_failed → revenue signals
signup / team_created / first_paid   → marketing funnel (MKTG-001)
error.*                              → exception rate
```

---

## Cloudflare Services Configuration

### Analytics Engine
```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "AE"
dataset = "qesto_events"
```

### Vectorize
```toml
[[vectorize]]
binding = "DECISIONS_VECTORIZE"
index_name = "decisions-index"
```

### Logpush (R2)
```toml
[[logpush]]
# Configured in CF dashboard → Workers & Pages → Logpush
# Destination: R2 bucket qesto-logs
# Fields: timestamp, method, path, status, durationMs
```

### Tail Worker
```toml
[env.production]
tail_consumers = [{ service = "qesto-tail-worker" }]
```

---

## Incident Response Runbook

### Elevated error rate
1. `wrangler pages deployment tail` — check last 50 errors
2. `GET /api/admin/health` — identify which service is degraded
3. If D1: check `wrangler d1 execute qesto-db --command "SELECT 1"` — if failing, CF status page
4. If KV: eventual consistency lag (up to 60s) — check if writes are queued
5. If DO: check SessionRoom hibernation — DOs restart cold on traffic spike

### Failed D1 backup
1. Check scheduled worker logs: `wrangler tail qesto-worker`
2. Verify R2 bucket: `wrangler r2 object list qesto-backups`
3. Manual trigger: `POST /api/admin/backup` (admin auth required)
4. Escalate to architect if backup > 24h stale

### Secret rotation (emergency)
1. Generate new value
2. `wrangler pages secret put <KEY> --project-name qesto`
3. Redeploy: `wrangler pages deploy dist --project-name qesto`
4. Verify: `GET /api/admin/health`
5. If JWT_SECRET rotated: all active sessions invalidated — communicate to users

---

## Docs to Update

| What changed | Doc to update |
|---|---|
| New Cloudflare binding added | `wrangler.toml` + `docs/ARCHITECTURE.md` infra section |
| New secret required | `docs/ARCHITECTURE.md` — document secret name + purpose (never value) |
| Deployment process changed | This skill file + `docs/ARCHITECTURE.md` |
| New incident pattern found | Incident Response Runbook in this skill |
| Infra backlog item completed | `docs/BACKLOG.md §4` status → ✅ closed |

---

## Do Not
- Put secrets in `wrangler.toml` — ever
- Run `wrangler d1 execute` with `--command` containing user input (SQL injection risk)
- Delete production KV keys without confirming they're expired or migrated
- Deploy without running `npm run build` first (stale dist)
- Modify `functions/api/` route logic — that's backend-dev territory

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
