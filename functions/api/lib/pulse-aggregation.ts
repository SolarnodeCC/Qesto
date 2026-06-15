/**
 * PULSE aggregation store (ADR-0057, PULSE-STORE-01).
 * Tier-1 per-session rollup + Tier-2 team daily time-series.
 */
import type { Env } from '../types'
import { logEvent } from './log'

export type PulseSessionRollup = {
  sessionId: string
  teamId: string | null
  workspaceId: string | null
  closedAt: number
  participantCount: number
  voteCount: number
  participationRate: number
  sentimentScore: number | null
  payloadJson: string
  computedAt: number
}

export type PulseTeamDailyRow = {
  teamId: string
  day: string
  participationAvg: number
  sentimentAvg: number | null
  sessionCount: number
  responseTotal: number
  computedAt: number
}

export const PULSE_WINDOWS = ['30d', '90d'] as const
export type PulseWindow = (typeof PULSE_WINDOWS)[number]

/** PULSE-KANON-01 — minimum cohort size before roll-up values are visible. */
export const PULSE_K_ANON_MIN_COHORT = 5

/** PULSE-RETENTION-01 — GDPR retention windows. */
export const PULSE_RETENTION_REDACT_MS = 90 * 86_400_000
export const PULSE_RETENTION_DELETE_MS = 7 * 365 * 86_400_000

function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

function windowStartMs(window: PulseWindow): number {
  const days = window === '90d' ? 90 : 30
  return Date.now() - days * 86_400_000
}

export async function computeSessionRollup(
  db: D1Database,
  sessionId: string,
): Promise<PulseSessionRollup | null> {
  const session = await db
    .prepare(
      `SELECT id, team_id, workspace_id, closed_at, anonymity
         FROM sessions
        WHERE id = ?1 AND status IN ('closed', 'archived')`,
    )
    .bind(sessionId)
    .first<{
      id: string
      team_id: string | null
      workspace_id: string | null
      closed_at: number | null
      anonymity: string
    }>()

  if (!session?.closed_at) return null
  if (session.anonymity === 'zero_knowledge') {
    logEvent({ event: 'pulse.rollup.zk_skip', sessionId })
    return null
  }

  const voteRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM votes WHERE session_id = ?1`)
    .bind(sessionId)
    .first<{ n: number }>()
  const participantRow = await db
    .prepare(`SELECT COUNT(DISTINCT voter_id) AS n FROM votes WHERE session_id = ?1`)
    .bind(sessionId)
    .first<{ n: number }>()
  const participantCount = participantRow?.n ?? 0
  const voteCount = voteRow?.n ?? 0
  const participationRate =
    participantCount > 0 ? Math.min(1, voteCount / participantCount) : 0

  const qRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM questions WHERE session_id = ?1`)
    .bind(sessionId)
    .first<{ n: number }>()

  const computedAt = Date.now()
  const payload = JSON.stringify({
    questionCount: qRow?.n ?? 0,
  })

  return {
    sessionId,
    teamId: session.team_id,
    workspaceId: session.workspace_id,
    closedAt: session.closed_at,
    participantCount,
    voteCount,
    participationRate,
    sentimentScore: null,
    payloadJson: payload,
    computedAt,
  }
}

