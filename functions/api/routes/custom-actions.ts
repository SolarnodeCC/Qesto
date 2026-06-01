/**
 * CUSTOM-ACTION-PLUGIN-SDK-01 — team plugin registry.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { listTeamPlugins, registerTeamPlugin } from '../lib/custom-actions'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const RegisterSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(80),
  hook: z.enum(['session.closed', 'vote.submitted', 'energizer.completed']),
  handlerUrl: z.string().url(),
})

export function mountCustomActionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const plugins = await listTeamPlugins(c.env.INTEGRATIONS_KV, teamId)
    return c.json({ ok: true, data: { plugins }, trace_id: c.get('trace_id') })
  })

  app.post('/', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json({ ok: false, error: { code: 'upgrade_required', message: 'Custom actions require Team plan' }, trace_id: c.get('trace_id') }, 403)
    }
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'INTEGRATIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const parsed = await validateBody(c, RegisterSchema)
    if ('error' in parsed) return parsed.error
    const plugin = await registerTeamPlugin(c.env.INTEGRATIONS_KV, { ...parsed.data, enabled: true })
    return c.json({ ok: true, data: { plugin }, trace_id: c.get('trace_id') }, 201)
  })

  parent.route('/api/custom-actions', app)
}
