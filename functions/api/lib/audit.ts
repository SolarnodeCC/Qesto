// Audit logging — Before/after state snapshots for compliance + security (Phase 8 Step 3)
//
// Captures all state mutations in audit_events table for traceability.
// Deduplicates on trace_id + action + subject_id to prevent duplicate logging under retries.

import type { Env } from '../types'

export type AuditAction =
  | 'session.create'
  | 'session.start'
  | 'session.close'
  | 'session.archive'
  | 'session.update'
  | 'question.create'
  | 'question.update'
  | 'question.delete'
  | 'user.role_change'
  | 'team.create'
  | 'team.update'
  | 'team.delete'
  | 'team.role.create'
  | 'team.role.update'
  | 'team.role.delete'
  | 'team.role.assign'
  | 'team.role.unassign'
  | 'team.permission_denied'
  | 'auth.login'
  | 'auth.logout'
  | 'billing.plan_change'
  | 'insights.generate'
  | 'energizer.create'
  | 'energizer.advance'
  | 'energizer.activate'
  | 'session.close_with_badges'
  | 'user.create'
  | 'user.update'
  | 'user.suspend'
  | 'user.restore'

export interface AuditContext {
  action: AuditAction
  subject_type: string
  subject_id: string
  before_snapshot?: Record<string, any>
  after_snapshot?: Record<string, any>
  actor_id?: string
  actor_ip?: string
  trace_id?: string
  idempotency_key?: string
}

/**
 * Record an audit event with before/after snapshots.
 * Fail-safe: errors are logged but don't crash the request.
 */
export async function recordAuditEvent(c: any, ctx: AuditContext): Promise<void> {
  try {
    const now = Date.now()
    const event_id = crypto.randomUUID()
    const user = c.get('user') as any
    const actor_id = ctx.actor_id || user?.sub || null
    const actor_ip = ctx.actor_ip || c.req.header('cf-connecting-ip') || 'unknown'
    const trace_id = ctx.trace_id || c.get('trace_id') || 'unknown'
    const idempotency_key = ctx.idempotency_key || null

    // Serialize snapshots (safe even if undefined)
    const before_snapshot = ctx.before_snapshot ? JSON.stringify(ctx.before_snapshot) : '{}'
    const after_snapshot = ctx.after_snapshot ? JSON.stringify(ctx.after_snapshot) : '{}'

    // Insert into audit_events (idempotency: trace_id+action+subject_id must be unique)
    await (c.env.DB.prepare as any)(
      `INSERT INTO audit_events
       (id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT DO NOTHING`,
    )
      .bind(
        event_id,
        now,
        actor_id,
        actor_ip,
        ctx.action,
        ctx.subject_type,
        ctx.subject_id,
        before_snapshot,
        after_snapshot,
        trace_id,
        idempotency_key,
      )
      .run()
  } catch (err) {
    // Fail-safe: log but don't crash
    console.error('[audit] recordAuditEvent failed:', (err as Error).message)
  }
}

/** Bound filter values for audit event queries — explicit tuple avoids loose `any[]`. */
export type AuditQueryBindValue = string | number

export type AuditQueryFilters = {
  actor_id?: string
  action?: string
  subject_type?: string
  since_ts?: number
  until_ts?: number
}

/**
 * Build WHERE clause fragments with numbered D1 placeholders (?1…?n).
 * COUNT and SELECT reuse the same fragment + bind order; LIMIT/OFFSET are appended separately (never via string replace).
 */
export function buildAuditEventWhereClause(filters: AuditQueryFilters): {
  whereSql: string
  bindValues: AuditQueryBindValue[]
  nextPlaceholderIndex: number
} {
  const bindValues: AuditQueryBindValue[] = []
  const clauses: string[] = []
  let n = 0

  const pushEq = (column: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return
    n++
    clauses.push(`${column} = ?${n}`)
    bindValues.push(value)
  }

  pushEq('actor_id', filters.actor_id)
  pushEq('action', filters.action)
  pushEq('subject_type', filters.subject_type)

  if (filters.since_ts !== undefined) {
    n++
    clauses.push(`ts >= ?${n}`)
    bindValues.push(filters.since_ts)
  }
  if (filters.until_ts !== undefined) {
    n++
    clauses.push(`ts <= ?${n}`)
    bindValues.push(filters.until_ts)
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereSql, bindValues, nextPlaceholderIndex: n + 1 }
}

/**
 * Query audit events with filtering.
 * Returns paginated results sorted by timestamp descending.
 */
export async function queryAuditEvents(
  c: { env: Env },
  options: {
    actor_id?: string
    action?: string
    subject_type?: string
    since_ts?: number
    until_ts?: number
    limit?: number
    offset?: number
  },
): Promise<{ events: any[]; total: number }> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0

  try {
    const { whereSql, bindValues, nextPlaceholderIndex } = buildAuditEventWhereClause(options)
    const limIdx = nextPlaceholderIndex
    const offIdx = nextPlaceholderIndex + 1

    const countSql = `SELECT COUNT(*) as count FROM audit_events ${whereSql}`
    const countResult = await (c.env.DB.prepare as any)(countSql)
      .bind(...bindValues)
      .first()

    const listSql =
      `SELECT id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key
       FROM audit_events ${whereSql} ORDER BY ts DESC LIMIT ?${limIdx} OFFSET ?${offIdx}`

    const listStmt = (c.env.DB.prepare as any)(listSql).bind(...bindValues, limit, offset)

    const result = await listStmt.all()
    return {
      events: result.results ?? [],
      total: countResult?.count ?? 0,
    }
  } catch (err) {
    console.error('[audit] queryAuditEvents failed:', (err as Error).message)
    return { events: [], total: 0 }
  }
}
