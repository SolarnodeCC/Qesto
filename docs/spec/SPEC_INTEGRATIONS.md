# SPEC_INTEGRATIONS — Payments, AI, Auth, Webhooks

## Doc contract
Flows + env names = **integration intent**; **vendor docs + code** win on API version/payload details.

**Pre-build:** Stripe + webhook gates → [includes/PREBUILD_AND_DELIVERY.md#pre-production-gates](includes/PREBUILD_AND_DELIVERY.md#pre-production-gates).

## Readers (multi-lens · **Architect** = **Primary** for trust)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — secrets, webhook **idempotency**, SSO trust, least-privilege OAuth scopes. |
| **Backend Developer** | **Lead** — Stripe/Resend/OAuth handlers; verify signatures **before** body parse where possible. |
| **Frontend Developer** | Return URLs, billing handoffs, “Connect Slack” flows → [[SPEC_FRONTEND.md]]. |
| **UI specialist** | Post-checkout states, connected badges, payment failure / retry copy. |
| **Cloudflare specialist** | Workers AI binding + model IDs; rate limits; Vectorize ops tied to decisions search. |
| **API & middleware specialist** | `STR` webhooks, OAuth state/PKCE tables, align errors with [[SPEC_BACKEND.md]]. |

## Overview
Qesto integrates with **Stripe** (payments), **Workers AI** (LLM), **OAuth/SAML** (auth), **Resend** (email), **Slack/Teams/Zoom** (sharing), and **Vectorize** (semantic search).

---

## Stripe Integration

**File**: `functions/api/billing.ts`, `functions/api/stripe.ts`

### Checkout Flow

```
User on /billing → click "Upgrade to Pro"
  ↓
POST /billing/checkout {planId: "pro"}
  ↓
Backend:
  1. Lookup STRIPE_SECRET_KEY from env
  2. Create Stripe customer (if not exists)
  3. Create checkout session
  4. Store session ID in USERS_KV (session:${sessionId})
  5. Return checkout URL
  ↓
User redirected to Stripe checkout
  ↓
User completes payment → redirected to /billing/success
  ↓
Frontend: Refresh plan info via GET /auth/me
```

**API**:
```bash
POST /billing/checkout
Authorization: Bearer ${JWT}
Content-Type: application/json

{
  "planId": "team",
  "interval": "month"  // or "year"
}

Response:
{
  "data": {
    "sessionUrl": "https://checkout.stripe.com/pay/cs_live_..."
  }
}
```

### Customer Portal

```
User wants to manage subscription → click "Manage Billing"
  ↓
POST /billing/portal
  ↓
Backend:
  1. Lookup Stripe customer ID from USERS_KV
  2. Create Stripe billing portal session
  3. Return portal URL
  ↓
User redirected to Stripe portal (can update card, cancel, etc.)
```

**API**:
```bash
POST /billing/portal
Authorization: Bearer ${JWT}}

Response:
{
  "data": {
    "portalUrl": "https://billing.stripe.com/..."
  }
}
```

### Webhook Handler (Idempotent)

**Endpoint**: `POST /billing/webhook/stripe`

**Events Handled**:

| Event | Handler | Action |
|-------|---------|--------|
| `customer.subscription.created` | `createSubscription()` | Lookup user by Stripe customer ID, create subscription record in USERS_KV |
| `customer.subscription.updated` | `updateSubscription()` | Update plan tier, current period end, cancel status |
| `customer.subscription.deleted` | `cancelSubscription()` | Downgrade to "free" plan, disable premium features |
| `charge.dispute.created` | `escalateIssue()` | Alert admin, flag user for review |
| `invoice.payment_failed` | `invoiceFailure()` | Notify user (email via Resend) |

**Webhook Signature Verification** (illustrative — **use Stripe SDK** `constructWebhookEvent` / official CF Worker example; **not** Node `crypto`):

```typescript
// ILLUSTRATIVE — replace with Stripe webhook helper in Workers runtime
// stripe.webhooks.constructEvent(body, sigHeader, STRIPE_WEBHOOK_SECRET)
```

**Idempotency** (prevent duplicate processing):
```typescript
// Check if event already processed
const processed = await c.env.DB.prepare(
  'SELECT 1 FROM stripe_webhook_events WHERE stripe_event_id = ?'
).bind(event.id).first()

if (processed) {
  return c.json({received: true})  // Idempotent response
}

// Process event
await handleEvent(event)

// Record as processed
await c.env.DB.prepare(
  'INSERT INTO stripe_webhook_events (stripe_event_id, processed_at, event_type) VALUES (?, ?, ?)'
).bind(event.id, Date.now(), event.type).run()
```

### Subscription States

**D1 Storage** (in `USERS_KV` as `plan:${userId}`):
```json
{
  "planId": "team",
  "stripeCustomerId": "cus_ABC123",
  "stripeSubId": "sub_ABC123",
  "billingInterval": "month",
  "currentPeriodStart": 1712000000000,
  "currentPeriodEnd": 1714592000000,
  "cancelAtPeriodEnd": false,
  "status": "active",  // active | past_due | canceled | unpaid
  "updatedAt": 1712000000000
}
```

---

## Workers AI Integration

**File**: `functions/api/ai.ts`

### Model Gateway

```typescript
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

async function callAI(prompt: string, streaming = false) {
  const response = await c.env.AI.run(MODEL, {
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: prompt}
    ],
    temperature: 0.7,
    max_tokens: 1024,
    stream: streaming
  })
  
  return streaming ? response : response.response
}
```

### Use Cases

#### 1. Question Generation

```bash
POST /ai/suggest-questions
Authorization: Bearer ${JWT}
Content-Type: application/json

{
  "context": "Q1 planning session",
  "count": 5,
  "questionTypes": ["multiple_choice", "open"]
}

Response (streaming):
data: {"questions": [...]}
data: {"questions": [...]}
```

**Prompt Template**:
```
System: You are a facilitator expert. Generate engaging questions.
User: Context: Q1 planning session. Generate 5 multiple choice questions about budgets.

Response:
1. What is the proposed Q1 budget allocation?
   - Option A: ...
   - Option B: ...
```

#### 2. AI Summary / Recap

```bash
POST /sessions/:id/ai-summary
Authorization: Bearer ${JWT}

Response:
{
  "data": {
    "summary": "Team decided on 3 priorities: cost reduction, hiring, product launch. Main concerns: timeline and resources."
  }
}
```

#### 3. Question Rephrasing

```bash
POST /ai/rephrase
Authorization: Bearer ${JWT}

{
  "original": "Do you like this?",
  "context": "Session about company values"
}

Response:
{
  "data": {
    "rephrased": "To what extent do you align with our proposed company values?"
  }
}
```

### Rate Limiting

- **Free plan**: 10 requests/min per user
- **Pro plan**: 50 requests/min per user
- **Enterprise**: Custom

Enforced via in-memory cache (illustrative — **DO NOT** rely on global `Map` alone in multi-isolate production without Durable Object / KV coordination):

```typescript
const aiRateLimit = new Map<userId, {count: number, resetAt: number}>()

function checkAIRateLimit(userId: string, limit: number): bool {
  const now = Date.now()
  const limit_info = aiRateLimit.get(userId)
  
  if (!limit_info || now > limit_info.resetAt) {
    aiRateLimit.set(userId, {count: 1, resetAt: now + 60000})
    return true  // Allowed
  }
  
  if (limit_info.count < limit) {
    limit_info.count++
    return true  // Allowed
  }
  
  return false  // Rate limited
}
```

---

## Authentication Flows

**File**: `functions/api/auth.ts`

### 1. Magic Link Flow

```
POST /auth/request {email: "john@example.com"}
  ↓
Backend:
  1. Validate email format
  2. Generate random OTT token (32 chars)
  3. Store in D1: one_time_tokens (15min TTL)
  4. Send email via Resend
  5. Return {ok: true}
  ↓
Email received:
  [Verify Email] → https://qesto.com/auth/callback?token=xyz
  ↓
GET /auth/verify?token=xyz
  ↓
Backend:
  1. Lookup OTT in D1
  2. Check expiry (15min)
  3. Delete OTT (atomic DELETE RETURNING)
  4. Lookup/create user
  5. Issue JWT (sign with JWT_SECRET)
  6. Store JWT in USERS_KV (session_token:${token}, 30d TTL)
  7. Return JWT + user
  ↓
Browser stores JWT in localStorage
All future requests: Authorization: Bearer ${JWT}
```

### 2. OAuth 2.0 Flow (Microsoft/Google)

**HTTP verbs** align with [[SPEC_BACKEND.md]] §1 (`POST /auth/sso/init`, `POST /auth/sso/exchange`).

```
POST /auth/sso/init?provider=microsoft
  ↓
Backend:
  1. Generate random 32-char state
  2. Generate random 43-char PKCE code_challenge
  3. Store in USERS_KV (oauth_state:${state}, 10min TTL)
  4. Build authorize URL:
     https://login.microsoftonline.com/common/oauth2/v2.0/authorize
     ?client_id=${CLIENT_ID}
     &redirect_uri=https://qesto.com/auth/sso/callback
     &scope=openid+profile+email
     &response_type=code
     &state=${state}
     &code_challenge=${code_challenge}
  5. Redirect user
  ↓
User logs in to Microsoft
  ↓
Redirect back: /auth/sso/callback?code=X&state=Y
  ↓
Backend (then `POST /auth/sso/exchange` or handler wired from callback):
  1. Verify state (must match stored state)
  2. Exchange code for token (POST to Microsoft)
  3. Verify token signature (JWT)
  4. Extract email, name
  5. Lookup user by email, or create new
  6. Issue JWT (same as magic link)
  ↓
Redirect to /dashboard
```

**Client Configuration** (from `wrangler.toml`):
```toml
[env.production.vars]
OAUTH_MICROSOFT_CLIENT_ID = "abc123"
OAUTH_MICROSOFT_TENANT = "common"
OAUTH_GOOGLE_CLIENT_ID = "def456"
```

### 3. SAML 2.0 Flow (Enterprise)

```
GET /auth/sso/saml/login
  ↓
Backend:
  1. Generate random request ID
  2. Build AuthnRequest XML (SP-initiated)
  3. Sign with SAML_CERT
  4. Base64 encode + DEFLATE compress
  5. Redirect to IdP:
     https://idp.example.com/sso
     ?SAMLRequest=${encoded_request}
  ↓
User authenticates at IdP
  ↓
IdP redirects to ACS (assertion consumer service):
  POST /auth/sso/saml/acs
  SAMLResponse=${assertion}
  ↓
Backend:
  1. Decode SAMLResponse
  2. Verify signature (check against IdP cert)
  3. Check Destination (must match ACS URL)
  4. Extract NameID (email), Attributes (name, groups)
  5. Lookup user, or create + link to group
  6. Issue JWT
  ↓
Redirect to /dashboard
```

**SAML Metadata** (for IdP configuration):
```bash
GET /auth/sso/saml/metadata
  ↓
Returns XML with:
  - EntityID: https://qesto.com
  - AssertionConsumerService URL
  - SPSSODescriptor
  - NameID format
```

---

## Email Integration (Resend)

**File**: `functions/api/auth.ts`

**Service**: Resend API (RESEND_API_KEY)

### Magic Link Email

```typescript
async function sendMagicLink(email: string, token: string) {
  const link = `https://qesto.com/auth/callback?token=${token}`
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'noreply@qesto.com',
      to: email,
      subject: 'Your Qesto Magic Link',
      html: `
        <p>Click below to sign in:</p>
        <a href="${link}">Sign in to Qesto</a>
        <p>Link expires in 15 minutes.</p>
      `
    })
  })
  
  return res.json()
}
```

### Transactional Emails

```
Events triggering emails:
  - Magic link (auth.ts)
  - Password reset (auth.ts)
  - Team invite (teams.routes.ts)
  - Session results (sessionOrchestration.ts)
  - Invoice notification (stripe.ts)
  - Action item assigned (decisions.routes.ts)
