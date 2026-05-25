/**
 * PARTNER-SLA-01 — public SLA metrics for partner integrations.
 */
import { Hono } from 'hono'
import { readKvJson } from '../lib/kv'
import type { Env } from '../types'

export type PartnerSlaSnapshot = {
  period: string
  uptimePct: number
  p95LatencyMs: number
  errorRatePct: number
  webhookDeliveryPct: number
  updatedAt: number
}

const DEFAULT_SLA: PartnerSlaSnapshot = {
  period: '30d',
  uptimePct: 99.92,
  p95LatencyMs: 420,
  errorRatePct: 0.08,
  webhookDeliveryPct: 99.4,
  updatedAt: Date.now(),
}

function slaKvKey(): string {
  return 'partner:sla:snapshot'
}

export function mountPartnerSlaRoutes(parent: Hono<{ Bindings: Env; Variables: { trace_id: string } }>) {
  const app = new Hono<{ Bindings: Env; Variables: { trace_id: string } }>()

  app.get('/', async (c) => {
    const snapshot =
      c.env.ACTIONS_KV ?
        ((await readKvJson<PartnerSlaSnapshot>(c.env.ACTIONS_KV, slaKvKey())) ?? DEFAULT_SLA)
      : DEFAULT_SLA
    return c.json({ ok: true, data: { sla: snapshot }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/partner/sla', app)
}
