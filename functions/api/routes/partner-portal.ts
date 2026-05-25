/**
 * PARTNER-01 — partner portal API skeleton (tier + usage summary).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { getApiUsageForTeam } from '../lib/api-usage'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export function mountPartnerPortalRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/dashboard', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const kv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
    const usage = kv ? await getApiUsageForTeam(kv, teamId) : null
    return c.json({
      ok: true,
      data: {
        teamId,
        partnerTier: c.get('plan') === 'team' ? 'growth' : 'standard',
        apiUsage: usage,
        integrations: ['slack', 'notion', 'webhooks'],
        sdkDocs: '/api/v3/openapi.json',
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/partner', app)
}
