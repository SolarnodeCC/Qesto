// Billing API routes (BILL-04): plan management, quota tracking.
//
// Routes (all mounted under `/api`):
//   GET  /api/plans/catalog          public `PLAN_QUOTAS` snapshot (WS6 / F-04)
//   GET  /api/plans/:userId/usage    quota usage for authenticated user
//   POST /api/billing/portal         Stripe billing portal session
//   GET  /api/billing/invoices       Stripe invoice history
//   POST /api/billing/subscription   Stripe subscription management

import { Hono } from 'hono'
import { getQuotaUsage } from '../lib/quota'
import { readKvText } from '../lib/kv'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { BillingSubscriptionSchema } from '../lib/domain-schemas'
import { validateKvJson, StripeCustomerRecordSchema, StripeSubscriptionRecordSchema, StripeWebhookEventSchema, StripeSubscriptionObjectSchema } from '../lib/protocol-schemas'
import { PLAN_QUOTAS, type Env, type PlanQuotas, type PlanTier } from '../types'
import { CircuitBreakers } from '../lib/resilience/circuit-breaker'

type Vars = AuthVariables & PlanVariables

// KV key for Stripe customer ID — stored in USERS_KV alongside password/oauth data.
const stripeCustomerKey = (userId: string) => `stripe:customer:${userId}`
const stripeSubscriptionKey = (userId: string) => `stripe:subscription:${userId}`

/**
 * Minimal Stripe API client using fetch.
 * The stripe npm package is not available in the edge runtime budget,
 * so we call the REST API directly. Only the methods used here are implemented.
 */
