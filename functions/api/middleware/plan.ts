// Plan middleware (BILL-04): Fetch user's plan from DB and set on context.
// Downstream routes use c.get('plan') to check feature availability.

import type { MiddlewareHandler } from 'hono'
import type { Env, PlanTier, PLAN_QUOTAS } from '../types'
import { PLAN_QUOTAS as QUOTAS_MAP } from '../types'

export type PlanVariables = {
  plan: PlanTier
  planQuotas: (typeof QUOTAS_MAP)[PlanTier]
}

export const planMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: PlanVariables }> = async (
  c,
  next,
) => {
  const user = c.get('user')
  if (!user) {
    // Auth middleware should have run first; if no user, auth failed elsewhere
    return c.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Not authenticated' } })
  }

  // Fetch user's plan from D1
  const result = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?1').bind(user.sub).first<{ plan: PlanTier }>()

  const plan = result?.plan ?? 'free'

  // Set plan and quotas on context for downstream routes
  c.set('plan', plan)
  c.set('planQuotas', QUOTAS_MAP[plan])

  await next()
}