```

---

## Slack Integration

**File**: `functions/api/routes/integrations.routes.ts`

### OAuth Setup

```
User clicks "Connect Slack"
  ↓
GET /integrations/slack/authorize   ← or `/integrations/:provider/authorize` per [[SPEC_BACKEND.md]] §8
  ↓
Backend:
  1. Generate random state
  2. Redirect to Slack OAuth:
     https://slack.com/oauth/v2/authorize
     ?client_id=${SLACK_CLIENT_ID}
     &scope=chat:write,commands
     &redirect_uri=https://qesto.com/integrations/slack/callback
  ↓
User approves at Slack
  ↓
GET /integrations/slack/callback?code=X&state=Y
  ↓
Backend:
  1. Exchange code for access token
  2. Store in USERS_KV (slack_token:${userId})
  3. Return to /dashboard?slack=connected
```

### Share Session to Slack

```
User clicks "Share to Slack"
  ↓
POST /integrations/slack/share {sessionId, channel}
  ↓
Backend:
  1. Lookup Slack token for user
  2. Format message with session results
  3. Post to Slack:
     POST https://slack.com/api/chat.postMessage
     token=${slack_token}
     channel=${channel}
     text="Session Results"
     blocks=[...rich formatting...]
  ↓
Message appears in Slack channel
```

---

## Teams, Zoom, Webex, Hopin

**File**: `functions/api/routes/integrations.routes.ts`

### Share Endpoints

```
POST /integrations/{teams|zoom|webex|hopin}/share
Authorization: Bearer ${JWT}

