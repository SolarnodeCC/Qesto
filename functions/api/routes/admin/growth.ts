import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'

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

    const [totals, industryRows, webhookStats] = await Promise.all([
      c.env.DB
        .prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN is_discarded = 0 THEN 1 ELSE 0 END) AS active,
                  SUM(CASE WHEN is_discarded = 1 THEN 1 ELSE 0 END) AS discarded,
                  SUM(CASE WHEN is_discarded = 0 THEN usage_count ELSE 0 END) AS total_uses,
                  MAX(CASE WHEN is_discarded = 0 THEN created_at ELSE NULL END) AS last_created_at
             FROM marketing_templates`,
        )
        .first<{ total: number; active: number | null; discarded: number | null; total_uses: number | null; last_created_at: number | null }>(),
      c.env.DB
        .prepare(
          `SELECT industry, COUNT(*) AS n FROM marketing_templates
            WHERE is_discarded = 0 GROUP BY industry`,
        )
        .all<{ industry: string; n: number }>(),
      readWebhookStats(kv),
    ])

    const by_industry: Record<string, number> = {}
    for (const row of industryRows.results ?? []) {
      by_industry[row.industry] = row.n
    }

    const data: GrowthStats = {
      templates: {
        total: totals?.total ?? 0,
        active: totals?.active ?? 0,
        discarded: totals?.discarded ?? 0,
        total_uses: totals?.total_uses ?? 0,
        last_created_at: totals?.last_created_at ? new Date(totals.last_created_at).toISOString() : null,
        by_industry,
      },
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
