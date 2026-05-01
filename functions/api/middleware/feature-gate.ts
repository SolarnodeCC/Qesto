// Feature gate middleware (BILL-04): Block access to premium features based on plan.

import type { MiddlewareHandler } from 'hono'
import type { Env, PlanQuotas } from '../types'
import type { PlanVariables } from './plan'
import { denyFeature, featureAllowed } from '../lib/entitlements'

export type FeatureKey = keyof PlanQuotas['featuresUnlocked']

/**
 * Middleware factory that gates access to a specific feature by plan.
 *
 * Usage: `app.post('/export', requireFeature('resultsExport'), async (c) => { ... })`
 */
export function requireFeature(feature: FeatureKey): MiddlewareHandler<{ Bindings: Env; Variables: PlanVariables & { trace_id: string } }> {
  return async (c, next) => {
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')

    if (!quotas || !featureAllowed(quotas, feature)) {
      const error = denyFeature(plan, feature)
      return c.json(
        {
          ok: false,
          error,
          trace_id: c.get('trace_id') ?? 'unknown',
        },
        403,
      )
    }

    await next()
  }
}
