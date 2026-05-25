/**
 * MULTI-REGION-MIGRATION-01 — team opt-in + status (Sprint 48).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import type { PlanVariables } from '../middleware/plan'
import type { RbacVariables } from '../middleware/rbac'
import { readKvJson, writeKvJson } from '../lib/kv'
import {
  getMultiRegionConfig,
  getMultiRegionRoutingSnapshot,
  resolveReadRegion,
  setMultiRegionFailoverActive,
} from '../lib/multi-region'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

type OptInRecord = {
  teamId: string
  optedInAt: number
  optedInBy: string
  readRegion: string
}

function optInKey(teamId: string): string {
  return `multi-region:opt-in:${teamId}`
}

export function mountMultiRegionAdminRoutes(parent: Hono<{ Bindings: Env; Variables: any }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  app.get('/multi-region/status', async (c) => {
    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    const routing = await getMultiRegionRoutingSnapshot(c.env, colo)
    return c.json({
      ok: true,
      data: {
        config: routing.config,
        colo: routing.colo,
        resolvedReadRegion: routing.readRegion,
        writeRegion: routing.writeRegion,
        failoverActive: routing.failoverActive,
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/multi-region/failover', async (c) => {
    if (c.env.MULTI_REGION_FAILOVER_ENABLED !== 'true') {
      return c.json(
        { ok: false, error: { code: 'disabled', message: 'Failover drill disabled' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const kv = c.env.MULTI_REGION_STATE_KV
    if (!kv) {
      return c.json(
        { ok: false, error: { code: 'not_configured', message: 'MULTI_REGION_STATE_KV not bound' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    await setMultiRegionFailoverActive(kv, true)
    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    const routing = await getMultiRegionRoutingSnapshot(c.env, colo)
    writeEvent(c.env.METRICS_AE, {
      name: 'multi_region.failover_triggered',
      traceId: c.get('trace_id'),
      detail: `admin_drill:write=${routing.writeRegion}`,
    })
    return c.json({ ok: true, data: { failoverActive: true, writeRegion: routing.writeRegion }, trace_id: c.get('trace_id') })
  })

  app.delete('/multi-region/failover', async (c) => {
    const kv = c.env.MULTI_REGION_STATE_KV
    if (!kv) {
      return c.json(
        { ok: false, error: { code: 'not_configured', message: 'MULTI_REGION_STATE_KV not bound' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    await setMultiRegionFailoverActive(kv, false)
    return c.json({ ok: true, data: { failoverActive: false }, trace_id: c.get('trace_id') })
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
