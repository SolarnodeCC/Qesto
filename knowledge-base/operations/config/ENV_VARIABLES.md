# Environment Variables Documentation

Complete reference for all environment variables used in Qesto.

**Note**: Frontend variables (VITE_*) go in `.env.local`. Backend variables are configured in `wrangler.toml` or set as secrets via `wrangler secret put`.

---

## Frontend Variables (Vite)

### VITE_API_BASE_URL
- **Type**: String (URL)
- **Required**: No
- **Default**: Empty (proxies to localhost:8787 in dev)
- **Description**: Base URL for the Cloudflare Worker API
- **Usage**: Used by frontend API client to determine where to send requests
- **Local dev**: Leave empty—Vite dev server proxies `/api/*` to `wrangler dev` on port 8787
- **Production**: Set to your Cloudflare Pages domain (e.g., `https://qesto.cc`)

### VITE_SUPERUSER_EMAIL
- **Type**: String (email)
- **Required**: No
- **Default**: `oostelaar@hotmail.com`
- **Description**: Email address of superuser who gets admin UI access in frontend
- **Usage**: Frontend checks this to show admin panel and settings
- **Note**: Must match a registered user in the system

### VITE_CHECKOUT_URL
- **Type**: String (URL)
- **Required**: No
- **Default**: `https://checkout.qesto.cc`
- **Description**: Stripe checkout portal URL for paid plan upgrades
- **Usage**: Displayed in billing/upgrade flows in the UI

---

## Backend Variables (wrangler.toml / wrangler secret put)

### Core Configuration

#### ENV
- **Type**: String (`production`, `staging`, `development`)
- **Required**: Yes
- **Defined in**: `wrangler.toml [vars]`
- **Description**: Environment identifier
- **Usage**: Error messages, logging, feature gates
- **Values**: 
  - `production` (default)
  - `staging`

#### PAGES_URL
- **Type**: String (URL)
- **Required**: Yes
- **Defined in**: `wrangler.toml [vars]`
- **Description**: Cloudflare Pages origin (frontend domain)
- **Usage**: CORS allowed-origin, CSRF checks, magic link emails
- **Examples**:
  - Production: `https://qesto.cc`
  - Staging: `https://staging.qesto.cc`

#### API_URL
- **Type**: String (URL)
- **Required**: Yes
- **Defined in**: `wrangler.toml [vars]`
- **Description**: This Worker's own URL
- **Usage**: OAuth redirect_uri, email magic-link base URL
- **Examples**:
  - Production: `https://qesto.cc`
  - Staging: `https://staging.qesto.cc`

#### COMMIT_SHA
- **Type**: String (git SHA or version identifier)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]` (overridden by CI at deploy time)
- **Default**: `dev`
- **Description**: Git commit SHA for tracking deployed version
- **Usage**: Telemetry, error tracking, version identification

---

### Authentication & SAML

#### JWT_SECRET
- **Type**: String (cryptographic key)
- **Required**: Yes (for session auth)
- **Set via**: `wrangler secret put JWT_SECRET`
- **Description**: Secret key for signing and verifying JWT tokens
- **Usage**: Magic-link auth, session validation
- **Security**: Must be a strong random string (min 32 characters)

#### SAML_SP_ENTITY_ID
- **Type**: String (URL / entity identifier)
- **Required**: If using SAML SSO
- **Defined in**: `wrangler.toml [vars]`
- **Description**: SAML Service Provider Entity ID
- **Usage**: SAML authentication handshake
- **Examples**:
  - Production: `https://qesto.cc`
  - Staging: `https://staging.qesto.cc`

#### SAML_ACS_URL
- **Type**: String (URL)
- **Required**: If using SAML SSO
- **Defined in**: `wrangler.toml [vars]`
- **Description**: SAML Assertion Consumer Service endpoint
- **Usage**: SAML IdP returns auth response to this URL
- **Examples**:
  - Production: `https://qesto.cc/api/auth/saml/callback`
  - Staging: `https://staging.qesto.cc/api/auth/saml/callback`

#### CF_ACCESS_AUDIENCE
- **Type**: String (Cloudflare Access app UUID)
- **Required**: If using Cloudflare Access for admin panel
- **Defined in**: `wrangler.toml [vars]`
- **Description**: Cloudflare Access application audience identifier
- **Usage**: Validating Cloudflare Access JWT tokens

