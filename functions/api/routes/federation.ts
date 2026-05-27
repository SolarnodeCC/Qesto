/**
 * FEDERATION-01 / FEDERATION-CONSENT-01 — cross-org trust links.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/validate'
import {
  FederationScopeSchema,
  consentFederationLink,
  createFederationLink,
  listTeamFederationLinks,
} from '../lib/federation'
import { listFederationLibrary } from '../lib/federation-library'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const CreateLinkSchema = z.object({
  sourceTeamId: z.string().min(1),
  targetTeamId: z.string().min(1),
  scopes: z.array(FederationScopeSchema).min(1),
})

export function mountFederationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/links', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const links = await listTeamFederationLinks(c.env.TEAMS_KV, teamId)
    return c.json({ ok: true, data: { links }, trace_id: c.get('trace_id') })
  })

  app.post('/links', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json({ ok: false, error: { code: 'upgrade_required', message: 'Federation requires Team plan' }, trace_id: c.get('trace_id') }, 403)
    }
    if (!c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const parsed = await validateBody(c, CreateLinkSchema)
    if ('error' in parsed) return parsed.error
    const link = await createFederationLink(c.env.TEAMS_KV, {
      ...parsed.data,
      createdBy: c.get('user').sub,
    })
    writeEvent(c.env.METRICS_AE, { name: 'federation.link_created', teamId: parsed.data.sourceTeamId, detail: link.id })
    return c.json({ ok: true, data: { link }, trace_id: c.get('trace_id') }, 201)
  })

  app.post('/links/:id/consent', async (c) => {
    if (!c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const link = await consentFederationLink(c.env.TEAMS_KV, c.req.param('id'))
    if (!link) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Link not found or not pending' }, trace_id: c.get('trace_id') }, 404)
    }
    writeEvent(c.env.METRICS_AE, { name: 'federation.consent_granted', teamId: link.targetTeamId, detail: link.id })
    return c.json({ ok: true, data: { link }, trace_id: c.get('trace_id') })
  })

  app.get('/library', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.TEAMS_KV || !c.env.TEMPLATES_KV) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const entries = await listFederationLibrary(c.env.TEAMS_KV, c.env.TEMPLATES_KV, teamId)
    return c.json({ ok: true, data: { entries }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/federation', app)
}
