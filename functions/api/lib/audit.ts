// Audit logging — Before/after state snapshots for compliance + security (Phase 8 Step 3)
//
// Captures all state mutations in audit_events table for traceability.
// Deduplicates on trace_id + action + subject_id to prevent duplicate logging under retries.

import type { Env } from '../types'
import { validateData, AuditContextSchema, UserContextSchema } from './protocol-schemas'

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
  // Auth events (SOC 2 CC6.1 / CC6.3)
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.magic_link_requested'
  | 'auth.magic_link_consumed'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.sso_initiated'
  | 'auth.sso_completed'
  | 'auth.sso_failed'
  | 'auth.gdpr_deletion'
  | 'billing.plan_change'
  | 'insights.generate'
  | 'energizer.create'
  | 'energizer.advance'
  | 'energizer.activate'
  | 'energizer.complete'
  | 'energizer.activation_denied'
  | 'ws.energizer_activated'
  | 'ws.energizer_activation_denied'
  | 'ws.energizer_advance_denied'
  | 'ws.energizer_answered'
  | 'ws.energizer_advanced'
  | 'ws.energizer_completed'
  | 'session.close_with_badges'
  | 'townhall.config'
  | 'townhall.question.delete'
  | 'deliberate.config'
  | 'deliberate.ballot.cast'
  | 'deliberate.verify.mismatch'
  // EMBED (ADR-0050): widget-config + token lifecycle on the authenticated mint plane.
  | 'embed.widget.create'
  | 'embed.widget.token_mint'
  | 'embed.widget.revoke'
  | 'user.create'
  | 'user.update'
  | 'user.suspend'
  | 'user.restore'
  | 'ldap.sync.completed'
  // Agent action transparency (AI-461, S87): an AI agent/copilot executed an
  // action that mutated session state. after_snapshot carries the sanitised
  // tool call + outcome + `source: 'ai'` provenance.
  | 'agent.action.suggestion_accepted'
  | 'agent.action.question_injected'
  | 'agent.action.state_changed'

export interface AuditContext {
  action: AuditAction
  subject_type: string
  subject_id: string
  before_snapshot?: Record<string, unknown>
  after_snapshot?: Record<string, unknown>
  actor_id?: string
  actor_ip?: string
  trace_id?: string
  idempotency_key?: string
}

/**
 * Write an auth audit event directly to D1 without requiring middleware user
 * context. Use this in auth route handlers where the user is not yet
 * authenticated (login, magic-link, SSO, password reset, signup).
 *
 * SOC 2 CC6.1 / CC6.3: every authentication attempt -- success or failure --
 * must be recorded with actor_ip and outcome.
 */
export async function recordAuthAuditEvent(
  db: D1Database,
  params: {
    action: AuditAction
    actor_id?: string | null
    actor_ip?: string | null
    trace_id?: string | null
    subject_id: string
    outcome: 'success' | 'failure'
    detail?: string
  },
): Promise<void> {
  try {
    const after = JSON.stringify({
      outcome: params.outcome,
      ...(params.detail ? { detail: params.detail } : {}),
    })
    await db
      .prepare(
        `INSERT INTO audit_events
         (id, ts, actor_id, actor_ip, action, subject_type, subject_id,
          before_snapshot, after_snapshot, trace_id, idempotency_key)
         VALUES (?1, ?2, ?3, ?4, ?5, 'auth', ?6, '{}', ?7, ?8, NULL)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        Date.now(),
        params.actor_id ?? null,
        params.actor_ip ?? 'unknown',
        params.action,
        params.subject_id,
        after,
        params.trace_id ?? 'unknown',
      )
      .run()
  } catch (err) {
    console.error('[audit] recordAuthAuditEvent failed:', (err as Error).message)
  }
}

/**
 * Record an audit event with before/after snapshots.
 * Validates all inputs before persistence; fail-safe on errors.
 */
export async function recordAuditEvent(
  c: { get(key: string): unknown; req: { header(h: string): string | undefined }; env: { DB: D1Database } },
  ctx: AuditContext,
): Promise<void> {
  try {
    // Validate context against schema (proof-aware decoder)
    const validCtx = validateData(ctx, AuditContextSchema)
    if (!validCtx) {
      console.warn(`[audit] Invalid audit context`)
      return
    }

    // Validate user context from middleware
    const rawUser = c.get('user')
    const validUser = validateData(rawUser, UserContextSchema)
    if (!validUser) {
      console.warn(`[audit] Invalid user context`)
      return
    }

    const now = Date.now()
    const event_id = crypto.randomUUID()
    const actor_id = validCtx.actor_id || validUser.sub || null
    const actor_ip = validCtx.actor_ip || c.req.header('cf-connecting-ip') || 'unknown'
    const trace_id = validCtx.trace_id || c.get('trace_id') || 'unknown'
    const idempotency_key = validCtx.idempotency_key || null

    // Serialize snapshots (safe even if undefined)
    const before_snapshot = validCtx.before_snapshot ? JSON.stringify(validCtx.before_snapshot) : '{}'
    const after_snapshot = validCtx.after_snapshot ? JSON.stringify(validCtx.after_snapshot) : '{}'

    // Insert into audit_events (parameterized, idempotency: trace_id+action+subject_id unique)
    const db = c.env.DB
    await db
      .prepare(
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
        validCtx.action,
        validCtx.subject_type,
        validCtx.subject_id,
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
    const countResult = await c.env.DB.prepare(countSql)
      .bind(...bindValues)
      .first<{ count: number }>()

    const listSql =
      `SELECT id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key
       FROM audit_events ${whereSql} ORDER BY ts DESC LIMIT ?${limIdx} OFFSET ?${offIdx}`

    const listStmt = c.env.DB.prepare(listSql).bind(...bindValues, limit, offset)

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