#### CF_ACCESS_CERTS_URL
- **Type**: String (URL)
- **Required**: If using Cloudflare Access
- **Defined in**: `wrangler.toml [vars]`
- **Description**: URL to Cloudflare Access JWKS endpoint for verifying certs
- **Usage**: Validating Cloudflare Access JWT signatures

#### GOOGLE_CLIENT_ID
- **Type**: String
- **Required**: If using Google OAuth
- **Set via**: `wrangler secret put GOOGLE_CLIENT_ID`
- **Description**: Google OAuth application client ID
- **Usage**: OAuth sign-in via Google

#### GOOGLE_CLIENT_SECRET
- **Type**: String
- **Required**: If using Google OAuth
- **Set via**: `wrangler secret put GOOGLE_CLIENT_SECRET`
- **Description**: Google OAuth application client secret
- **Usage**: OAuth token exchange with Google
- **Security**: Never commit to source control

#### MICROSOFT_TENANT_ID
- **Type**: String (Azure tenant ID)
- **Required**: If using Microsoft SSO
- **Set via**: `wrangler secret put MICROSOFT_TENANT_ID`
- **Description**: Azure AD tenant ID for Microsoft SSO

#### SCIM_BEARER_TOKEN
- **Type**: String
- **Required**: If using SCIM provisioning
- **Set via**: `wrangler secret put SCIM_BEARER_TOKEN`
- **Description**: Bearer token for SCIM API authentication
- **Usage**: User/group provisioning integration

#### LDAP_URL
- **Type**: String (LDAP connection string)
- **Required**: If using LDAP integration
- **Set via**: `wrangler secret put LDAP_URL`
- **Description**: LDAP server connection URL
- **Format**: `ldap://host:389` or `ldaps://host:636`

#### LDAP_BIND_DN
- **Type**: String (distinguished name)
- **Required**: If using LDAP
- **Set via**: `wrangler secret put LDAP_BIND_DN`
- **Description**: LDAP bind DN for authentication queries

#### LDAP_SYNC_MOCK
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Set via**: `wrangler secret put LDAP_SYNC_MOCK`
- **Description**: Enable mock LDAP sync for testing (disables real LDAP calls)

#### LDAP_TEAM_ID
- **Type**: String (UUID)
- **Required**: If using LDAP
- **Set via**: `wrangler secret put LDAP_TEAM_ID`
- **Description**: Team ID to sync LDAP users into

---

### Email & Communication

#### RESEND_API_KEY
- **Type**: String (API key)
- **Required**: Yes (for email features)
- **Set via**: `wrangler secret put RESEND_API_KEY`
- **Description**: API key for Resend email service
- **Usage**: Sending magic-link emails, notifications
- **Security**: Never commit to source control
- **Get from**: https://resend.com dashboard

#### RESEND_FROM
- **Type**: String (email sender)
- **Required**: Yes (for email features)
- **Defined in**: `wrangler.toml [vars]`
- **Description**: Sender identity for Resend emails (must be verified in Resend)
- **Examples**:
  - Production: `Qesto <login@qesto.cc>`
  - Staging: `Qesto Staging <login@staging.qesto.cc>`

#### MARKETING_WEBHOOK_SECRET
- **Type**: String (cryptographic key)
- **Required**: If using marketing webhooks
- **Set via**: `wrangler secret put MARKETING_WEBHOOK_SECRET`
- **Description**: Secret key for verifying inbound marketing webhook signatures
- **Fallback**: If not set, uses JWT_SECRET

---

### Payments & Billing

#### STRIPE_SECRET_KEY
- **Type**: String (Stripe API key)
- **Required**: If using Stripe billing
- **Set via**: `wrangler secret put STRIPE_SECRET_KEY`
- **Description**: Stripe secret API key for backend payment operations
- **Usage**: Creating checkout sessions, managing subscriptions, Connect onboarding
- **Security**: Never commit; never expose to frontend
- **Get from**: Stripe dashboard → API keys (secret key)

#### STRIPE_WEBHOOK_SECRET
- **Type**: String (Stripe webhook signing secret)
- **Required**: If using Stripe webhooks
- **Set via**: `wrangler secret put STRIPE_WEBHOOK_SECRET`
- **Description**: Secret for verifying Stripe webhook signatures
- **Usage**: Validating webhook authenticity in `/api/webhooks/stripe`
- **Get from**: Stripe dashboard → Webhooks → Signing secret

