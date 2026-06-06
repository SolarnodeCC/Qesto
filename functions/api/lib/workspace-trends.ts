import { ulid } from './ulid'
import { namespacedKey } from './tenant-namespace'
import type { WorkspaceTrendKind, WorkspaceTrendWindow } from './workspace-types'
import type { z } from 'zod'
import {
  parseJsonString,
  RetroHealthThemeSchema,
  WorkspaceTrendUnionSchema,
} from './boundary-decode'
import { absent } from './absent'

const K_ANON_INSTANCES = 3
const K_MIN_RESPONDENTS = 5

export type RetroHealthTheme = {
  kind: 'retro_health'
  wentWell: number
  didntGoWell: number
  actions: number
  totalCards: number
}

export type WorkspaceParticipationPoint = {
  instanceSeq: number
  sessionId: string
  closedAt: number
  responseCount: number
}

export type WorkspaceMoodBucket = 'positive' | 'neutral' | 'concerning'

export type WorkspaceTeamHealthPoint = {
  instanceSeq: number
  sessionId: string
  closedAt: number
  moodScore: number
  mood: WorkspaceMoodBucket
  participation: number
  wentWell: number
  didntGoWell: number
  actions: number
}

export type WorkspaceTrendPayload = {
  instanceCount: number
  points?: WorkspaceParticipationPoint[]
  message?: string
}

export type WorkspaceTeamHealthPayload = {
  instanceCount: number
  points?: WorkspaceTeamHealthPoint[]
  message?: string
}

export function moodFromRetroCounts(wentWell: number, didntGoWell: number): { moodScore: number; mood: WorkspaceMoodBucket } {
  const denom = wentWell + didntGoWell
  if (denom === 0) return { moodScore: 0.5, mood: 'neutral' }
  const moodScore = Math.round((wentWell / denom) * 100) / 100
  if (moodScore >= 0.6) return { moodScore, mood: 'positive' }
  if (moodScore >= 0.35) return { moodScore, mood: 'neutral' }
  return { moodScore, mood: 'concerning' }
}

export function parseRetroHealthTheme(themesJson: string): RetroHealthTheme | null {
  let arr: unknown
  try {
    arr = JSON.parse(themesJson)
  } catch {
    return absent()
  }
  if (!Array.isArray(arr)) return absent()
  for (const item of arr) {
    const parsed = RetroHealthThemeSchema.safeParse(item)
    if (parsed.success) return parsed.data
  }
  return absent()
}

/** Persist aggregate retro board stats to insights_daily (ZK-excluded at caller). */
export async function persistRetroHealthSnapshot(
  db: D1Database,
  params: {
    sessionId: string
    teamId: string | null
    closedAt: number
    stats: { wentWell: number; didntGoWell: number; actions: number; totalCards: number }
  },
): Promise<void> {
  const day = new Date(params.closedAt).toISOString().slice(0, 10)
  const theme: RetroHealthTheme = {
    kind: 'retro_health',
    wentWell: params.stats.wentWell,
    didntGoWell: params.stats.didntGoWell,
    actions: params.stats.actions,
    totalCards: params.stats.totalCards,
  }
  const { moodScore } = moodFromRetroCounts(params.stats.wentWell, params.stats.didntGoWell)
  await db
    .prepare(
      `INSERT INTO insights_daily (id, session_id, team_id, day, themes_json, confidence, n_votes, embedding_ref, computed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8)
       ON CONFLICT(session_id, day) DO UPDATE SET
         themes_json = excluded.themes_json,
         confidence = excluded.confidence,
         n_votes = excluded.n_votes,
         computed_at = excluded.computed_at`,
    )
    .bind(
      ulid(),
      params.sessionId,
      params.teamId,
      day,
      JSON.stringify([theme]),
      moodScore,
      params.stats.totalCards,
      params.closedAt,
    )
    .run()
}

function trendCacheKey(teamId: string, workspaceId: string, kind: WorkspaceTrendKind, window: WorkspaceTrendWindow): string {
  return namespacedKey(teamId, `ws:${workspaceId}:trend:${kind}:${window}`)
}

