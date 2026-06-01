/**
 * Cross-session intelligence store (ADR-0045, INSIGHTS-01 spike / Sprint 81).
 */
import type { D1Database } from '@cloudflare/workers-types'

export const TEAM_INSIGHT_KINDS = [
  'recurring_themes',
  'engagement_trend',
  'facilitator_scorecard',
] as const

export type TeamInsightKind = (typeof TEAM_INSIGHT_KINDS)[number]

export type TeamInsightRollupRow = {
  team_id: string
  kind: TeamInsightKind
  window: string
  payload_json: string
  computed_at: number
}

export async function upsertTeamInsightRollup(
  db: D1Database,
  row: TeamInsightRollupRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO team_insight_rollup (team_id, kind, window, payload_json, computed_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(team_id, kind, window) DO UPDATE SET
         payload_json = excluded.payload_json,
         computed_at = excluded.computed_at`,
    )
    .bind(row.team_id, row.kind, row.window, row.payload_json, row.computed_at)
    .run()
}

export async function getTeamInsightRollup(
  db: D1Database,
  teamId: string,
  kind: TeamInsightKind,
  window: string,
): Promise<TeamInsightRollupRow | null> {
  return db
    .prepare(
      `SELECT team_id, kind, window, payload_json, computed_at
         FROM team_insight_rollup
        WHERE team_id = ?1 AND kind = ?2 AND window = ?3`,
    )
    .bind(teamId, kind, window)
    .first<TeamInsightRollupRow>()
}

export async function deleteTeamInsightRollups(db: D1Database, teamId: string): Promise<void> {
  await db.prepare(`DELETE FROM team_insight_rollup WHERE team_id = ?1`).bind(teamId).run()
}

export async function patchInsightsDailyTeamId(
  db: D1Database,
  sessionId: string,
  teamId: string | null,
  embeddingRef: boolean,
): Promise<void> {
  await db
    .prepare(
      `UPDATE insights_daily
          SET team_id = ?2,
              embedding_ref = CASE WHEN ?3 = 1 THEN 1 ELSE embedding_ref END
        WHERE session_id = ?1`,
    )
    .bind(sessionId, teamId, embeddingRef ? 1 : 0)
    .run()
}
