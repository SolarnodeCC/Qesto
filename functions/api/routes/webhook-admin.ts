/**
 * INT-WEBHOOK-STATUS-01 — team webhook delivery statistics.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { listDeliveries, loadTeamWebhooks } from '../lib/webhooks'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export function mountWebhookAdminRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/teams/:teamId/webhooks/stats', async (c) => {
    const kv = c.env.INTEGRATIONS_KV
    if (!kv) {
      return c.json({ ok: true, data: { webhooks: 0, successRate: 0, deliveries: [] }, trace_id: c.get('trace_id') })
    }
    const teamId = c.req.param('teamId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const user = c.get('user')
    const isAdmin =
      team.ownerId === user.sub || team.members.some((m) => m.userId === user.sub && (m.role === 'owner' || m.role === 'admin'))
    if (!isAdmin) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Team admin required' }, trace_id: c.get('trace_id') }, 403)
    }

    const configs = await loadTeamWebhooks(kv, teamId)
    let success = 0
    let total = 0
    const recent: unknown[] = []
    for (const cfg of configs) {
      const log = await listDeliveries(kv, cfg.id)
      for (const entry of log.slice(0, 10)) {
        total++
        if (entry.success) success++
        recent.push({ webhookId: cfg.id, ...entry })
      }
    }
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100
    return c.json({
      ok: true,
      data: { webhooks: configs.length, successRate, sampleSize: total, deliveries: recent.slice(0, 50) },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}
