// Billing REST routes (BILL-04): plan catalog, quota usage, Stripe portal/invoices/subscription/checkout.
//
// Routes (all mounted under `/api`):
//   GET  /api/plans/catalog          public `PLAN_QUOTAS` snapshot (WS6 / F-04)
//   GET  /api/plans/:userId/usage    quota usage for authenticated user
//   POST /api/billing/portal         Stripe billing portal session
//   GET  /api/billing/invoices       Stripe invoice history
//   POST /api/billing/subscription   Stripe subscription management
//   POST /api/billing/checkout       Stripe Checkout session

import { Hono } from 'hono'
import { getQuotaUsage } from '../../lib/quota'
import { readKvText } from '../../lib/kv'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import { validateBody } from '../../lib/request-validation'
import { BillingSubscriptionSchema } from '../../lib/domain-schemas'
import { validateKvJson, StripeCustomerRecordSchema, StripeSubscriptionRecordSchema } from '../../lib/protocol-schemas'
import type { Env } from '../../types'
import { makeStripeClient } from './stripe-client'
import {
  catalogPricing,
  planCatalog,
  stripeCustomerKey,
  stripeSubscriptionKey,
  type Vars,
} from './shared'

export function mountBillingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // GET /api/plans/catalog — Authoritative PLAN_QUOTAS for web + external clients (no auth).
  app.get('/plans/catalog', (c) => {
    return c.json({ ok: true, data: { ...planCatalog(), pricing: catalogPricing(c.env) }, trace_id: c.get('trace_id') })
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