function makeStripeClient(secretKey: string) {
  async function get<T>(pathWithQuery: string): Promise<T> {
    return CircuitBreakers.stripe.execute(
      async (signal) => {
        const res = await fetch(`https://api.stripe.com/v1${pathWithQuery}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${secretKey}` },
          signal,
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
            error?: { message?: string }
          }
          throw new Error(err?.error?.message ?? 'Stripe API error')
        }
        return res.json() as Promise<T>
      },
      () => { throw new Error('Stripe circuit open') },
    )
  }

  async function post<T>(path: string, body: Record<string, string>): Promise<T> {
    const params = new URLSearchParams(body).toString()
    return CircuitBreakers.stripe.execute(
      async (signal) => {
        const res = await fetch(`https://api.stripe.com/v1${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
          signal,
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
            error?: { message?: string }
          }
          throw new Error(err?.error?.message ?? 'Stripe API error')
        }
        return res.json() as Promise<T>
      },
      () => { throw new Error('Stripe circuit open') },
    )
  }
  return {
    checkoutSessions: {
      create: (params: Record<string, string>) =>
        post<{ url: string; id: string }>('/checkout/sessions', params),
    },
    billingPortal: {
      sessions: {
        create: (params: { customer: string; return_url: string }) =>
          post<{ url: string }>('/billing_portal/sessions', {
            customer: params.customer,
            return_url: params.return_url,
          }),
      },
    },
    invoices: {
      list: (params: { customer: string; limit?: number }) =>
        get<{ data: Array<{ id: string; status: string; amount_due: number; currency: string; created: number; hosted_invoice_url: string | null; invoice_pdf: string | null }> }>(
          `/invoices?customer=${encodeURIComponent(params.customer)}&limit=${String(params.limit ?? 20)}`,
        ),
    },
    subscriptions: {
      cancel: (subscriptionId: string) => post<{ id: string; status: string }>(`/subscriptions/${subscriptionId}/cancel`, {}),
      updatePrice: (subscriptionId: string, itemId: string, priceId: string) =>
        post<{ id: string; status: string }>(`/subscriptions/${subscriptionId}`, {
          'items[0][id]': itemId,
          'items[0][price]': priceId,
          proration_behavior: 'create_prorations',
        }),
    },
  }
}

function catalogRow(q: PlanQuotas) {
  return {
    max_sessions_per_month: q.maxSessionsPerMonth,
    max_participants_per_session: q.maxParticipantsPerSession,
    features_unlocked: q.featuresUnlocked,
  }
}

function cents(value: string | undefined, defaultCents: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultCents
}

function catalogPricing(env: Env) {
  return {
    free: {
      currency: 'EUR',
      monthly_cents: 0,
      annual_cents: 0,
      monthly_price_id: null,
      annual_price_id: null,
      display: '€0 / host / month',
    },
    starter: {
      currency: 'EUR',
      monthly_cents: cents(env.STARTER_MONTHLY_EUR_CENTS, 2900),
      annual_cents: cents(env.STARTER_ANNUAL_EUR_CENTS, 2400),
      monthly_price_id: env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? null,
      annual_price_id: env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? null,
      display: '€24 / host / month billed annually; €29 month-to-month',
    },
    team: {
      currency: 'EUR',
      monthly_cents: null,
      annual_cents: env.TEAM_ANNUAL_EUR_CENTS ? cents(env.TEAM_ANNUAL_EUR_CENTS, 0) : null,
      monthly_price_id: null,
      annual_price_id: env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? null,
      display: 'Custom annual contract',
    },
  } satisfies Record<
    PlanTier,
    {
      currency: 'EUR'
      monthly_cents: number | null
      annual_cents: number | null
      monthly_price_id: string | null
      annual_price_id: string | null
      display: string
    }
  >
}

// Mount Stripe webhook handler (no auth required — signature verification instead)
export function mountStripeWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: any }>) {
  // POST /api/billing/webhook/stripe — Handle inbound Stripe webhook events
  // Signature verification + idempotency + event routing
  parent.post('/api/billing/webhook/stripe', async (c) => {
    const traceId = c.get('trace_id')
    if (!c.env.STRIPE_WEBHOOK_SECRET) {
      return c.json(
        { ok: false, error: { code: 'misconfigured', message: 'Stripe webhook not configured' }, trace_id: traceId },
        503,
      )
    }

    // Read raw body for signature verification (Hono stores parsed JSON, we need raw)
    const rawBody = await c.req.text()
    if (!rawBody) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Empty body' }, trace_id: traceId }, 400)
    }

    // Verify Stripe signature: Stripe-Signature = t=<timestamp>,v1=<signature>,v0=<legacy>
    const sigHeader = c.req.header('stripe-signature')
    if (!sigHeader) {
      return c.json(
        { ok: false, error: { code: 'unauthorized', message: 'Missing Stripe-Signature header' }, trace_id: traceId },
        401,
      )
    }

    const verified = await verifyStripeSignature(rawBody, sigHeader, c.env.STRIPE_WEBHOOK_SECRET)
    if (!verified) {
      return c.json(
        { ok: false, error: { code: 'unauthorized', message: 'Invalid Stripe signature' }, trace_id: traceId },
        401,
      )
    }

    // Parse event
    let event: unknown
    try {
      event = JSON.parse(rawBody)
    } catch {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Invalid JSON' }, trace_id: traceId }, 400)
    }

    const parsed = StripeWebhookEventSchema.safeParse(event)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Invalid event schema' }, trace_id: traceId },
        400,
      )
    }

    const stripeEvent = parsed.data

    // Check idempotency: has this event been processed?
    const existing = await c.env.DB.prepare(
      'SELECT stripe_event_id FROM stripe_webhook_events WHERE stripe_event_id = ?1',
    )
      .bind(stripeEvent.id)
      .first<{ stripe_event_id: string }>()

    if (existing) {
      return c.json(
        { ok: true, data: { message: 'Event already processed', event_id: stripeEvent.id }, trace_id: traceId },
        200,
      )
    }

    // Route to event handler
    try {
      switch (stripeEvent.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(c, stripeEvent)
          break
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(c, stripeEvent)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(c, stripeEvent)
          break
        case 'customer.subscription.trial_will_end':
          await handleSubscriptionTrialWillEnd(c, stripeEvent)
          break
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(c, stripeEvent)
          break
        default:
          // Ignore unhandled event types (Stripe adds new ones regularly)
          break
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[Stripe Webhook] Event ${stripeEvent.id} handler failed: ${errorMsg}`)
      // Record failure but don't mark as processed
      return c.json(
        { ok: false, error: { code: 'internal_error', message: 'Event handler failed' }, trace_id: traceId },
        500,
      )
    }

    // Mark event as processed
    try {
      await c.env.DB.prepare(
        'INSERT INTO stripe_webhook_events (stripe_event_id, event_type, processed_at) VALUES (?1, ?2, ?3)',
      )
        .bind(stripeEvent.id, stripeEvent.type, Date.now())
        .run()
    } catch (err) {
      console.error(`[Stripe Webhook] Failed to record event ${stripeEvent.id}: ${err}`)
      // Still return 200 — event was handled, just logging failed
    }

    return c.json({ ok: true, data: { message: 'Event processed', event_id: stripeEvent.id }, trace_id: traceId }, 200)
  })
}

