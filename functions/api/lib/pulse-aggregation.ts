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
