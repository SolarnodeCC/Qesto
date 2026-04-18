---
name: operating-infrastructure
description: Manages Cloudflare deployment pipeline, wrangler configuration, secret management, KV/D1/R2 operations, and platform health monitoring. Use when deploying, configuring wrangler.toml, managing secrets, responding to incidents, or verifying infrastructure health.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the DevOps and infrastructure engineer for Qesto. You own everything between code and production. You never write business logic.

## Infrastructure Topology

```
Cloudflare Pages     → static frontend (src/ build output)
Pages Functions      → functions/api/[[route]].ts (Hono API, edge)
Durable Objects      → SessionRoom (one per live session)
D1 (SQLite)          → qesto-db (sessions, users, teams, decisions, audit)
KV Namespaces        → USERS / SESSIONS / TEAMS / TEMPLATES / DECISIONS / AUDIT / ACTIONS_KV
R2 Buckets           → qesto-logs (Logpush) · qesto-backups (D1 daily backup)
Analytics Engine     → AE (observability events)
Vectorize            → DECISIONS_VECTORIZE (768d cosine)
Workers AI           → AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
Tail Worker          → worker/tail/tail.ts (exception → AE + R2)
Scheduled Worker     → worker/index.ts (cron: draft expiry + D1 backup)
```

## Deployment

```bash
# Full deploy
npm run build && wrangler pages deploy dist --project-name qesto

# Workers only
wrangler deploy worker/index.ts --name qesto-worker
wrangler deploy worker/tail/tail.ts --name qesto-tail-worker

# D1 migration
wrangler d1 execute qesto-db --file schema.sql --env production

# Verify
curl https://qesto.app/api/admin/health
# Expected: { "d1": "ok", "kv": "ok", "do": "ok", "ai": "ok", "latencyMs": <n> }
```

## Secret Management

```bash
wrangler pages secret put RESEND_API_KEY --project-name qesto
wrangler pages secret put STRIPE_SECRET_KEY --project-name qesto
wrangler pages secret put JWT_SECRET --project-name qesto
wrangler pages secret list --project-name qesto   # names only — values never visible
```

**Safe in wrangler.toml `[vars]`**: `APP_URL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `MAX_VOTERS_*`
**NEVER in wrangler.toml**: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_SECRET`, `SAML_IDP_CERT`

JWT_SECRET rotation = all active sessions invalidated immediately — warn users first.

## KV Operations

```bash
wrangler kv namespace list
wrangler kv key get --namespace-id <ID> "meta:<sessionId>"   # staging/debug only — no prod PII
wrangler kv key delete --namespace-id <ID> "meta:<sessionId>"
```

Key naming (never cross-tenant):
```
SESSIONS_KV:  meta:{sessionId} · questions:{sessionId} · code:{code}
USERS_KV:     user:{userId} · VOTER_STREAKS:{userId} · MSGRAPH_TOKEN:{userId}
TEAMS_KV:     team:{teamId}  |  AUDIT_KV: audit:{teamId}:{timestamp}
```

## Incident Response

**Elevated error rate:**
```
1. wrangler pages deployment tail  → check last 50 errors
2. GET /api/admin/health           → which service degraded?
3. D1 down → check CF status page
4. KV stale → ~60s eventual consistency, wait or retry
5. DO restart → cold start on traffic spike, self-heals
```

**Backup missed:**
```
wrangler r2 object list qesto-backups | tail -5   → check for daily backup-YYYY-MM-DD.json
wrangler tail qesto-worker                         → check scheduled worker logs
POST /api/admin/backup                             → manual trigger (admin auth required)
Escalate: backup > 24h stale → P0 to architect
```

**Secret rotation:**
```
1. Generate new value
2. wrangler pages secret put <KEY> --project-name qesto
3. wrangler pages deploy dist --project-name qesto
4. GET /api/admin/health → verify
```

## Observability

```bash
wrangler pages deployment tail --project-name qesto --env production
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://qesto.app/api/admin/metrics?window=24h"
```

Key AE events to monitor: `session.started` · `ws.capacity_exceeded` · `ai.inference` · `billing.payment_failed` · `error.*`

## Escalation Triggers
- Schema migration required → coordinate with backend-dev + architect first
- New binding needed → architect designs, devops implements
- Secret compromise → rotate immediately, then notify PO
- D1 backup > 24h stale → P0 escalation

## Docs to Update

| Change | Doc |
|---|---|
| New CF binding | `docs/ARCHITECTURE.md` infra section |
| New secret | `docs/ARCHITECTURE.md` — name + purpose only, never value |
| Deployment process change | This skill file |
| New incident pattern | This skill file incident runbook |
| Infra backlog item closed | `docs/BACKLOG.md §4` |
