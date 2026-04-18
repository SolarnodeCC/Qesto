# SPEC_DEPLOYMENT — Build, Config, Secrets, CI/CD, Monitoring

## Overview
Qesto deploys to **Cloudflare Pages** with **D1 database**, **KV stores**, **Durable Objects**, and **Workers AI**. Build pipeline: Vite (frontend) + Wrangler (Functions) → Pages deployment.

---

## Build Process

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (Vite + local Functions)
npm run dev
  # Frontend: http://localhost:5173
  # API: http://localhost:8788 (wrangler)

# Type checking
npx tsc --noEmit

# Run tests
npm test              # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run test:a11y     # Accessibility (Axe)

# Validation checks
npm run check        # Run all validation scripts
npm run i18n:validate # i18n completeness check
```

### Production Build

```bash
# Full build pipeline
npm run build

# Steps:
# 1. tsc --noEmit (type-check)
# 2. vitest run (unit tests)
# 3. vite build (frontend bundle → dist/)
# 4. Wrangler generates functions bundle

# Result:
# - dist/               (React app, static)
# - functions/api/...   (server-side handlers)
# - Ready for deployment
```

---

## Wrangler Configuration

**File**: `wrangler.toml`

```toml
# Project metadata
name = "qesto"
type = "javascript"
main = "functions/api/[[route]].ts"

# Build configuration
[build]
command = "npm run build"
watch_paths = ["src/**/*.{ts,tsx,jsx}", "functions/**/*.ts"]

# Local development
[env.development]
routes = [
  {pattern = "localhost:5173", zone_name = "dev.local"}
]

# Production environment
[env.production]
routes = [
  {pattern = "qesto.com", zone_name = "qesto.com"}
]

# Variables (non-sensitive, public)
[env.production.vars]
APP_URL = "https://qesto.com"
AI_GATEWAY = "qesto-ai-gateway"
STRIPE_PUBLIC_KEY = "pk_live_..."
STRIPE_PUBLISHABLE_KEY = "pk_live_..."
LOG_LEVEL = "info"

# Secrets (sensitive, set via CLI)
# See below: Secret Management

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "qesto-prod"
database_id = "xxxxxxxxxxxxxxxx"

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "xxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyy"

[[kv_namespaces]]
binding = "USERS_KV"
id = "xxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "TEAMS_KV"
id = "xxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "TEMPLATES_KV"
id = "xxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "DECISIONS_KV"
id = "xxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "AUDIT_KV"
id = "xxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "ACTIONS_KV"
id = "xxxxxxxxxxxxxxxx"

# Durable Objects
[[durable_objects.bindings]]
name = "SessionRoom"
class_name = "SessionRoom"
script_name = "qesto"
environment = "production"

# Analytics Engine
[[analytics_engine_datasets]]
binding = "EVENTS"

# R2 Bucket (logs)
[[r2_buckets]]
binding = "LOGS_BUCKET"
bucket_name = "qesto-logs"

# Service Bindings
[[services]]
binding = "AI_GATEWAY"
service = "qesto-ai-gateway"

# Routes (static + dynamic)
[env.production.routes]
  # Static assets (cache 1 year)
  {pattern = "qesto.com/assets/*", zone_name = "qesto.com", custom_domain = true, ttl_seconds = 31536000}
  
  # API routes (cache control per endpoint)
  {pattern = "qesto.com/api/*", zone_name = "qesto.com", custom_domain = true}
  
  # Pages (cache 1 hour)
  {pattern = "qesto.com/*", zone_name = "qesto.com", custom_domain = true, ttl_seconds = 3600}
```

---

## Secret Management

### Setting Secrets

```bash
# Single secret (interactive prompt)
wrangler pages secret put RESEND_API_KEY

# Bulk secrets (from file)
cat secrets.env | wrangler pages secret put --path -

# List secrets (redacted)
wrangler pages secret list