#### CHECKOUT_URL
- **Type**: String (URL)
- **Required**: If using Stripe billing
- **Defined in**: `wrangler.toml [vars]`
- **Description**: Stripe checkout portal URL
- **Examples**:
  - Production: `https://checkout.qesto.cc`
  - Staging: `https://checkout-staging.qesto.cc`

---

### AI & Content Generation

#### KB_ADMIN_KEY
- **Type**: String (API key)
- **Required**: If using KB admin operations
- **Set via**: `wrangler secret put KB_ADMIN_KEY`
- **Description**: Admin key for knowledge base management endpoints
- **Usage**: KB admin operations (sync, health checks)

#### KB_SEARCH_SERVICE_KEY
- **Type**: String (API key)
- **Required**: If using KB search
- **Set via**: `wrangler secret put KB_SEARCH_SERVICE_KEY`
- **Description**: Service key for knowledge base search endpoints
- **Usage**: KB search integration

#### INDEXNOW_KEY
- **Type**: String
- **Required**: If using Bing IndexNow for SEO
- **Set via**: `wrangler secret put INDEXNOW_KEY`
- **Description**: Bing IndexNow API key for indexing pages
- **Usage**: SEO indexing of template pages
- **Get from**: https://www.bing.com/indexnow

#### INDEXNOW_KEY_FILE
- **Type**: String (filename)
- **Required**: If using IndexNow with key file validation
- **Set via**: `wrangler secret put INDEXNOW_KEY_FILE`
- **Description**: Key filename for IndexNow validation

---

### Feature Flags & Configuration

#### REALTIME_TOWNHALL_ENABLED
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `true`
- **Description**: Enable Townhall real-time session features
- **Usage**: Gating WebSocket realtime features

#### LIVE_ENERGIZERS_ENABLED
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `true`
- **Description**: Enable energizer warm-up activities
- **Usage**: Gating DRAFT→ENERGIZING→LIVE state machine

#### SENTIMENT_ENABLED
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `true`
- **Description**: Enable AI-powered sentiment analysis on responses
- **Usage**: Workers AI sentiment scoring per response

