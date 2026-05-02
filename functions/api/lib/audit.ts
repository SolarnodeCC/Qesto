// Audit logging — Before/after state snapshots for compliance + security (Phase 8 Step 3)
//
// Captures all state mutations in audit_events table for traceability.
// Deduplicates on trace_id + action + subject_id to prevent duplicate logging under retries.

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

/**
 * Query audit events with filtering.
 * Returns paginated results sorted by timestamp descending.
 */
export async function queryAuditEvents(
  c: any,
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
    const clauses: string[] = []
    const values: Array<string | number> = []
    if (options.actor_id) {
      clauses.push('actor_id = ?')
      values.push(options.actor_id)
    }
    if (options.action) {
      clauses.push('action = ?')
      values.push(options.action)
    }
    if (options.subject_type) {
      clauses.push('subject_type = ?')
      values.push(options.subject_type)
    }
    if (options.since_ts) {
      clauses.push('ts >= ?')
      values.push(options.since_ts)
    }
    if (options.until_ts) {
      clauses.push('ts <= ?')
      values.push(options.until_ts)
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    // Count total matching records
    const countResult = await (c.env.DB.prepare as any)(`SELECT COUNT(*) as count FROM audit_events ${where}`)
      .bind(...values)
      .first()

    // Fetch paginated results
    const countStmt = (c.env.DB.prepare as any)(
      `SELECT id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key
       FROM audit_events ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, offset)

    const result = await countStmt.all()
    return {
      events: result.results ?? [],
      total: countResult?.count ?? 0,
    }
  } catch (err) {
    console.error('[audit] queryAuditEvents failed:', (err as Error).message)
    return { events: [], total: 0 }
  }
}