export async function upsertWorkspaceTrend(
  db: D1Database,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
  payload: WorkspaceTrendPayload | WorkspaceTeamHealthPayload,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO workspace_trend (workspace_id, kind, window, payload_json, computed_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(workspace_id, kind, window) DO UPDATE SET
         payload_json = excluded.payload_json,
         computed_at = excluded.computed_at`,
    )
    .bind(workspaceId, kind, window, JSON.stringify(payload), Date.now())
    .run()
}

export async function getWorkspaceTrend(
  db: D1Database,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
): Promise<WorkspaceTrendPayload | WorkspaceTeamHealthPayload | null> {
  const row = await db
    .prepare(
      `SELECT payload_json FROM workspace_trend
         WHERE workspace_id = ?1 AND kind = ?2 AND window = ?3`,
    )
    .bind(workspaceId, kind, window)
    .first<{ payload_json: string }>()
  if (!row) return absent()
  return asWorkspaceTrendPayload(parseJsonString(WorkspaceTrendUnionSchema, row.payload_json))
}

export async function recomputeWorkspaceParticipationTrend(
  db: D1Database,
  workspaceId: string,
  window: WorkspaceTrendWindow = '90d',
): Promise<WorkspaceTrendPayload> {
  const cutoff = Date.now() - (window === '30d' ? 30 : window === '90d' ? 90 : 180) * 86_400_000
  const rows = await db
    .prepare(
      `SELECT s.id, s.workspace_seq, s.closed_at, s.anonymity,
              COALESCE(i.n_votes, 0) AS n_votes
         FROM sessions s
         LEFT JOIN insights_daily i ON i.session_id = s.id
        WHERE s.workspace_id = ?1
          AND s.status IN ('closed', 'archived')
          AND s.closed_at IS NOT NULL
          AND s.closed_at >= ?2
          AND s.anonymity != 'zero_knowledge'
        ORDER BY s.workspace_seq ASC`,
    )
    .bind(workspaceId, cutoff)
    .all<{
      id: string
      workspace_seq: number | null
      closed_at: number
      anonymity: string
      n_votes: number
    }>()

  const instances = rows.results ?? []
  if (instances.length < K_ANON_INSTANCES) {
    const payload: WorkspaceTrendPayload = {
      instanceCount: instances.length,
      message: 'insufficient_data',
    }
    await upsertWorkspaceTrend(db, workspaceId, 'participation', window, payload)
    return payload
  }

  const points: WorkspaceParticipationPoint[] = instances.map((r) => ({
    instanceSeq: r.workspace_seq ?? 0,
    sessionId: r.id,
    closedAt: r.closed_at,
    responseCount: r.n_votes,
  }))

  const payload: WorkspaceTrendPayload = { instanceCount: instances.length, points }
  await upsertWorkspaceTrend(db, workspaceId, 'participation', window, payload)
  return payload
}

export async function readCachedWorkspaceTrend(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
): Promise<WorkspaceTrendPayload | WorkspaceTeamHealthPayload | null> {
  const raw = await kv.get(trendCacheKey(teamId, workspaceId, kind, window))
  if (!raw) return absent()
  return asWorkspaceTrendPayload(parseJsonString(WorkspaceTrendUnionSchema, raw))
}

export async function writeCachedWorkspaceTrend(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
  payload: WorkspaceTrendPayload | WorkspaceTeamHealthPayload,
): Promise<void> {
  await kv.put(trendCacheKey(teamId, workspaceId, kind, window), JSON.stringify(payload), {
    expirationTtl: 3600,
  })
}

export async function recomputeWorkspaceTeamHealthTrend(
  db: D1Database,
  workspaceId: string,
  window: WorkspaceTrendWindow = '90d',
): Promise<WorkspaceTeamHealthPayload> {
  const cutoff = Date.now() - (window === '30d' ? 30 : window === '90d' ? 90 : 180) * 86_400_000
  const rows = await db
    .prepare(
      `SELECT s.id, s.workspace_seq, s.closed_at, i.themes_json, i.n_votes
         FROM sessions s
         INNER JOIN insights_daily i ON i.session_id = s.id
        WHERE s.workspace_id = ?1
          AND s.session_mode = 'retro'
          AND s.status IN ('closed', 'archived')
          AND s.closed_at IS NOT NULL
          AND s.closed_at >= ?2
          AND s.anonymity != 'zero_knowledge'
        ORDER BY s.workspace_seq ASC`,
    )
    .bind(workspaceId, cutoff)
    .all<{
      id: string
      workspace_seq: number | null
      closed_at: number
      themes_json: string
      n_votes: number
    }>()

  const instances = rows.results ?? []
  if (instances.length < K_ANON_INSTANCES) {
    const payload: WorkspaceTeamHealthPayload = {
      instanceCount: instances.length,
      message: 'insufficient_data',
    }
    await upsertWorkspaceTrend(db, workspaceId, 'team_health', window, payload)
    return payload
  }

  const points: WorkspaceTeamHealthPoint[] = []
  for (const r of instances) {
    const health = parseRetroHealthTheme(r.themes_json)
    if (!health || health.totalCards < K_MIN_RESPONDENTS) continue
    const { moodScore, mood } = moodFromRetroCounts(health.wentWell, health.didntGoWell)
    points.push({
      instanceSeq: r.workspace_seq ?? 0,
      sessionId: r.id,
      closedAt: r.closed_at,
      moodScore,
      mood,
      participation: health.totalCards,
      wentWell: health.wentWell,
      didntGoWell: health.didntGoWell,
      actions: health.actions,
    })
  }

  if (points.length < K_ANON_INSTANCES) {
    const payload: WorkspaceTeamHealthPayload = {
      instanceCount: instances.length,
      message: 'insufficient_data',
    }
    await upsertWorkspaceTrend(db, workspaceId, 'team_health', window, payload)
    return payload
  }

  const payload: WorkspaceTeamHealthPayload = { instanceCount: instances.length, points }
  await upsertWorkspaceTrend(db, workspaceId, 'team_health', window, payload)
  return payload
}

export async function purgeWorkspaceTrends(db: D1Database, workspaceId: string): Promise<void> {
  await db.prepare(`DELETE FROM workspace_trend WHERE workspace_id = ?1`).bind(workspaceId).run()
}

/** Narrow Zod output to app payload types (exactOptionalPropertyTypes-safe). */
function asWorkspaceTrendPayload(
  parsed: z.infer<typeof WorkspaceTrendUnionSchema> | null,
): WorkspaceTrendPayload | WorkspaceTeamHealthPayload | null {
  if (!parsed) return absent()
  return parsed as WorkspaceTrendPayload | WorkspaceTeamHealthPayload
}
