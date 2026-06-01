// Plan middleware (BILL-04): Fetch user's plan from DB and set on context.
// Downstream routes use c.get('plan') to check feature availability.

import type { MiddlewareHandler } from 'hono'
import type { Env, PlanTier } from '../types'
import { PLAN_QUOTAS as QUOTAS_MAP } from '../types'
import type { AuthVariables } from './auth'
import { logEvent } from '../lib/log'


export type PlanVariables = {
  plan: PlanTier
  planQuotas: (typeof QUOTAS_MAP)[PlanTier]
}

const PLAN_LOOKUP_TIMEOUT_MS = 1500

function validPlan(value: unknown): value is PlanTier {
  return value === 'free' || value === 'starter' || value === 'team'
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function lookupUserPlan(db: D1Database, userId: string): Promise<PlanTier> {
  const result = await withTimeout(
    db.prepare('SELECT plan FROM users WHERE id = ?1').bind(userId).first<{ plan: PlanTier }>(),
    PLAN_LOOKUP_TIMEOUT_MS,
    'plan lookup',
  )
  return validPlan(result?.plan) ? result.plan : 'free'
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
    c.set('planQuotas', QUOTAS_MAP['team'])
    await next()
    return
  }

  let plan: PlanTier
  try {
    plan = await lookupUserPlan(c.env.DB, user.sub)
  } catch (err) {
    logEvent({
        event: 'plan_middleware.db_failure',
        userId: user.sub,
        traceId: c.get('trace_id'),
        error: err instanceof Error ? err.message : String(err),
      })
    // Degrade to the safest quota tier instead of turning every authenticated
    // route into a 500 during a transient D1 fault.
    plan = 'free'
  }

  // Set plan and quotas on context for downstream routes
  c.set('plan', plan)
  c.set('planQuotas', QUOTAS_MAP[plan])

  await next()
}

export const __internal = { lookupUserPlan, PLAN_LOOKUP_TIMEOUT_MS }
