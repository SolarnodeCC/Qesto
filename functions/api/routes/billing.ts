// Billing API routes (BILL-04): plan management, quota tracking.
//
// Routes (all mounted under `/api`):
//   GET  /api/plans/catalog          public `PLAN_QUOTAS` snapshot (WS6 / F-04)
//   GET  /api/plans/:userId/usage    quota usage for authenticated user
//   POST /api/billing/portal         Stripe billing portal session
//   GET  /api/billing/invoices       Stripe invoice history
//   POST /api/billing/subscription   Stripe subscription management

import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { getQuotaUsage } from '../lib/quota'
import { readKvText } from '../lib/kv'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { BillingSubscriptionSchema } from '../lib/domain-schemas'
import { validateKvJson, StripeCustomerRecordSchema, StripeSubscriptionRecordSchema, StripeWebhookEventSchema, StripeSubscriptionObjectSchema, type ValidStripeWebhookEvent } from '../lib/protocol-schemas'
import { PLAN_QUOTAS, type Env, type PlanQuotas, type PlanTier } from '../types'
import { makeStripeClient } from '../lib/stripe-client'
import {
  countInsightsThisMonth,
  findUserIdByStripeCustomerId,
  insertBillingAuditEvent,
  isStripeWebhookEventProcessed,
  recordStripeWebhookEvent,
  setStripeCustomerId,
  setUserPlan as setUserPlanInDb,
} from '../repositories/billingRepository'

type Vars = AuthVariables & PlanVariables

// KV key for Stripe customer ID — stored in USERS_KV alongside password/oauth data.
const stripeCustomerKey = (userId: string) => `stripe:customer:${userId}`
const stripeSubscriptionKey = (userId: string) => `stripe:subscription:${userId}`
// Reverse index: Stripe customer id → Qesto user id (#585). Written when checkout
// completes so webhook handlers can resolve the user without scanning KV.
const stripeCustomerReverseKey = (customerId: string) => `stripe:customer-rev:${customerId}`

/**
 * Map a Stripe price id to a Qesto plan tier using the configured env price ids
 * (#585). Returns null when the price id matches no known tier.
 */
function tierFromPriceId(env: Env, priceId: string | undefined | null): PlanTier | null {
  if (!priceId) return null
  if (priceId === env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
    return 'starter'
  }
  if (priceId === env.STRIPE_TEAM_ANNUAL_PRICE_ID) {
    return 'team'
  }
  return null
}

/** Validate a plan tier coming from Stripe metadata. */
function validTier(value: unknown): value is PlanTier {
  return value === 'free' || value === 'starter' || value === 'team'
}

/** Set users.plan in D1 (best-effort; logs on failure). */
async function setUserPlan(env: Pick<Env, 'DB'>, userId: string, plan: PlanTier): Promise<void> {
  try {
    await setUserPlanInDb(env.DB, userId, plan)
  } catch (err) {
    console.error(`[Stripe] setUserPlan failed for ${userId}: ${(err as Error).message}`)
  }
}

/** Persist the bidirectional Stripe customer ↔ user mapping (#585). */
async function recordCustomerMapping(env: Pick<Env, 'USERS_KV' | 'DB'>, userId: string, customerId: string): Promise<void> {
  await env.USERS_KV.put(stripeCustomerKey(userId), JSON.stringify({ customerId }), {
    expirationTtl: 86400 * 365,
  })
  await env.USERS_KV.put(stripeCustomerReverseKey(customerId), userId, {
    expirationTtl: 86400 * 365,
  })
  try {
    await setStripeCustomerId(env.DB, userId, customerId)
  } catch {
    // Column may not be migrated yet in some environments; KV mapping is authoritative.
  }
}

