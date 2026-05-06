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
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { PLAN_QUOTAS, type Env, type PlanQuotas, type PlanTier } from '../types'

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
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(`https://api.stripe.com/v1${pathWithQuery}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: ac.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
        error?: { message?: string }
      }
      throw new Error(err?.error?.message ?? 'Stripe API error')
    }
    return res.json() as Promise<T>
  }

  async function post<T>(path: string, body: Record<string, string>): Promise<T> {
    const params = new URLSearchParams(body).toString()
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(`https://api.stripe.com/v1${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: ac.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: { message: 'Stripe error' } }))) as {
        error?: { message?: string }
      }
      throw new Error(err?.error?.message ?? 'Stripe API error')
    }
    return res.json() as Promise<T>
  }
  return {
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

function cents(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
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
    const raw = await c.env.USERS_KV.get(stripeCustomerKey(user.sub))
    const record = raw ? (JSON.parse(raw) as { customerId: string }) : null

    if (!record?.customerId) {
      return c.json(
        { ok: false, error: { code: 'no_subscription', message: 'No Stripe subscription found for this account' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
    const session = await stripe.billingPortal.sessions.create({
      customer: record.customerId,
      return_url: c.env.PAGES_URL + '/dashboard',
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
    const raw = await c.env.USERS_KV.get(stripeCustomerKey(user.sub))
    const record = raw ? (JSON.parse(raw) as { customerId: string }) : null
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
    const body = (await c.req.json().catch(() => null)) as { action?: 'upgrade' | 'downgrade' | 'cancel'; priceId?: string; subscriptionItemId?: string } | null
    if (!body?.action) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'action is required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const subRaw = await c.env.USERS_KV.get(stripeSubscriptionKey(user.sub))
    const subRecord = subRaw ? (JSON.parse(subRaw) as { subscriptionId: string }) : null
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
    if (!body.priceId || !body.subscriptionItemId) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'priceId and subscriptionItemId are required for upgrade/downgrade' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const updated = await stripe.subscriptions.updatePrice(subRecord.subscriptionId, body.subscriptionItemId, body.priceId)
    return c.json({ ok: true, data: { subscription: updated }, trace_id: c.get('trace_id') })
  })

  parent.route('/api', app)
}