# Delete secret
wrangler pages secret delete RESEND_API_KEY
```

### Secrets File (.env.local, .gitignored)

```
# DO NOT commit to git
RESEND_API_KEY=re_abc123xyz
STRIPE_SECRET_KEY=sk_live_abc123
STRIPE_WEBHOOK_SECRET=whsec_abc123
JWT_SECRET=random-256-bit-key
SAML_CERT=-----BEGIN CERTIFICATE-----
...

# OAuth
OAUTH_MICROSOFT_CLIENT_ID=abc123
OAUTH_MICROSOFT_CLIENT_SECRET=secret
OAUTH_GOOGLE_CLIENT_ID=def456
OAUTH_GOOGLE_CLIENT_SECRET=secret

# Slack
SLACK_CLIENT_ID=slack_id
SLACK_CLIENT_SECRET=slack_secret
```

### Accessing Secrets in Code

```typescript
// functions/api/[[route]].ts
const route = new Hono<{Bindings: Env}>()

route.post('/billing/webhook/stripe', async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET
  const sig = c.req.header('stripe-signature')
  // Verify & process webhook
})
```

### Environment Variables (Env interface)

```typescript
// functions/api/types/index.ts
export interface Env {
  // Bindings
  DB: D1Database
  SESSIONS_KV: KVNamespace
  USERS_KV: KVNamespace
  TEAMS_KV: KVNamespace
  TEMPLATES_KV: KVNamespace
  DECISIONS_KV: KVNamespace
  AUDIT_KV: KVNamespace
  ACTIONS_KV: KVNamespace
  DECISIONS_VECTORIZE: Vectorize
  EVENTS: AnalyticsEngine
  LOGS_BUCKET: R2Bucket
  SessionRoom: DurableObjectNamespace
  AI: Ai  // Workers AI
  
  // Public variables
  APP_URL: string
  AI_GATEWAY: string
  STRIPE_PUBLIC_KEY: string
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  
  // Secrets
  RESEND_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  JWT_SECRET: string
  SAML_CERT: string
  OAUTH_MICROSOFT_CLIENT_ID: string
  OAUTH_MICROSOFT_CLIENT_SECRET: string
  // ... more
}
```

---

## CI/CD Pipelines

**File**: `.github/workflows/`

### 1. Deploy Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Run tests
        run: npm test
      
      - name: Check i18n
        run: npm run i18n:validate
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare
        run: |
          npx wrangler pages deploy \
            --project-name qesto \
            --branch main
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      
      - name: Run E2E tests (post-deploy)
        run: npm run test:e2e
        env:
          BASE_URL: https://qesto.com
```

### 2. Performance Monitoring

**File**: `.github/workflows/performance-monitoring.yml`

```yaml
name: Performance Check

on:
  workflow_run:
    workflows: [Deploy]
    types: [completed]

jobs:
  perf:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run load test
        run: npm run perf:realtime
        env:
          BASE_URL: https://qesto.com
          PERF_THRESHOLD_P95: 150  # ms
      
      - name: Check WebSocket latency
        run: npm run perf:websocket
        env:
          BASE_URL: wss://qesto.com
```

### 3. Secret Scanning

**File**: `.github/workflows/secret-scan.yml`

```yaml
name: Secret Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

### 4. i18n Validation

**File**: `.github/workflows/i18n-validate.yml`

```yaml
name: i18n Check

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Check missing keys
        run: npm run i18n:validate
      
      - name: Check unused keys
        run: node scripts/check-i18n-unused.mjs
```

### 5. Accessibility Testing

**File**: `.github/workflows/a11y-checks.yml`

```yaml
name: A11y Checks

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run accessibility tests
        run: npm run test:a11y
```

---

## Deployment Environments

### Staging

```bash
# Deploy to staging branch
git push origin main:staging

# Wrangler routes staging to staging.qesto.com
# Uses qesto-staging D1 database
# KV prefixed with staging-*
```

**Staging Configuration** (wrangler.toml):
```toml
[env.staging]
routes = [{pattern = "staging.qesto.com", zone_name = "qesto.com"}]
vars = {
  APP_URL = "https://staging.qesto.com",
  LOG_LEVEL = "debug"
}

