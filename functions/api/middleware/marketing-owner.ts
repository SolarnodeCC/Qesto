// Marketing-owner middleware — single-owner gate for the Marketing Automation
// dashboard/API. Unlike adminMiddleware, this checks ONLY SUPERUSER_EMAIL —
// no SEED_ADMIN_EMAIL bypass, no platform_roles DB fallback. The marketing
// surface is an internal tool for one operator, and widening access via the
// platform-admin allowlist (granted for unrelated ops work) is exactly what
// this middleware exists to avoid. Fails closed (403) if SUPERUSER_EMAIL is unset.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'

export type MarketingOwnerVariables = {
  isMarketingOwner: true
}

export const marketingOwnerMiddleware: MiddlewareHandler<{
  Bindings: Env
  Variables: AuthVariables & MarketingOwnerVariables
}> = async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Authentication required' },
        trace_id: c.get('trace_id'),
      },
      401,
    )
  }

  if (!c.env.SUPERUSER_EMAIL || user.email !== c.env.SUPERUSER_EMAIL) {
    return c.json(
      {
        ok: false,
        error: { code: 'forbidden', message: 'Marketing owner access required' },
        trace_id: c.get('trace_id'),
      },
      403,
    )
  }

  c.set('isMarketingOwner', true)
  await next()
}
