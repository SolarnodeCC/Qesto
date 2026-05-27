/**
 * RESIDENCY-ENFORCE-01 — team residency pin API (S75).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/validate'
import { getTeamResidencyPin, setTeamResidencyPin } from '../lib/residency-enforce'
import type { Env } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountResidencyRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & PlanVariables }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  const PinSchema = z.object({
    teamId: z.string().min(1),
    homeRegion: z.enum(['eu', 'us', 'apac']),
  })

  app.get('/pin', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.TEAMS_KV) {
      return c.json({ ok: true, data: { pin: null }, trace_id: c.get('trace_id') })
    }
    const pin = await getTeamResidencyPin(c.env.TEAMS_KV, teamId)
    return c.json({ ok: true, data: { pin }, trace_id: c.get('trace_id') })
  })

  app.put('/pin', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Residency pinning requires Team plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const parsed = await validateBody(c, PinSchema)
    if ('error' in parsed) return parsed.error
    if (!c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const pin = { ...parsed.data, enforcedAt: Date.now() }
    await setTeamResidencyPin(c.env.TEAMS_KV, pin)
    return c.json({ ok: true, data: { pin }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/residency', app)
}