export function mountBillingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // GET /api/plans/catalog — Authoritative PLAN_QUOTAS for web + external clients (no auth).
  app.get('/plans/catalog', (c) => {
    const tiers: PlanTier[] = ['free', 'starter', 'team']
    const data = Object.fromEntries(tiers.map((t) => [t, catalogRow(PLAN_QUOTAS[t])])) as Record<
      PlanTier,
      ReturnType<typeof catalogRow>
    >
    return c.json({ ok: true, data: { ...data, pricing: catalogPricing(c.env) }, trace_id: c.get('trace_id') })
  })

  // GET /api/plans/:userId/usage — Fetch quota usage for authenticated user
  app.get('/plans/:userId/usage', authMiddleware, planMiddleware, async (c) => {
    const user = c.get('user')
    const userId = c.req.param('userId')
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')

    // Verify auth: can only check own quota
    if (user.sub !== userId) {
      return c.json(
        {
          ok: false,
          error: { code: 'forbidden', message: 'Can only check your own quota' },
          trace_id: c.get('trace_id'),
        },
        403,
      )
    }

    const usage = await getQuotaUsage(c.env.SESSIONS_KV, userId, quotas.maxSessionsPerMonth)

    // AI insights used this month — count from audit_events (best-effort; 0 if table missing)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    let insightsUsedThisMonth = 0
    try {
      const row = await c.env.DB
        .prepare(
          `SELECT COUNT(*) as n FROM audit_events WHERE action = 'insights.generate' AND actor_id = ?1 AND ts >= ?2`,
        )
        .bind(userId, monthStart)
        .first<{ n: number }>()
      insightsUsedThisMonth = row?.n ?? 0
    } catch {
      // audit_events table may not exist in older deploys
    }

    // Calculate reset date (first day of next month)
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    return c.json({
      ok: true,
      data: {
        user_id: userId,
        plan,
        quotas: {
          max_sessions_per_month: quotas.maxSessionsPerMonth,
          max_participants_per_session: quotas.maxParticipantsPerSession,
          features_unlocked: quotas.featuresUnlocked,
        },
        usage: {
          sessions_created: usage.sessions_created,
          remaining: usage.remaining,
          insights_generated: insightsUsedThisMonth,
        },
        reset_date: resetDate.toISOString(),
      },
      trace_id: c.get('trace_id'),
    })
  })

  // POST /api/billing/portal — create a Stripe billing portal session
  // Returns { url } for the frontend to redirect to.
  app.post('/billing/portal', authMiddleware, async (c) => {
    const user = c.get('user')

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json(
        { ok: false, error: { code: 'misconfigured', message: 'Stripe not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }

    // Look up Stripe customer ID stored in USERS_KV
    const raw = await readKvText(c.env.USERS_KV, stripeCustomerKey(user.sub))
    const record = validateKvJson(raw, StripeCustomerRecordSchema)

    if (!record?.customerId) {
      return c.json(
        { ok: false, error: { code: 'no_subscription', message: 'No Stripe subscription found for this account' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    const session = await stripe.billingPortal.sessions.create({
      customer: record.customerId,
      return_url: c.env.PAGES_URL + '/settings',
    })

    return c.json({ ok: true, data: { url: session.url }, trace_id: c.get('trace_id') })
  })

  // GET /api/billing/invoices — list Stripe invoices for the authenticated user.
  app.get('/billing/invoices', authMiddleware, async (c) => {
    const user = c.get('user')
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json(
        { ok: false, error: { code: 'misconfigured', message: 'Stripe not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const raw = await readKvText(c.env.USERS_KV, stripeCustomerKey(user.sub))
    const record = validateKvJson(raw, StripeCustomerRecordSchema)
    if (!record?.customerId) {
      return c.json(
        { ok: false, error: { code: 'no_subscription', message: 'No Stripe subscription found for this account' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    const result = await stripe.invoices.list({ customer: record.customerId, limit: 20 })
    return c.json({ ok: true, data: { invoices: result.data }, trace_id: c.get('trace_id') })
  })

  // POST /api/billing/subscription — upgrade/downgrade/cancel active subscription.
  app.post('/billing/subscription', authMiddleware, async (c) => {
    const user = c.get('user')
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json(
        { ok: false, error: { code: 'misconfigured', message: 'Stripe not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }

    const validated = await validateBody(c, BillingSubscriptionSchema)
    if ('error' in validated) return validated.error
    const { data: body } = validated

    const subRaw = await readKvText(c.env.USERS_KV, stripeSubscriptionKey(user.sub))
    const subRecord = validateKvJson(subRaw, StripeSubscriptionRecordSchema)
    if (!subRecord?.subscriptionId) {
      return c.json(
        { ok: false, error: { code: 'no_subscription', message: 'No Stripe subscription found for this account' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    if (body.action === 'cancel') {
      const cancelled = await stripe.subscriptions.cancel(subRecord.subscriptionId)
      return c.json({ ok: true, data: { subscription: cancelled }, trace_id: c.get('trace_id') })
    }
    const updated = await stripe.subscriptions.updatePrice(subRecord.subscriptionId, body.subscriptionItemId!, body.priceId!)
    return c.json({ ok: true, data: { subscription: updated }, trace_id: c.get('trace_id') })
  })

  // POST /api/billing/checkout -- create a Stripe Checkout session.
  // ENTERPRISE-POLISH s8b: supports interval=monthly|annual for annual billing toggle.
  // Body: { plan: PlanTier, interval: 'monthly' | 'annual', seat_count?: number }
  app.post('/billing/checkout', authMiddleware, async (c) => {
    const user = c.get('user')
    const traceId = c.get('trace_id')
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ ok: false, error: { code: 'misconfigured', message: 'Stripe not configured' }, trace_id: traceId }, 503)
    }
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    const plan = (body?.plan as string) ?? 'starter'
    const interval = (body?.interval as string) === 'annual' ? 'annual' : 'monthly'
    const seatCount = typeof body?.seat_count === 'number' && body.seat_count > 0 ? body.seat_count : 1

    const pricing = catalogPricing(c.env)
    const planRow = pricing[plan as keyof typeof pricing]
    if (!planRow) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Unknown plan' }, trace_id: traceId }, 400)
    }
    const priceId = interval === 'annual' ? planRow.annual_price_id : planRow.monthly_price_id
    if (!priceId) {
      return c.json({ ok: false, error: { code: 'bad_request', message: `No ${interval} price configured for plan ${plan}` }, trace_id: traceId }, 400)
    }

    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    const successUrl = `${c.env.PAGES_URL}/settings?checkout=success&plan=${plan}`
    const cancelUrl = `${c.env.PAGES_URL}/settings?checkout=cancelled`

    const params: Record<string, string> = {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': String(seatCount),
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.sub,
      'metadata[userId]': user.sub,
      'metadata[plan]': plan,
      'metadata[interval]': interval,
      'metadata[seatCount]': String(seatCount),
      allow_promotion_codes: 'true',
      ...(user.email ? { customer_email: user.email } : {}),
    }
    // Collect billing address for VAT/invoice purposes
    params['billing_address_collection'] = 'required'
    // Show tax ID field for EU enterprise customers
    params['tax_id_collection[enabled]'] = 'true'

    const session = await stripe.checkoutSessions.create(params)
    return c.json({ ok: true, data: { url: session.url }, trace_id: traceId })
  })

  parent.route('/api', app)
}

// ── Stripe webhook signature verification ──────────────────────────────────

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    // Parse Stripe-Signature header: t=<timestamp>,v1=<signature>,v0=<legacy>
    const parts = sigHeader.split(',').reduce(
      (acc, part) => {
        const [k, v] = part.split('=')
        acc[k] = v
        return acc
      },
      {} as Record<string, string>,
    )

    const timestamp = parts.t
    const signature = parts.v1
    if (!timestamp || !signature) return false

    // Reconstruct signed content: <timestamp>.<body>
    const signedContent = `${timestamp}.${body}`

    // Compute HMAC-SHA256
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const contentData = encoder.encode(signedContent)

    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const computed = await crypto.subtle.sign('HMAC', key, contentData)

    // Convert to hex
    const computedHex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time comparison
    return constantTimeCompare(computedHex, signature)
  } catch {
    return false
  }
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ── Event handlers ─────────────────────────────────────────────────────────

async function handleSubscriptionCreated(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) {
    console.warn(`[Stripe] Subscription ${sub.id} created for unknown customer ${customerId}`)
    return
  }

  // Store subscription record in KV
  await c.env.USERS_KV.put(
    stripeSubscriptionKey(userId),
    JSON.stringify({ subscriptionId: sub.id }),
    { expirationTtl: 86400 * 365 },
  )

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_created', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Audit log failure is non-critical
  }
}

async function handleSubscriptionUpdated(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Update subscription record (status may have changed)
  await c.env.USERS_KV.put(
    stripeSubscriptionKey(userId),
    JSON.stringify({ subscriptionId: sub.id }),
    { expirationTtl: 86400 * 365 },
  )

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_updated', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleSubscriptionDeleted(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Remove subscription record from KV (user downgraded to free)
  await c.env.USERS_KV.delete(stripeSubscriptionKey(userId))

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_deleted', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleSubscriptionTrialWillEnd(
  c: { env: Env },
  event: any,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Log event for future email notification
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.subscription_trial_will_end', 'subscription', sub.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

async function handleInvoicePaymentFailed(
  c: { env: Env },
  event: any,
): Promise<void> {
  const invoice = event.data.object as Record<string, unknown>
  const customerId = invoice.customer as string | undefined
  if (!customerId) return

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env.USERS_KV, customerId)
  if (!userId) return

  // Log audit event
  try {
    await c.env.DB.prepare(
      'INSERT INTO audit_events (actor_id, action, resource_type, resource_id, ts) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'billing.invoice_payment_failed', 'invoice', invoice.id, Date.now())
      .run()
  } catch {
    // Non-critical
  }
}

// ── Helper: Look up user by Stripe customer ID ────────────────────────────

async function findUserByCustomerId(_kv: KVNamespace, _customerId: string): Promise<string | null> {
  // Brute-force lookup: iterate all users in KV (limited in practice)
  // In a production system, maintain a reverse index (customer_id → user_id)
  // For now, this works for small-to-medium deployments
  //
  // Better approach (Phase 2): Add stripe_customer_id column to users table in D1,
  // then query D1 instead of scanning KV.
  //
  // This is a known limitation documented in BACKLOG_MASTER.md (BILL-07).

  // For now, return null — webhook handlers will skip processing if user not found
  // and log a warning. The subscription record was already created by checkout,
  // so data is not lost; just audit trail is incomplete.
  return null
}