export async function upsertSessionRollup(db: D1Database, rollup: PulseSessionRollup): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pulse_session_rollup (
         session_id, team_id, workspace_id, closed_at,
         participant_count, vote_count, participation_rate,
         sentiment_score, payload_json, computed_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT(session_id) DO UPDATE SET
         participant_count = excluded.participant_count,
         vote_count = excluded.vote_count,
         participation_rate = excluded.participation_rate,
         sentiment_score = excluded.sentiment_score,
         payload_json = excluded.payload_json,
         computed_at = excluded.computed_at`,
    )
    .bind(
      rollup.sessionId,
      rollup.teamId,
      rollup.workspaceId,
      rollup.closedAt,
      rollup.participantCount,
      rollup.voteCount,
      rollup.participationRate,
      rollup.sentimentScore,
      rollup.payloadJson,
      rollup.computedAt,
    )
    .run()
}

export async function mergeTeamDaily(db: D1Database, teamId: string, day: string): Promise<void> {
  const agg = await db
    .prepare(
      `SELECT
         AVG(participation_rate) AS participation_avg,
         AVG(sentiment_score) AS sentiment_avg,
         COUNT(*) AS session_count,
         SUM(vote_count) AS response_total
       FROM pulse_session_rollup
      WHERE team_id = ?1 AND date(closed_at / 1000, 'unixepoch') = ?2`,
    )
    .bind(teamId, day)
    .first<{
      participation_avg: number | null
      sentiment_avg: number | null
      session_count: number
      response_total: number | null
    }>()

  if (!agg || (agg.session_count ?? 0) === 0) return

  const computedAt = Date.now()
  await db
    .prepare(
      `INSERT INTO pulse_team_daily (
         team_id, day, participation_avg, sentiment_avg,
         session_count, response_total, computed_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(team_id, day) DO UPDATE SET
         participation_avg = excluded.participation_avg,
         sentiment_avg = excluded.sentiment_avg,
         session_count = excluded.session_count,
         response_total = excluded.response_total,
         computed_at = excluded.computed_at`,
    )
    .bind(
      teamId,
      day,
      agg.participation_avg ?? 0,
      agg.sentiment_avg,
      agg.session_count,
      agg.response_total ?? 0,
      computedAt,
    )
    .run()
}

/** Full async rollup for queue consumer — target lag < 5 min post-close. */
export async function rollupPulseOnSessionClose(env: Env, sessionId: string): Promise<void> {
  const rollup = await computeSessionRollup(env.DB, sessionId)
  if (!rollup) return

  await upsertSessionRollup(env.DB, rollup)

  if (rollup.teamId) {
    await mergeTeamDaily(env.DB, rollup.teamId, isoDay(rollup.closedAt))
  }

  logEvent({
    event: 'pulse.rollup.complete',
    sessionId,
    teamId: rollup.teamId ?? undefined,
  })
}

export async function fetchTeamPulseSummary(
  db: D1Database,
  teamId: string,
  window: PulseWindow,
): Promise<PulseTeamDailyRow[]> {
  const since = isoDay(windowStartMs(window))
  const rows = await db
    .prepare(
      `SELECT team_id, day, participation_avg, sentiment_avg,
              session_count, response_total, computed_at
         FROM pulse_team_daily
        WHERE team_id = ?1 AND day >= ?2
        ORDER BY day ASC`,
    )
    .bind(teamId, since)
    .all<{
      team_id: string
      day: string
      participation_avg: number
      sentiment_avg: number | null
      session_count: number
      response_total: number
      computed_at: number
    }>()

  return (rows.results ?? []).map((r) => ({
    teamId: r.team_id,
    day: r.day,
    participationAvg: r.participation_avg,
    sentimentAvg: r.sentiment_avg,
    sessionCount: r.session_count,
    responseTotal: r.response_total,
    computedAt: r.computed_at,
  }))
}

export type PulseSessionTrend = {
  sessionId: string
  closedAt: number
  participantCount: number
  voteCount: number
  participationRate: number
  sentimentScore: number | null
  actionCompletionRate: number
  /** PULSE-KANON-01 — true when this session is below the cohort floor and its metrics are suppressed. */
  masked: boolean
}

export type PulseLongitudinalTrends = {
  teamId: string
  window: PulseWindow
  sessionCount: number
  participationArc: number[]
  sentimentArc: (number | null)[]
  actionCompletionArc: number[]
  sessions: PulseSessionTrend[]
}

function parsePayloadQuestionCount(payloadJson: string): number {
  try {
    const parsed = JSON.parse(payloadJson) as { questionCount?: number }
    return typeof parsed.questionCount === 'number' ? parsed.questionCount : 0
  } catch {
    return 0
  }
}

/** PULSE-LONGITUDINAL-01 — N-session participation + sentiment + action completion trends. */
export async function fetchTeamLongitudinalTrends(
  db: D1Database,
  teamId: string,
  window: PulseWindow,
): Promise<PulseLongitudinalTrends> {
  const since = windowStartMs(window)
  const rows = await db
    .prepare(
      `SELECT session_id, closed_at, participant_count, vote_count,
              participation_rate, sentiment_score, payload_json
         FROM pulse_session_rollup
        WHERE team_id = ?1 AND closed_at >= ?2
        ORDER BY closed_at ASC
        LIMIT 50`,
    )
    .bind(teamId, since)
    .all<{
      session_id: string
      closed_at: number
      participant_count: number
      vote_count: number
      participation_rate: number
      sentiment_score: number | null
      payload_json: string
    }>()

  const sessions: PulseSessionTrend[] = (rows.results ?? []).map((r) => {
    const qCount = Math.max(1, parsePayloadQuestionCount(r.payload_json))
    const denom = Math.max(1, r.participant_count * qCount)
    const actionCompletionRate = Math.min(1, r.vote_count / denom)
    // PULSE-KANON-01: suppress per-session metrics below the cohort floor so
    // trends can't expose small-cohort sentiment that /pulse/summary masks.
    const masked = r.participant_count < PULSE_K_ANON_MIN_COHORT
    return {
      sessionId: r.session_id,
      closedAt: r.closed_at,
      participantCount: r.participant_count,
      voteCount: r.vote_count,
      participationRate: masked ? 0 : r.participation_rate,
      sentimentScore: masked ? null : r.sentiment_score,
      actionCompletionRate: masked ? 0 : actionCompletionRate,
      masked,
    }
  })

  return {
    teamId,
    window,
    sessionCount: sessions.length,
    participationArc: sessions.map((s) => s.participationRate),
    sentimentArc: sessions.map((s) => s.sentimentScore),
    actionCompletionArc: sessions.map((s) => s.actionCompletionRate),
    sessions,
  }
}

export type PulseTrendRow = PulseTeamDailyRow & {
  masked: boolean
}

/** PULSE-KANON-01 — mask cohort rows below k-anonymity floor. */
export function applyKAnonymityToDailyRows(rows: PulseTeamDailyRow[]): PulseTrendRow[] {
  return rows.map((row) => {
    const masked = row.sessionCount < PULSE_K_ANON_MIN_COHORT
    return {
      ...row,
      masked,
      participationAvg: masked ? 0 : row.participationAvg,
      sentimentAvg: masked ? null : row.sentimentAvg,
      responseTotal: masked ? 0 : row.responseTotal,
    }
  })
}

/** SEC-PULSE-ISOLATION-01 — team-scoped read; returns empty when teamId mismatch. */
export async function fetchTeamPulseSummaryIsolated(
  db: D1Database,
  authenticatedTeamId: string,
  requestedTeamId: string,
  window: PulseWindow,
): Promise<PulseTeamDailyRow[]> {
  if (authenticatedTeamId !== requestedTeamId) return []
  return fetchTeamPulseSummary(db, requestedTeamId, window)
}

export type PulseRetentionResult = {
  redactedSessions: number
  deletedSessions: number
  deletedDailyRows: number
}

/** PULSE-RETENTION-01 — anonymize payload after 90d; delete after 7y. */
export async function runPulseRetentionPolicy(db: D1Database, nowMs: number = Date.now()): Promise<PulseRetentionResult> {
  const redactBefore = nowMs - PULSE_RETENTION_REDACT_MS
  const deleteBefore = nowMs - PULSE_RETENTION_DELETE_MS

  const redact = await db
    .prepare(
      `UPDATE pulse_session_rollup
          SET payload_json = '{}'
        WHERE closed_at < ?1 AND payload_json != '{}'`,
    )
    .bind(redactBefore)
    .run()

  const delSessions = await db
    .prepare(`DELETE FROM pulse_session_rollup WHERE closed_at < ?1`)
    .bind(deleteBefore)
    .run()

  const delDaily = await db
    .prepare(`DELETE FROM pulse_team_daily WHERE computed_at < ?1`)
    .bind(deleteBefore)
    .run()

  return {
    redactedSessions: redact.meta.changes ?? 0,
    deletedSessions: delSessions.meta.changes ?? 0,
    deletedDailyRows: delDaily.meta.changes ?? 0,
  }
}