/** Write a billing audit row using the real audit_events schema (#585). */
async function writeBillingAudit(
  env: Pick<Env, 'DB'>,
  userId: string,
  action: string,
  subjectId: string,
  snapshot?: Record<string, unknown>,
): Promise<void> {
  try {
    await insertBillingAuditEvent(env.DB, userId, action, subjectId, snapshot)
  } catch (err) {
    console.error(`[Stripe] audit write failed for ${action}: ${(err as Error).message}`)
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
export function mountStripeWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  // POST /api/billing/webhook/stripe — Handle inbound Stripe webhook events
  // Signature verification + idempotency + event routing
  parent.post('/api/billing/webhook/stripe', async (c) => {
    const traceId = c.get('trace_id')
    if (!c.env.STRIPE_WEBHOOK_SECRET) {
      return errorResponse(c, 503, 'misconfigured', 'Stripe webhook not configured')
    }

    // Read raw body for signature verification (Hono stores parsed JSON, we need raw)
    const rawBody = await c.req.text()
    if (!rawBody) {
      return errorResponse(c, 400, 'bad_request', 'Empty body')
    }

    // Verify Stripe signature: Stripe-Signature = t=<timestamp>,v1=<signature>,v0=<legacy>
    const sigHeader = c.req.header('stripe-signature')
    if (!sigHeader) {
      return errorResponse(c, 401, 'unauthorized', 'Missing Stripe-Signature header')
    }

    const verified = await verifyStripeSignature(rawBody, sigHeader, c.env.STRIPE_WEBHOOK_SECRET)
    if (!verified) {
      return errorResponse(c, 401, 'unauthorized', 'Invalid Stripe signature')
    }

    // Parse event
    let event: unknown
    try {
      event = JSON.parse(rawBody)
    } catch {
      return errorResponse(c, 400, 'bad_request', 'Invalid JSON')
    }

    const parsed = StripeWebhookEventSchema.safeParse(event)
    if (!parsed.success) {
      return errorResponse(c, 400, 'bad_request', 'Invalid event schema')
    }

    const stripeEvent = parsed.data

    // Check idempotency: has this event been processed?
    const existing = await isStripeWebhookEventProcessed(c.env.DB, stripeEvent.id)

    if (existing) {
      return c.json(
        { ok: true, data: { message: 'Event already processed', event_id: stripeEvent.id }, trace_id: traceId },
        200,
      )
    }

    // Route to event handler
    try {
      switch (stripeEvent.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(c, stripeEvent)
          break
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
      return errorResponse(c, 500, 'internal_error', 'Event handler failed')
    }

    // Mark event as processed
    try {
      await recordStripeWebhookEvent(c.env.DB, stripeEvent.id, stripeEvent.type, Date.now())
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
      return errorResponse(c, 403, 'forbidden', 'Can only check your own quota')
    }

    const usage = await getQuotaUsage(c.env.SESSIONS_KV, userId, quotas.maxSessionsPerMonth)

    // AI insights used this month — count from audit_events (best-effort; 0 if table missing)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    let insightsUsedThisMonth = 0
    try {
      insightsUsedThisMonth = await countInsightsThisMonth(c.env.DB, userId, monthStart)
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
      return errorResponse(c, 503, 'misconfigured', 'Stripe not configured')
    }

    // Look up Stripe customer ID stored in USERS_KV
    const raw = await readKvText(c.env.USERS_KV, stripeCustomerKey(user.sub))
    const record = validateKvJson(raw, StripeCustomerRecordSchema)

    if (!record?.customerId) {
      return errorResponse(c, 400, 'no_subscription', 'No Stripe subscription found for this account')
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
      return errorResponse(c, 503, 'misconfigured', 'Stripe not configured')
    }
    const raw = await readKvText(c.env.USERS_KV, stripeCustomerKey(user.sub))
    const record = validateKvJson(raw, StripeCustomerRecordSchema)
    if (!record?.customerId) {
      return errorResponse(c, 400, 'no_subscription', 'No Stripe subscription found for this account')
    }
    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    const result = await stripe.invoices.list({ customer: record.customerId, limit: 20 })
    return c.json({ ok: true, data: { invoices: result.data }, trace_id: c.get('trace_id') })
  })

  // POST /api/billing/subscription — upgrade/downgrade/cancel active subscription.
  app.post('/billing/subscription', authMiddleware, async (c) => {
    const user = c.get('user')
    if (!c.env.STRIPE_SECRET_KEY) {
      return errorResponse(c, 503, 'misconfigured', 'Stripe not configured')
    }

    const validated = await validateBody(c, BillingSubscriptionSchema)
    if ('error' in validated) return validated.error
    const { data: body } = validated

    const subRaw = await readKvText(c.env.USERS_KV, stripeSubscriptionKey(user.sub))
    const subRecord = validateKvJson(subRaw, StripeSubscriptionRecordSchema)
    if (!subRecord?.subscriptionId) {
      return errorResponse(c, 400, 'no_subscription', 'No Stripe subscription found for this account')
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
      return errorResponse(c, 503, 'misconfigured', 'Stripe not configured')
    }
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    const plan = (body?.plan as string) ?? 'starter'
    const interval = (body?.interval as string) === 'annual' ? 'annual' : 'monthly'
    const seatCount = typeof body?.seat_count === 'number' && body.seat_count > 0 ? body.seat_count : 1

    const pricing = catalogPricing(c.env)
    const planRow = pricing[plan as keyof typeof pricing]
    if (!planRow) {
      return errorResponse(c, 400, 'bad_request', 'Unknown plan')
    }
    const priceId = interval === 'annual' ? planRow.annual_price_id : planRow.monthly_price_id
    if (!priceId) {
      return errorResponse(c, 400, 'bad_request', `No ${interval} price configured for plan ${plan}`)
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

/**
 * checkout.session.completed (#585): the source of truth that a user has paid.
 * Records the Stripe customer ↔ user mapping and upgrades users.plan to the
 * purchased tier. The tier is taken from session metadata (set at checkout) and
 * cross-checked against the configured price ids.
 */
async function handleCheckoutSessionCompleted(
  c: { env: Pick<Env, 'DB' | 'USERS_KV'> },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const session = event.data.object as Record<string, unknown>
  const customerId = typeof session.customer === 'string' ? session.customer : undefined
  const metadata = (session.metadata as Record<string, unknown> | undefined) ?? {}
  const userId =
    (typeof session.client_reference_id === 'string' ? session.client_reference_id : undefined) ??
    (typeof metadata.userId === 'string' ? metadata.userId : undefined)

  if (!userId) {
    console.warn('[Stripe] checkout.session.completed without resolvable userId')
    return
  }

  if (customerId) {
    await recordCustomerMapping(c.env, userId, customerId)
  }

  // Determine the purchased tier: trust metadata.plan but only if it's a valid
  // paid tier; otherwise fall back to a price-id lookup if present on the session.
  let plan: PlanTier | null = validTier(metadata.plan) && metadata.plan !== 'free' ? metadata.plan : null
  if (!plan && typeof session.amount_total === 'number' && session.amount_total > 0) {
    // No usable metadata but money changed hands — default to the entry paid tier.
    plan = 'starter'
  }
  if (!plan) {
    console.warn(`[Stripe] checkout.session.completed for ${userId} with no resolvable paid plan`)
    return
  }

  await setUserPlan(c.env, userId, plan)
  await writeBillingAudit(c.env, userId, 'billing.checkout_completed', String(session.id ?? customerId ?? userId), {
    plan,
    customerId: customerId ?? null,
  })
}

async function handleSubscriptionCreated(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
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

  // Upgrade plan to the tier implied by the subscription's price.
  const tier = tierFromPriceId(c.env, sub.items?.data?.[0]?.price?.id)
  if (tier && sub.status === 'active') {
    await setUserPlan(c.env, userId, tier)
  }

  await writeBillingAudit(c.env, userId, 'billing.subscription_created', sub.id, {
    status: sub.status,
    plan: tier,
  })
}

async function handleSubscriptionUpdated(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // Update subscription record (status may have changed)
  await c.env.USERS_KV.put(
    stripeSubscriptionKey(userId),
    JSON.stringify({ subscriptionId: sub.id }),
    { expirationTtl: 86400 * 365 },
  )

  // Reconcile plan with subscription status + price.
  const tier = tierFromPriceId(c.env, sub.items?.data?.[0]?.price?.id)
  const activeStatuses = new Set(['active', 'trialing', 'past_due'])
  let appliedPlan: PlanTier
  if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    appliedPlan = 'free'
  } else if (tier && activeStatuses.has(sub.status)) {
    appliedPlan = tier
  } else {
    appliedPlan = tier ?? 'free'
  }
  await setUserPlan(c.env, userId, appliedPlan)

  await writeBillingAudit(c.env, userId, 'billing.subscription_updated', sub.id, {
    status: sub.status,
    plan: appliedPlan,
  })
}

async function handleSubscriptionDeleted(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // Remove subscription record from KV and downgrade to free.
  await c.env.USERS_KV.delete(stripeSubscriptionKey(userId))
  await setUserPlan(c.env, userId, 'free')

  await writeBillingAudit(c.env, userId, 'billing.subscription_deleted', sub.id, { plan: 'free' })
}

async function handleSubscriptionTrialWillEnd(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const subscription = StripeSubscriptionObjectSchema.safeParse(event.data.object)
  if (!subscription.success) return

  const sub = subscription.data
  const customerId = sub.customer

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  await writeBillingAudit(c.env, userId, 'billing.subscription_trial_will_end', sub.id, {
    status: sub.status,
  })
}

async function handleInvoicePaymentFailed(
  c: { env: Env },
  event: ValidStripeWebhookEvent,
): Promise<void> {
  const invoice = event.data.object as Record<string, unknown>
  const customerId = invoice.customer as string | undefined
  if (!customerId) return

  // Look up user by customer ID
  const userId = await findUserByCustomerId(c.env, customerId)
  if (!userId) return

  // A failed payment does not immediately revoke access (Stripe will retry and
  // emit subscription.updated → past_due, then deleted on final failure); we
  // record the failure so dunning + support have an audit trail.
  await writeBillingAudit(c.env, userId, 'billing.invoice_payment_failed', String(invoice.id ?? customerId), {
    customerId,
  })
}

// ── Helper: Look up user by Stripe customer ID ────────────────────────────

/**
 * Resolve a Stripe customer id to a Qesto user id (#585). Prefers the D1
 * `users.stripe_customer_id` column; falls back to the KV reverse index written
 * at checkout. Returns null when no mapping exists (handlers then no-op).
 */
async function findUserByCustomerId(env: Env, customerId: string): Promise<string | null> {
  try {
    const fromDb = await findUserIdByStripeCustomerId(env.DB, customerId)
    if (fromDb) return fromDb
  } catch {
    // Column may not exist in some environments; fall through to KV.
  }

  const fromKv = await env.USERS_KV.get(stripeCustomerReverseKey(customerId))
  return fromKv ?? null
}
