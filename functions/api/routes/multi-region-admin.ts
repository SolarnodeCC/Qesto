/**
 * MULTI-REGION-MIGRATION-01 — team opt-in + status (Sprint 48).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { readKvJson, writeKvJson } from '../lib/kv'
import { getMultiRegionConfig, resolveReadRegion } from '../lib/multi-region'
import type { Env } from '../types'

type Vars = AuthVariables & AdminVariables

type OptInRecord = {
  teamId: string
  optedInAt: number
  optedInBy: string
  readRegion: string
}

function optInKey(teamId: string): string {
  return `multi-region:opt-in:${teamId}`
}

export function mountMultiRegionAdminRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  app.get('/multi-region/status', async (c) => {
    const cfg = getMultiRegionConfig(c.env)
    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    return c.json({
      ok: true,
      data: {
        config: cfg,
        colo,
        resolvedReadRegion: resolveReadRegion(colo, cfg),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/multi-region/teams/:teamId/opt-in', async (c) => {
    const teamId = c.req.param('teamId')
    const cfg = getMultiRegionConfig(c.env)
    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    const record: OptInRecord = {
      teamId,
      optedInAt: Date.now(),
      optedInBy: c.get('user').sub,
      readRegion: resolveReadRegion(colo, cfg),
    }
    await writeKvJson(c.env.TEAMS_KV, optInKey(teamId), record)
    return c.json({ ok: true, data: record, trace_id: c.get('trace_id') }, 201)
  })

  app.get('/multi-region/teams/:teamId/opt-in', async (c) => {
    const teamId = c.req.param('teamId')
    const record = await readKvJson<OptInRecord>(c.env.TEAMS_KV, optInKey(teamId))
    return c.json({ ok: true, data: { optedIn: record !== null, record }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/admin', app)
}
