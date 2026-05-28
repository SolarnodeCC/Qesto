/**
 * AUDIT-API-QUERY-01 / WEBHOOK-DELIVERY-SLA-01 / SEC-CMK-01 (S78).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { AuditQuerySchema, filterAuditRecords, type AuditRecord } from '../lib/audit-query'
import { computeWebhookSla } from '../lib/webhook-sla'
import { cmkKvKey, parseCmkEnvelope } from '../lib/cmk'
import { readKvJson } from '../lib/kv'
import type { Env } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountForensicsRoutes(parent: any) {
  const admin = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()
  admin.use('*', authMiddleware)
  admin.use('*', adminMiddleware)

  admin.get('/audit/query', async (c) => {
    const parsed = AuditQuerySchema.safeParse({
      teamId: c.req.query('teamId'),
      action: c.req.query('action'),
      from: c.req.query('from') ? Number(c.req.query('from')) : undefined,
      to: c.req.query('to') ? Number(c.req.query('to')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : 100,
    })
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: parsed.error.message }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const raw = c.env.AUDIT_KV ? await readKvJson<AuditRecord[]>(c.env.AUDIT_KV, 'audit:recent') : []
    const records = filterAuditRecords(raw ?? [], parsed.data)
    return c.json({ ok: true, data: { records, count: records.length }, trace_id: c.get('trace_id') })
  })

  admin.get('/webhooks/sla', async (c) => {
    const stats = c.env.METRICS_KV
      ? await readKvJson<{ delivered: number; failed: number }>(c.env.METRICS_KV, 'webhook:sla:28d')
      : null
    return c.json({
      ok: true,
      data: { sla: computeWebhookSla(stats ?? undefined) },
      trace_id: c.get('trace_id'),
    })
  })

  admin.get('/cmk/:teamId', async (c) => {
    const teamId = c.req.param('teamId')
    const raw = c.env.TEAMS_KV ? await c.env.TEAMS_KV.get(cmkKvKey(teamId)) : null
    const envelope = parseCmkEnvelope(raw)
    return c.json({ ok: true, data: { envelope }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/admin/forensics', admin)
}
