/**
 * PULSE-AUDIT-01 (ADR-0057) — aggregation query audit log.
 *
 * Records every PULSE aggregation read so a DPO can answer "who queried which
 * cohort, how large, how much was k-anonymity masked, and when". The record
 * shaping is pure (testable); the write/read are thin D1 wrappers.
 */

export type PulseQueryType = 'summary' | 'trends' | 'audit'

export type PulseAuditRecord = {
  id: string
  teamId: string
  actorId: string
  queryType: PulseQueryType
  window: string
  cohortSize: number
  maskedRows: number
  traceId: string | null
  queriedAt: number
}

export type PulseAuditInput = {
  teamId: string
  actorId: string
  queryType: PulseQueryType
  window: string
  cohortSize: number
  maskedRows: number
  traceId?: string | null
  now?: number
}

/** Pure shaper — generates the id + timestamp and normalises optionals. */
export function buildPulseAuditRecord(input: PulseAuditInput): PulseAuditRecord {
  return {
    id: crypto.randomUUID(),
    teamId: input.teamId,
    actorId: input.actorId,
    queryType: input.queryType,
    window: input.window,
    cohortSize: Math.max(0, Math.trunc(input.cohortSize)),
    maskedRows: Math.max(0, Math.trunc(input.maskedRows)),
    traceId: input.traceId ?? null,
    queriedAt: input.now ?? Date.now(),
  }
}

export async function recordPulseQueryAudit(db: D1Database, record: PulseAuditRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pulse_query_audit (
         id, team_id, actor_id, query_type, window, cohort_size, masked_rows, trace_id, queried_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      record.id,
      record.teamId,
      record.actorId,
      record.queryType,
      record.window,
      record.cohortSize,
      record.maskedRows,
      record.traceId,
      record.queriedAt,
    )
    .run()
}

/** DPO-readable export — most-recent-first audit rows for a team. */
export async function fetchPulseQueryAudit(
  db: D1Database,
  teamId: string,
  limit = 200,
): Promise<PulseAuditRecord[]> {
  const bounded = Math.min(1000, Math.max(1, Math.trunc(limit)))
  const rows = await db
    .prepare(
      `SELECT id, team_id, actor_id, query_type, window, cohort_size, masked_rows, trace_id, queried_at
         FROM pulse_query_audit
        WHERE team_id = ?1
        ORDER BY queried_at DESC
        LIMIT ?2`,
    )
    .bind(teamId, bounded)
    .all<{
      id: string
      team_id: string
      actor_id: string
      query_type: PulseQueryType
      window: string
      cohort_size: number
      masked_rows: number
      trace_id: string | null
      queried_at: number
    }>()

  return (rows.results ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    actorId: r.actor_id,
    queryType: r.query_type,
    window: r.window,
    cohortSize: r.cohort_size,
    maskedRows: r.masked_rows,
    traceId: r.trace_id,
    queriedAt: r.queried_at,
  }))
}
