/**
 * D1 audit_events read queries — parameterized SQL lives in the db layer.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type AuditQueryBindValue = string | number

export type AuditQueryFilters = {
  actor_id?: string
  action?: string
  subject_type?: string
  since_ts?: number
  until_ts?: number
}

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

const COUNT_AUDIT_EVENTS = 'SELECT COUNT(*) as count FROM audit_events'
const LIST_AUDIT_EVENTS = `SELECT id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key
       FROM audit_events`

export async function queryAuditEventsFromDb(
  db: D1Database,
  options: AuditQueryFilters & { limit?: number; offset?: number },
): Promise<{ events: unknown[]; total: number }> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0

  const { whereSql, bindValues, nextPlaceholderIndex } = buildAuditEventWhereClause(options)
  const limIdx = nextPlaceholderIndex
  const offIdx = nextPlaceholderIndex + 1

  const countSql = `${COUNT_AUDIT_EVENTS} ${whereSql}`
  const countResult = await db
    .prepare(countSql)
    .bind(...bindValues)
    .first<{ count: number }>()

  const listSql = `${LIST_AUDIT_EVENTS} ${whereSql} ORDER BY ts DESC LIMIT ?${limIdx} OFFSET ?${offIdx}`
  const result = await db.prepare(listSql).bind(...bindValues, limit, offset).all()

  return {
    events: result.results ?? [],
    total: countResult?.count ?? 0,
  }
}
