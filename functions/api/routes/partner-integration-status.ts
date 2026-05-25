/**
 * PARTNER-INTEG-01 — OAuth connection status for partner systems (extends S45 skeletons).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export type PartnerIntegrationStatus = {
  partner: 'workday' | 'jira' | 'mattermost'
  connected: boolean
  lastSyncAt?: number
  scopes?: string[]
}

function integrationKey(teamId: string, partner: string): string {
  return `integration:config:${teamId}:${partner}`
}

export function mountPartnerIntegrationStatusRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/teams/:teamId/partner-integrations', async (c) => {
    const teamId = c.req.param('teamId')
    const partners: PartnerIntegrationStatus['partner'][] = ['workday', 'jira', 'mattermost']
    const statuses: PartnerIntegrationStatus[] = []
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({
        ok: true,
        data: { integrations: partners.map((p) => ({ partner: p, connected: false })) },
        trace_id: c.get('trace_id'),
      })
    }
    for (const partner of partners) {
      const cfg = await readKvJson<{ connectedAt?: number; scopes?: string[] }>(
        c.env.INTEGRATIONS_KV,
        integrationKey(teamId, partner),
      )
      statuses.push({
        partner,
        connected: Boolean(cfg),
        ...(cfg?.connectedAt ? { lastSyncAt: cfg.connectedAt } : {}),
        ...(cfg?.scopes ? { scopes: cfg.scopes } : {}),
      })
    }
    return c.json({ ok: true, data: { integrations: statuses }, trace_id: c.get('trace_id') })
  })

  parent.route('/api', app)
}
