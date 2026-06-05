import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'
import { listTemplates } from '../../lib/templates-kv'

export type GrowthStats = {
  templates: {
    total: number
    active: number
    discarded: number
    total_uses: number
    last_created_at: string | null
    by_industry: Record<string, number>
  }
  webhook: {
    last_received_at: string | null
    total_received: number
    total_skipped: number
    total_queued: number
  }
}

export type WebhookStats = {
  last_received_at: string
  total_received: number
  total_skipped: number
  total_queued: number
}

export async function readWebhookStats(kv: KVNamespace): Promise<WebhookStats | null> {
  return kv.get<WebhookStats>('webhook:stats', 'json')
}

export async function incrementWebhookStats(
  kv: KVNamespace,
  increments: Partial<Record<'total_received' | 'total_skipped' | 'total_queued', 1>>,
): Promise<void> {
  const raw = await kv.get<WebhookStats>('webhook:stats', 'json')
  const stats: WebhookStats = raw ?? { last_received_at: '', total_received: 0, total_skipped: 0, total_queued: 0 }
  stats.last_received_at = new Date().toISOString()
  for (const key of Object.keys(increments) as Array<keyof typeof increments>) {
    stats[key] = (stats[key] ?? 0) + 1
  }
  await kv.put('webhook:stats', JSON.stringify(stats))
}

export function mountGrowthRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/growth', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const kv = c.env.MARKETING_KV

    if (!kv) {
      const empty: GrowthStats = {
        templates: { total: 0, active: 0, discarded: 0, total_uses: 0, last_created_at: null, by_industry: {} },
        webhook: { last_received_at: null, total_received: 0, total_skipped: 0, total_queued: 0 },
      }
      return c.json({ ok: true, data: empty, trace_id })
    }

    const [indexRaw, activeTemplates, webhookStats] = await Promise.all([
      kv.get<string[]>('templates:index', 'json'),
      listTemplates(kv),
      readWebhookStats(kv),
    ])

    const totalIds = Array.isArray(indexRaw) ? indexRaw.length : 0
    const active = activeTemplates.length
    const discarded = Math.max(0, totalIds - active)

    let total_uses = 0
    let last_created_at: string | null = null
    const by_industry: Record<string, number> = {}

    for (const t of activeTemplates) {
      total_uses += t.usageCount ?? 0
      if (t.createdAt && (!last_created_at || t.createdAt > last_created_at)) {
        last_created_at = t.createdAt
      }
      if (t.industry) {
        by_industry[t.industry] = (by_industry[t.industry] ?? 0) + 1
      }
    }

    const data: GrowthStats = {
      templates: { total: totalIds, active, discarded, total_uses, last_created_at, by_industry },
      webhook: {
        last_received_at: webhookStats?.last_received_at ?? null,
        total_received: webhookStats?.total_received ?? 0,
        total_skipped: webhookStats?.total_skipped ?? 0,
        total_queued: webhookStats?.total_queued ?? 0,
      },
    }

    return c.json({ ok: true, data, trace_id })
  })
}