#### INTEGRATION_ENABLED
- **Type**: Boolean (`1` or `0`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `1` (enabled)
- **Description**: Enable Slack/Teams integration checks
- **Usage**: Gating integration setup in routes

#### CIRCUIT_BREAKER_ENABLED
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `true`
- **Description**: Enable circuit breaker for traffic spike protection
- **Usage**: Fail-closed safeguard against abuse

#### RATE_LIMIT_FAIL_CLOSED
- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: `false` (staging only)
- **Description**: Enable fail-closed rate limiting
- **Usage**: Rate limit enforcement strategy

#### WS_CONNECT_PER_IP_PER_MIN
- **Type**: Number (integer)
- **Required**: No
- **Defined in**: `wrangler.toml [vars]`
- **Default**: Varies by environment
- **Description**: Max WebSocket connections per IP per minute
- **Usage**: Preventing connection floods from single IP

#### REALTIME_V2_DEFAULT
- **Type**: Boolean
- **Required**: No
- **Description**: Use v2 realtime implementation
- **Usage**: Feature gate for realtime protocol versions

#### REALTIME_V3_ENABLED
- **Type**: Boolean
- **Required**: No
- **Description**: Enable v3 realtime features
- **Usage**: Feature gate for advanced realtime features

#### MULTI_REGION_WRITES_ENABLED
- **Type**: Boolean
- **Required**: No
- **Description**: Enable multi-region write support
- **Usage**: Cross-region replication

#### MULTI_REGION_FAILOVER_ENABLED
- **Type**: Boolean
- **Required**: No
- **Description**: Enable failover to alternate regions
- **Usage**: High availability

#### JOIN_CAPTCHA_ENABLED
- **Type**: Boolean
- **Required**: No
- **Description**: Enable CAPTCHA on session join
- **Usage**: Spam prevention

---

### Database & Storage

#### DB (Binding)
- **Type**: Cloudflare D1 binding
- **Required**: Yes
- **Defined in**: `wrangler.toml [[d1_databases]]`
- **Description**: D1 SQLite database connection
- **Usage**: All persistent data storage
- **Note**: Provisioned via Cloudflare dashboard

#### USERS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for user data
- **Usage**: User profiles, sessions, auth state

#### SESSIONS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for session state
- **Usage**: Active session metadata, temporary state

#### TEAMS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for team data
- **Usage**: Team profiles, settings, federation links

#### TEMPLATES_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for question templates
- **Usage**: Template storage and caching

#### DECISIONS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for decision/response data
- **Usage**: Response caching, insights cache

#### AUDIT_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: Yes
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for audit logs
- **Usage**: GDPR compliance, action logging

#### ACTIONS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for action tracking
- **Usage**: Custom action logging, SLA tracking

#### METRICS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for metrics and counters
- **Usage**: Push notification SLA counters, rate limiting

#### MARKETING_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for marketing/SEO data
- **Usage**: Template marketing metadata, sitemap cache

#### CIRCUIT_BREAKER_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for circuit breaker state
- **Usage**: Tracking service status, request counts

#### INTEGRATIONS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for integration configurations
- **Usage**: Slack/Teams webhooks, custom plugins

#### MULTI_REGION_STATE_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for multi-region state
- **Usage**: Cross-region coordination

#### HELP_CONVERSATIONS_KV (Binding)
- **Type**: Cloudflare KV namespace
- **Required**: No
- **Defined in**: `wrangler.toml [[kv_namespaces]]`
- **Description**: Key-value store for help chat conversations
- **Usage**: AI help feature state

---

### Vectorize & AI

#### DECISIONS_VECTORIZE (Binding)
- **Type**: Cloudflare Vectorize index
- **Required**: No
- **Defined in**: `wrangler.toml [[vectorize]]`
- **Description**: Vector index for decision/response embeddings
- **Usage**: Semantic search of responses, clustering
- **Index**: `qesto-decisions`

#### HELP_VECTORIZE (Binding)
- **Type**: Cloudflare Vectorize index
- **Required**: No
- **Defined in**: `wrangler.toml [[vectorize]]`
- **Description**: Vector index for help/knowledge base
- **Usage**: Semantic search of help articles
- **Index**: `qesto-help`

#### KB_VECTORIZE (Binding)
- **Type**: Cloudflare Vectorize index
- **Required**: No
- **Defined in**: `wrangler.toml [[vectorize]]`
- **Description**: Vector index for knowledge base content
- **Usage**: KB search and retrieval
- **Index**: `qesto-kb-production` (prod), varies by env

#### AI (Binding)
- **Type**: Cloudflare Workers AI
- **Required**: No (but used for sentiment, insights)
- **Defined in**: `wrangler.toml [ai]`
- **Description**: Workers AI runtime binding
- **Usage**: LLaMA 3.3 models for sentiment analysis, insights
- **Models**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Note**: Never use Anthropic API (hard rule per CLAUDE.md)

---

### Realtime & Durable Objects

#### SESSION_ROOM (Binding)
- **Type**: Cloudflare Durable Object
- **Required**: Yes
- **Defined in**: `wrangler.toml [[durable_objects.bindings]]`
- **Description**: SessionRoom durable object for WebSocket realtime state
- **Usage**: WebSocket connections, session state sync
- **Class**: `SessionRoom`

#### WORKFLOWS (Binding)
- **Type**: Cloudflare Workflows
- **Required**: No
- **Defined in**: `wrangler.toml [[workflows]]`
- **Description**: Workflow runtime for async template generation
- **Usage**: Long-running template generation tasks
- **Class**: `TemplateGenerationWorkflow`

#### R2_SESSIONS (Binding)
- **Type**: Cloudflare R2 bucket
- **Required**: No
- **Defined in**: `wrangler.toml [[r2_buckets]]`
- **Description**: R2 bucket for session snapshots
- **Usage**: Durable object recovery, session backups
- **Bucket**: `qesto-sessions` (prod), `qesto-sessions-staging` (staging)

#### METRICS_AE (Binding)
- **Type**: Cloudflare Analytics Engine dataset
- **Required**: No
- **Defined in**: `wrangler.toml [[analytics_engine_datasets]]`
- **Description**: Analytics Engine dataset for event tracking
- **Usage**: Platform metrics, conversion funnels, observability
- **Dataset**: `qesto_metrics`

---

### Admin & Testing

#### SUPERUSER_EMAIL
- **Type**: String (email)
- **Required**: No
- **Set via**: `wrangler secret put SUPERUSER_EMAIL`
- **Description**: Superuser email that bypasses plan quotas
- **Usage**: Admin access, testing higher tiers
- **Security**: Keep secret; controls who has full system access

#### SEED_ADMIN_EMAIL
- **Type**: String (email)
- **Required**: No
- **Set via**: `wrangler secret put SEED_ADMIN_EMAIL`
- **Description**: Email to seed as admin during development
- **Usage**: Development/testing only

#### CF_PAGES_COMMIT_SHA
- **Type**: String (git SHA)
- **Required**: No
- **Set via**: Cloudflare Pages build environment
- **Description**: Commit SHA from Cloudflare Pages build
- **Usage**: Tracking deployment version
- **Note**: Auto-populated by CF Pages build system

---

## Configuration by Environment

### Local Development (.env.local)

```bash
# Frontend only
VITE_API_BASE_URL=          # Leave empty; uses Vite proxy to :8787
VITE_SUPERUSER_EMAIL=your-email@example.com
VITE_CHECKOUT_URL=https://checkout-staging.qesto.cc

# Backend secrets (optional, for testing integrations)
# export RESEND_API_KEY=your-key
# export JWT_SECRET=your-secret
# export STRIPE_SECRET_KEY=your-key
```

Then run:
```bash
npm run dev       # Starts Vite + wrangler dev
```

### Staging Environment

Configured in `wrangler.toml [env.staging]`:
- Uses staging D1 database
- Uses staging KV namespaces
- Uses staging Stripe keys (via secrets)
- Uses staging.qesto.cc URLs

Deploy with:
```bash
wrangler pages deploy --env staging
```

### Production Environment

Configured in `wrangler.toml` default `[vars]`:
- Uses production D1 database
- Uses production KV namespaces
- Uses production Stripe keys (via secrets)
- Uses qesto.cc URLs
- Feature flags production-ready

Deploy with:
```bash
wrangler pages deploy
```

---

## Secret Management

### Setting Backend Secrets

Never commit secrets to source control. Use `wrangler secret put`:

```bash
# Set a secret (interactive)
wrangler secret put RESEND_API_KEY

# Set for specific environment
wrangler secret put JWT_SECRET --env staging

# View list of set secrets (values hidden)
wrangler secret list

# Delete a secret
wrangler secret delete JWT_SECRET
```

### Secrets Used in Production

These MUST be set via `wrangler secret put` before deployment:
- `RESEND_API_KEY` — Email delivery
- `JWT_SECRET` — Session tokens
- `STRIPE_SECRET_KEY` — Payment processing
- `STRIPE_WEBHOOK_SECRET` — Webhook validation
- `SUPERUSER_EMAIL` — Admin access
- `GOOGLE_CLIENT_SECRET` — OAuth (if enabled)
- `KB_ADMIN_KEY` — KB admin ops (if enabled)
- `LDAP_URL`, `LDAP_BIND_DN` — LDAP (if enabled)
- `INDEXNOW_KEY` — SEO indexing (if enabled)
- `EMBED_WIDGET_SECRET` — EMBED widget-token HMAC signing key (ADR-0050). Set via
  `wrangler pages secret put EMBED_WIDGET_SECRET`. Required for the embeddable
  widget mint + read planes; if unset the embed API returns 503. NEVER in
  `wrangler.toml`. No material derived from it ships to the browser.

### Checking Secrets Are Set

```bash
# List all secrets (non-interactive)
wrangler secret list

# Expected output:
# ┌──────────────────────────┐
# │ name                     │
# ├──────────────────────────┤
# │ RESEND_API_KEY           │
# │ JWT_SECRET               │
# │ STRIPE_SECRET_KEY        │
# │ ...                      │
# └──────────────────────────┘
```

---

## References

- **Deployment**: `docs/DEPLOY_BOOTSTRAP.md`
- **Production DB Migration**: `knowledge-base/operations/deployment/PRODUCTION-DB-MIGRATION-FIX.md`
- **API Specs**: `knowledge-base/specifications/domain/SPEC_BACKEND.md`
- **CLAUDE.md**: Project context and hard rules