{
  "sessionId": "sess_abc123",
  "targetId": "channel_id or meeting_id"
}

Response:
{
  "data": {"ok": true, "url": "https://..."}
}
```

**Implementation Pattern**:
```typescript
// Register provider handlers
const providers = {
  'teams': {
    authorize: redirectToTeamsOAuth,
    share: shareToTeams
  },
  'zoom': {
    authorize: redirectToZoomOAuth,
    share: shareToZoom
  },
  // ...
}

app.post('/integrations/:provider/share', async (c) => {
  const provider = c.req.param('provider')
  const handler = providers[provider]?.share
  
  if (!handler) return c.json({error: 'Unknown provider'}, 400)
  
  return await handler(c)
})
```

---

## PowerPoint Integration

**File**: `functions/api/routes/integrations.routes.ts`

### Embed Slide

```
POST /integrations/powerpoint/embed
{
  "sessionId": "sess_abc123",
  "slideContent": "question + results"
}

Response:
{
  "data": {
    "slideId": "slide_abc123",
    "embedUrl": "https://pptx.example.com/..."
  }
}
```

### Duplicate Slide

```
POST /integrations/powerpoint/duplicate
{
  "sourceSlideId": "slide_abc123"
}

Response:
{
  "data": {
    "newSlideId": "slide_xyz789"
  }
}
```

---

## Vectorize (Semantic Search)

**File**: `functions/api/services/decisions.ts`

### Vector Index

```
Index: qesto-decisions
Dimensions: 768-d (Mistral embedding model)
Metric: cosine similarity
Binding: DECISIONS_VECTORIZE
```

### Embed Decision

```typescript
// Pseudocode — use official Workers AI embedding model → number[768] per Vectorize index
async function embedDecision(decision: Decision, env: Env) {
  const text = `${decision.selectedOption} ${decision.motivation ?? ''}`
  const vector: number[] = await runEmbeddingModel(env.AI, text) // 768 dims
  await env.DECISIONS_VECTORIZE.insert([{
    id: decision.id,
    values: vector,
    metadata: { teamId: decision.teamId, sessionId: decision.sessionId, createdAt: decision.createdAt },
  }])
}
```

### Semantic Search

```bash
GET /teams/:id/decisions/semantic-search?q=budget
Authorization: Bearer ${JWT}

