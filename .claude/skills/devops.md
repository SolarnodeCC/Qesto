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
curl https://qesto.cc/api/admin/health
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
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://qesto.cc/api/admin/metrics?window=24h"
```

Key AE events to monitor: `session.started` · `ws.capacity_exceeded` · `ai.inference` · `billing.payment_failed` · `error.*`

## Audit Follow-Up Operations

### Stripe / pricing configuration

Before production pricing is considered ready:
- Confirm product approval for rows tagged `Static copy` or `Roadmap` in the pricing matrix.
- Configure public Stripe price ID vars and euro-cent vars in Cloudflare only after prices are final.
- Verify `GET /api/plans/catalog` returns configured non-secret metadata.
- Smoke-test Pricing UI and checkout links after deploy.

### Resilience readiness

For every release touching Stripe, Resend, OAuth/SAML, Workers AI, Vectorize, D1, KV, or Durable Objects:
- Confirm timeout/retry/degradation behavior is documented.
- Confirm `/api/admin/health` covers the changed dependency or document the gap.
- Confirm structured logs/metrics exist for degraded dependencies.
- Confirm rollback or forward-fix plan for any irreversible D1/KV change.

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

## Rollback Runbook

**When**: Deployment introduces bug or breaks critical path. Decision: roll back vs fix-forward.

### Decision Tree
- **<5 min since deploy, critical path broken** → ROLLBACK (fastest recovery)
- **>30 min, metrics stable, fix in progress** → FIX-FORWARD (rollback cost > fix cost)
- **User-visible PII leak or auth bypass** → ROLLBACK IMMEDIATELY + security review

### Rollback Steps (5-10 min)

```bash
# 1. Identify current deployment
wrangler pages deployment list --project-name qesto | head -5
# Note: current commit SHA (CURRENT_SHA)

# 2. Identify last-good deployment
git log --oneline origin/main | head -10
# Find: LAST_GOOD_SHA (when? check AE error rate spike timeline)

# 3. Rollback Pages functions + static
git checkout LAST_GOOD_SHA
npm run build
wrangler pages deploy dist --project-name qesto
# Takes ~2-3 min. Verify in CF dashboard.

# 4. Verify
curl https://qesto.cc/api/admin/health
# Expected: all services "ok", latencyMs normal

# 5. Notify
# Post to #incidents: "Rolled back [CURRENT_SHA → LAST_GOOD_SHA]. Reason: [brief]. ETA for fix: [time]"
```

### What NOT to Rollback
- **D1 schema migrations** (data already committed — rolling back code leaves orphaned schema)
  - Fix: deploy code-side migration handler + backfill, OR open incident
- **KV data changes** (cannot revert distributed writes)
  - Fix: remediation code on new deployment

### Rollback Verification Checklist
- [ ] Health endpoint returns 200 all services
- [ ] No error spike in AE (wait 2 min, check metrics)
- [ ] Session creation succeeds (manual test in staging clone)
- [ ] Presenter can start LIVE session (manual test)
- [ ] Users reporting issue confirm recovery

---

## First-15-Minute Incident Triage

**When**: Alerts fire or customer reports production issue.

### Minutes 0–3: Assess Scope
```bash
# Get error snapshot
wrangler pages deployment tail --project-name qesto --env production | head -30

# Which service degraded?
curl -s https://qesto.cc/api/admin/health | jq '.'
# Look for: d1, kv, do, ai — one will be "error" or missing

# Error rate trend?
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://qesto.cc/api/admin/metrics?window=5m | jq '.errors_per_minute'
```

**Triage summary** (for incident channel):
- Affected service: [d1|kv|do|ai|unknown]
- Error rate: [N errors/min, trend: ↑↓→]
- User impact: [which feature broken — auth|session|billing|realtime]
- Duration: [when did it start — from AE timestamp]

### Minutes 3–10: Diagnosis Checklist

| Issue | Diagnosis | Fix |
|---|---|---|
| **D1 down** | `wrangler d1 execute qesto-db --command "SELECT 1"` → fails | Check CF status page. If CF OK → database locked (migration in progress?). Escalate to architect. |
| **KV error rate 100%** | `wrangler kv namespace describe SESSIONS_KV` → error | KV namespace misconfigured or binding broken. Check `wrangler.toml` binding name. Redeploy if config changed. |
| **DO unresponsive** | New `SessionRoom.ts` code crashed all DOs on startup | Rollback last deployment (see Rollback Runbook above). |
| **AI timeout** | `ai.inference` calls returning 504 | Workers AI region issue — temporary. Retry or degrade gracefully (use cached decision instead). |
| **500 error on all routes** | Any code path has uncaught exception | Check error logs for `stack: ...`. If auth issue → check JWT_SECRET rotation. If KV parse → corrupted JSON blob (rare). |

### Minutes 10–15: Escalation Path

- **If diagnosis unclear** → Escalate to architect (DOs, schema, multi-service consistency)
- **If data loss suspected** → P0 incident, notify PO + security
- **If rollback needed** → Follow Rollback Runbook (5–10 min parallel with diagnosis)
- **If prolonged outage** → Page on-call engineer (Slack: #incidents)

---

## Quality Gates

- [ ] Deployment verified with health check before closing PR
- [ ] Secrets rotated using `wrangler pages secret put` only (never committed)
- [ ] D1 migration tested in local-first (wrangler d1 local)
- [ ] Rollback plan documented for non-reversible changes (KV, D1 schema)
- [ ] Production pricing vars verified when pricing/checkout behavior changes
- [ ] Dependency degradation path verified for changed external services

## Do Not

- Do not commit secrets to `wrangler.toml` — use `wrangler pages secret put` only
- Do not deploy without running `npm run build` first (ensures test + typecheck pass)
- Do not manually edit KV blobs in production — always deploy code changes
- Do not skip health check after deployment (curl /api/admin/health)
- Do not rollback D1 migrations in production — migrate data forward instead
- Do not rotate JWT_SECRET without notifying users first (all sessions invalidated)

## Metrics

- Deployment success rate (target: 100% — zero failed deploys)
- Mean rollback decision time (target: <5 min)
- Incident detection-to-triage time (target: <10 min)
- Service availability (target: 99.9% — ~43 min downtime/month)

## Change Log
- 2026-04-24: Added Wave 2 runbooks — rollback procedure, first-15-min triage, quality gates
