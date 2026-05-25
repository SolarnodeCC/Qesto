/**
 * PARTNER-MARKETPLACE-01 — public partner app directory.
 */
import { Hono } from 'hono'
import { readKvJson } from '../lib/kv'
import { writeEvent } from '../lib/observability'
import type { PartnerApp } from './partner-apps'
import type { Env } from '../types'

export type MarketplaceListing = {
  id: string
  name: string
  partner: PartnerApp['partner']
  description: string
  scopes: string[]
  badge?: 'beta' | 'ga'
}

const CURATED_LISTINGS: MarketplaceListing[] = [
  {
    id: 'workday-hr',
    name: 'Workday HR Sync',
    partner: 'workday',
    description: 'Provision sessions from Workday org changes and close the loop on people ops workflows.',
    scopes: ['read_sessions', 'write_webhooks'],
    badge: 'beta',
  },
  {
    id: 'jira-standup',
    name: 'Jira Standup Bridge',
    partner: 'jira',
    description: 'Link retrospective outcomes to Jira epics and surface blockers in live sessions.',
    scopes: ['read_sessions'],
    badge: 'beta',
  },
  {
    id: 'mattermost-alerts',
    name: 'Mattermost Alerts',
    partner: 'mattermost',
    description: 'Post session summaries and coaching highlights to Mattermost channels.',
    scopes: ['read_sessions'],
    badge: 'ga',
  },
]

function partnerAppKey(appId: string): string {
  return `partner:app:${appId}`
}

export function mountPartnerMarketplaceRoutes(parent: Hono<{ Bindings: Env; Variables: { trace_id: string } }>) {
  const app = new Hono<{ Bindings: Env; Variables: { trace_id: string } }>()

  app.get('/apps', async (c) => {
    const q = (c.req.query('q') ?? '').trim().toLowerCase()
    writeEvent(c.env.METRICS_AE, { name: 'partner.marketplace_viewed', detail: q.slice(0, 40) })

    const listings: MarketplaceListing[] = [...CURATED_LISTINGS]
    if (c.env.INTEGRATIONS_KV) {
      const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, 'partner:marketplace-public')) ?? []
      for (const id of index) {
        const appRecord = await readKvJson<PartnerApp & { description?: string; public?: boolean }>(
          c.env.INTEGRATIONS_KV,
          partnerAppKey(id),
        )
        if (appRecord?.public) {
          listings.push({
            id: appRecord.id,
            name: appRecord.name,
            partner: appRecord.partner,
            description: appRecord.description ?? `Partner integration for ${appRecord.partner}.`,
            scopes: appRecord.scopes,
            badge: 'beta',
          })
        }
      }
    }

    const filtered =
      q.length > 0 ?
        listings.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.partner.includes(q) ||
            l.description.toLowerCase().includes(q),
        )
      : listings

    return c.json({
      ok: true,
      data: { apps: filtered, total: filtered.length },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/marketplace', app)
}