Response:
{
  "data": {
    "results": [
      {id: "dec_abc", score: 0.92, selectedOption: "..."},
      {id: "dec_xyz", score: 0.85, selectedOption: "..."}
    ]
  }
}
```

---

## Environment Variables & Secrets

**Secrets** (via `wrangler pages secret put`):
```bash
RESEND_API_KEY=re_abc123xyz
STRIPE_SECRET_KEY=sk_live_abc123
STRIPE_WEBHOOK_SECRET=whsec_abc123
JWT_SECRET=random-256-bit-key
SAML_CERT=-----BEGIN CERTIFICATE-----
OAUTH_MICROSOFT_CLIENT_ID=abc123
OAUTH_MICROSOFT_CLIENT_SECRET=secret
OAUTH_GOOGLE_CLIENT_ID=def456
OAUTH_GOOGLE_CLIENT_SECRET=secret
SLACK_CLIENT_ID=slack_id
SLACK_CLIENT_SECRET=slack_secret
```

**Public Vars** (in `wrangler.toml`):
```toml
[env.production.vars]
STRIPE_PUBLIC_KEY = "pk_live_abc123"
OAUTH_MICROSOFT_TENANT = "common"
SAML_IdP_URL = "https://idp.example.com"
APP_URL = "https://qesto.com"
```

---

## AI usage recipe (copy)

1. “Stripe change” → **Webhook Handler** + D1 `stripe_webhook_events` in [[SPEC_DATAMODEL.md]].  
2. “OAuth bug” → **Authentication Flows** + [[SPEC_BACKEND.md]] §1 verbs.  
3. “AI quota” → **Rate Limiting** + [[SPEC_CORE.md#critical-constraints-hard-rules]].  

**Checklist:** No Node `crypto` snippets as prod code • OAuth **POST** init • embedding model matches **768** dims • Slack path matches parameterized integrations table.

---

## Related References

- [[SPEC_BACKEND.md]] — **§9 Billing**, **§8 Integrations**, **§4 AI**
- [[SPEC_CORE.md#authentication]] — Auth overview
