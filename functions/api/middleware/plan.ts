// Plan middleware stub. v1 is single-plan (free); BILL-04 introduces real
// plan gating later. Keeping this in the middleware stack now means routes
// don't change shape when billing lands.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'

export type PlanTier = 'free' | 'starter' | 'team'

export type PlanVariables = {
  plan: PlanTier
}

export const planMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: PlanVariables }> = async (c, next) => {
  c.set('plan', 'free')
  await next()
}
