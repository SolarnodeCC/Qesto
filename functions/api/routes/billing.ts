// Billing API routes (BILL-04): plan management, quota tracking.
//
// Routes:
//   GET  /api/plans/:userId/usage    fetch quota usage for a user
//   POST /api/billing/portal         create a Stripe billing portal session

import { Hono } from 'hono'
import { getQuotaUsage } from '../lib/quota'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

// KV key for Stripe customer ID — stored in USERS_KV alongside password/oauth data.
const stripeCustomerKey = (userId: string) => `stripe:customer:${userId}`

/**
 * Minimal Stripe API client using fetch.
 * The stripe npm package is not available in the edge runtime budget,
 * so we call the REST API directly. Only the methods used here are implemented.
 */
function makeStripeClient(secretKey: string) {
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
  }
}

export function mountBillingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

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

  parent.route('/api', app)
}
