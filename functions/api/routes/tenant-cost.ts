/**
 * TENANT-COST-01 — team cost attribution API (S74).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { buildCostSnapshot, tenantCostKvKey } from '../lib/tenant-cost'
import { readKvJson, writeKvJson } from '../lib/kv'
import type { Env } from '../types'
import { TENANT_COST_TTL_SECONDS } from '../lib/constants'
import type { ParentApp } from './parent-app'

export function mountTenantCostRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & PlanVariables }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/teams/:teamId/cost', async (c) => {
    const teamId = c.req.param('teamId')
    if (c.get('plan') !== 'team') {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Cost attribution requires Team plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const month = new Date().toISOString().slice(0, 7)
    const kv = c.env.TEAMS_KV
    if (!kv) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const cached = await readKvJson<{ ai: number; api: number; storageMb: number }>(kv, tenantCostKvKey(teamId, month))
    const units = cached ?? { ai: 0, api: 0, storageMb: 0 }
    const snapshot = buildCostSnapshot(teamId, units)
    if (!cached) {
      await writeKvJson(kv, tenantCostKvKey(teamId, month), units, { expirationTtl: TENANT_COST_TTL_SECONDS })
    }
    return c.json({ ok: true, data: { snapshot, metered: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/tenant-cost', app)
}
