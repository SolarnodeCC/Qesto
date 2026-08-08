import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { rateLimit } from '../../middleware/rate-limit'
import { queryAuditEvents, type AuditQueryFilters } from '../../lib/audit'
import type { Env } from '../../types'

const auditQueryLimit = rateLimit({ profile: 'admin_audit_query' })
const auditExportLimit = rateLimit({
  sustained: { max: 10, windowSeconds: 3600, prefix: 'mw-admin-audit-export' },
  profileLabel: 'admin_audit_export',
})

export function mountAuditRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/audit', auditQueryLimit, authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0

    const opts: AuditQueryFilters & { limit: number; offset: number } = { limit, offset }
    const actorId = c.req.query('actor_id')
    const action = c.req.query('action')
    const subjectType = c.req.query('subject_type')
    const sinceTs = c.req.query('since_ts')
    const untilTs = c.req.query('until_ts')
    if (actorId) opts.actor_id = actorId
    if (action) opts.action = action
    if (subjectType) opts.subject_type = subjectType
    if (sinceTs) opts.since_ts = parseInt(sinceTs)
    if (untilTs) opts.until_ts = parseInt(untilTs)

    const result = await queryAuditEvents(c, opts)
    return c.json({ ok: true, data: result, trace_id }, 200)
  })

  app.get('/audit/forensic.csv', auditExportLimit, authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const limit = Math.min(5000, Math.max(1, Number(c.req.query('limit') ?? 1000)))
    const rows = await c.env.DB.prepare(
      `SELECT ts, actor_id, action, subject_type, subject_id, before_json, after_json
       FROM audit_events ORDER BY ts DESC LIMIT ?1`,
    )
      .bind(limit)
      .all<{
        ts: number
        actor_id: string
        action: string
        subject_type: string
        subject_id: string
        before_json: string | null
        after_json: string | null
      }>()

    const header = 'ts,actor_id,action,subject_type,subject_id,before_json,after_json\n'
    const body = (rows.results ?? [])
      .map((r) =>
        [
          r.ts,
          r.actor_id,
          r.action,
          r.subject_type,
          r.subject_id,
          JSON.stringify(r.before_json ?? ''),
          JSON.stringify(r.after_json ?? ''),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')

    return new Response(header + body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="qesto-audit-forensic.csv"',
        'X-Trace-Id': trace_id,
      },
    })
  })
}
