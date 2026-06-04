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

export type InsightsDailyRow = {
  id: string
  session_id: string
  team_id: string | null
  day: string
  themes_json: string
  confidence: number
  n_votes: number
  embedding_ref: boolean
  computed_at: number
}

/**
 * Idempotent per-session insight write (ADR-0045 Tier-1). The UNIQUE(session_id, day)
 * constraint makes a re-run on the same close-day update in place rather than duplicate.
 * `embedding_ref` is sticky — once a Vectorize upsert succeeded it stays set even if a
 * later recompute skipped the embedding.
 */
export async function upsertInsightsDaily(db: D1Database, row: InsightsDailyRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO insights_daily
         (id, session_id, team_id, day, themes_json, confidence, n_votes, embedding_ref, computed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(session_id, day) DO UPDATE SET
         team_id = excluded.team_id,
         themes_json = excluded.themes_json,
         confidence = excluded.confidence,
         n_votes = excluded.n_votes,
         embedding_ref = CASE WHEN excluded.embedding_ref = 1 THEN 1 ELSE insights_daily.embedding_ref END,
         computed_at = excluded.computed_at`,
    )
    .bind(
      row.id,
      row.session_id,
      row.team_id,
      row.day,
      row.themes_json,
      row.confidence,
      row.n_votes,
      row.embedding_ref ? 1 : 0,
      row.computed_at,
    )
    .run()
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