[[d1_databases]]
binding = "DB"
database_name = "qesto-staging"
database_id = "staging-db-id"
```

### Development (Local)

```bash
npm run dev
# Runs on localhost:5173 (frontend) + localhost:8788 (API)
# Uses local .dev.vars file for secrets
```

**.dev.vars** (local secrets, .gitignored):
```
RESEND_API_KEY=test_key
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=dev_secret
# ... etc
```

---

## Rollback Procedure

### Immediate Rollback (Quick Revert)

```bash
# If new deploy causes issues, revert to previous deploy
wrangler rollback \
  --message "Revert bad deploy" \
  --account-id ${CLOUDFLARE_ACCOUNT_ID}
```

### Manual Rollback (To Specific Commit)

```bash
# 1. Identify bad commit
git log --oneline

# 2. Revert to known-good commit
git revert HEAD

# 3. Deploy reverted version
npm run build
npx wrangler pages deploy
```

### Database Rollback (D1)

```bash
# List previous migrations
wrangler d1 migrations list qesto-prod --remote

# Rollback to specific migration
wrangler d1 migrations undo qesto-prod --remote --steps 1
```

---

## Monitoring & Observability

### Health Check Endpoint

```bash
GET https://qesto.com/api/admin/health

Response:
{
  "status": "ok",
  "services": {
    "database": "ok",
    "kv": "ok",
    "do": "ok",
    "ai": "ok",
    "stripe": "ok"
  },
  "timestamp": 1712000000000
}
```

### Logs & Tracing

**Trace ID Correlation** (OBS-001):
- Every request assigned unique UUID
- Logged in R2 bucket (one file per request)
- Queryable by traceId, userId, sessionId, endpoint

**Log Format** (JSON):
```json
{
  "timestamp": 1712000000000,
  "traceId": "uuid-abc123",
  "userId": "user_xyz",
  "method": "POST",
  "path": "/api/sessions/:id/start",
  "statusCode": 200,
  "duration": 145,
  "errors": null,
  "metadata": {
    "sessionId": "sess_abc",
    "teamId": "team_xyz"
  }
}
```

### Analytics Events

**Analytics Engine** queries:
```sql
SELECT COUNT(*) FROM dataset
WHERE timestamp > now() - 86400000
AND metadata.event_type = 'session.created'
GROUP BY metadata.planId
```

### Alerting

**Alert Rules** (configurable via `/admin/alert-rules`):
```json
{
  "name": "High Error Rate",
  "condition": "error_rate > 5%",
  "window": "5m",
  "severity": "warning",
  "actions": ["email", "slack"]
}

{
  "name": "AI Rate Limit Exceeded",
  "condition": "ai_rate_limit_hits > 100",
  "window": "1m",
  "severity": "error",
  "actions": ["page_duty"]
}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Type checking passing (`tsc --noEmit`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] A11y tests passing (`npm run test:a11y`)
- [ ] i18n validation passing (`npm run i18n:validate`)
- [ ] No secrets in code (secret scan passed)
- [ ] Database migrations reviewed
- [ ] New environment variables documented
- [ ] Monitoring alerts configured
- [ ] Rollback plan reviewed

---

## Common Deploy Issues

### Issue: D1 Migration Fails

```bash
# Check migration status
wrangler d1 migrations status qesto-prod --remote

# If stuck, check DB directly
wrangler d1 execute qesto-prod "SELECT * FROM migrations"

# Apply migrations step-by-step
wrangler d1 migrations apply qesto-prod --remote --step 1
```

### Issue: Wrangler Authentication Fails

```bash
# Login to Cloudflare
wrangler login

# Or use API token (better for CI/CD)
export CLOUDFLARE_API_TOKEN=abc123xyz
wrangler deploy
```

### Issue: Out of Memory in Functions

```bash
# Check memory usage
wrangler tail --format pretty

# Optimize:
# - Reduce payload sizes
# - Stream large responses
# - Paginate D1 queries
```

---

## Related References

- [[SPEC_CORE.md#deployment-targets]] — Deployment environments
- [[SPEC_DATAMODEL.md#migration-pattern]] — Database migrations
- [[SPEC_INTEGRATIONS.md#stripe-webhook]] — Webhook deployment
