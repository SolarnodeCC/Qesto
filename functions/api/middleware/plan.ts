// Plan middleware (BILL-04): Fetch user's plan from DB and set on context.
// Downstream routes use c.get('plan') to check feature availability.

import type { MiddlewareHandler } from 'hono'
import type { Env, PlanTier } from '../types'
import { PLAN_QUOTAS as QUOTAS_MAP } from '../types'
import type { AuthVariables } from './auth'


export type PlanVariables = {
  plan: PlanTier
  planQuotas: (typeof QUOTAS_MAP)[PlanTier]
}

export const planMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables & PlanVariables }> = async (
  c,
  next,
) => {
  const user = c.get('user')
  if (!user) {
    // Auth middleware should have run first; if no user, auth failed elsewhere
    return c.json({ ok: false, error: { code: 'unauthorized', message: 'Not authenticated' } }, 401)
  }

  if (c.env.SUPERUSER_EMAIL && user.email === c.env.SUPERUSER_EMAIL) {
    c.set('plan', 'team')
    c.set('planQuotas', { ...QUOTAS_MAP['team'], maxSessionsPerMonth: Number.MAX_SAFE_INTEGER })
    await next()
    return
  }

  // Fetch user's plan from D1
  const result = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?1').bind(user.sub).first<{ plan: PlanTier }>()

  const plan = result?.plan ?? 'free'

  // Set plan and quotas on context for downstream routes
  c.set('plan', plan)
  c.set('planQuotas', QUOTAS_MAP[plan])

  await next()
}
