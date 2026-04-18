---
name: integrating-backend-services
description: External integration patterns for Qesto backend: Stripe webhooks, Workers AI, Resend email, Vectorize, and meeting platform OAuth. Use when implementing or debugging Stripe billing, AI inference, email sending, semantic search, or meeting integrations.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

Referenced from [backend-dev.md](backend-dev.md). Load when working on external service integrations.

## Workers AI (only approved provider)

```typescript
const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [
    { role: 'system', content: 'You are a session facilitator assistant.' },
    { role: 'user', content: prompt }
  ]
}) as { response: string }
```

Rate limits: 10 req/min (free), 50 req/min (pro). Response time: 2–8s — always async.

## Stripe

### Webhook Verification (CRITICAL — never skip)

```typescript
// Use SubtleCrypto — not Node.js crypto (unavailable in Workers)
myRoutes.post('/stripe/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Missing signature' }, 401)
  const rawBody = await c.req.text()
  // Use stripe.webhooks.constructEventAsync() or SubtleCrypto HMAC verify
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  c.executionCtx.waitUntil(handleStripeEvent(event, c.env))
  return c.json({ received: true })
})
```

### Stripe API Version

Always pin via header:
```typescript
headers: { 'Stripe-Version': '2026-03-25.dahlia' }
```

### Webhook Handler Pattern

```typescript
async function handleStripeEvent(event: StripeEvent, env: Env) {
  // 1. Deduplicate by event ID
  const seen = await env.KV.get(`webhook-event:${event.id}`)
  if (seen) return
  await env.KV.put(`webhook-event:${event.id}`, 'true', { expirationTtl: 86400 })

  // 2. Process
  switch (event.type) {
    case 'checkout.session.completed': ...
    case 'customer.subscription.deleted': ...
    default: console.log(`Unhandled: ${event.type}`) // Still return 200
  }
}
```

**Rules:** Verify signature first · Return 200 immediately · Process via `waitUntil()` · Deduplicate by event ID · Return 200 for unknown event types.

## Resend Email

```typescript
import { sendEmail } from '../auth'
await sendEmail(c.env.RESEND_API_KEY, {
  to: user.email,
  subject: 'Your magic link',
  html: `<a href="${link}">Sign in</a>`
})
```

Webhook verification: `X-Resend-Signature` header — same SubtleCrypto HMAC pattern as Stripe.

## Meeting Integrations (Zoom / Teams / Webex)

```typescript
// All three share the same OAuth2 PKCE flow
const token = await exchangeOAuthCode(code, {
  clientId:     c.env.ZOOM_CLIENT_ID,
  clientSecret: c.env.ZOOM_CLIENT_SECRET,
  redirectUri:  `${c.env.APP_URL}/auth/zoom/callback`,
})
// Token storage: USERS_KV `integrations:{userId}:{provider}`
// Refresh: check expiry before each API call, refresh if < 5min remaining
```

## Vectorize (Decisions)

```typescript
// Insert embedding
await c.env.DECISIONS_VECTORIZE.insert([{
  id:       decisionId,
  values:   embedding,   // float32[], 768d
  metadata: { teamId, sessionId },
}])

// Semantic search
const results = await c.env.DECISIONS_VECTORIZE.query(queryEmbedding, {
  topK: 10,
  filter: { teamId },
})
```

## General Webhook Best Practices

1. Verify signature first (timing-safe)
2. Return 200 immediately — process async via `waitUntil()`
3. Deduplicate by event ID (KV with 24h TTL)
4. Log every webhook — aids debugging
5. Handle unknown event types gracefully — return 200, log, ignore
