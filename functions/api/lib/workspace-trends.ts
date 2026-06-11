import { ulid } from './ulid'
import { namespacedKey } from './tenant-namespace'
import { readKvJson } from './kv'
import { teamDocumentKey } from './kv-keys'
import { featureAllowed } from './entitlements'
import type { WorkspaceKind, WorkspaceTrendKind, WorkspaceTrendWindow } from './workspace-types'
import type { z } from 'zod'
import {
  decodeKvJson,
  RetroHealthThemeSchema,
  WorkspaceTrendUnionSchema,
} from './boundary-decode'
import { PLAN_QUOTAS, type PlanTier } from '../types'

const K_ANON_INSTANCES = 3
const K_MIN_RESPONDENTS = 5

/** All trend windows recomputed together by the cron / refresh path. */
const ALL_TREND_WINDOWS: WorkspaceTrendWindow[] = ['30d', '90d', '180d']

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
    return null
  }
  if (!Array.isArray(arr)) return null
  for (const item of arr) {
    const parsed = RetroHealthThemeSchema.safeParse(item)
    if (parsed.success) return parsed.data
  }
  return null
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
  if (!row) return null
  return asWorkspaceTrendPayload(decodeKvJson(row.payload_json, WorkspaceTrendUnionSchema))
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
  if (!raw) return null
  return asWorkspaceTrendPayload(decodeKvJson(raw, WorkspaceTrendUnionSchema))
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

/** Invalidate one KV read-cache entry (mirror of writeCachedWorkspaceTrend's key). */
export async function purgeCachedWorkspaceTrend(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
): Promise<void> {
  await kv.delete(trendCacheKey(teamId, workspaceId, kind, window))
}

export type RecomputeWorkspaceTrendsResult = {
  /** Trend (kind, window) pairs that were recomputed + cache-invalidated. */
  recomputed: Array<{ kind: WorkspaceTrendKind; window: WorkspaceTrendWindow }>
  /** Fresh participation 90d payload, for the on-demand refresh response. */
  participation90d: WorkspaceTrendPayload
}

/**
 * Recompute every trend kind/window for one workspace and invalidate its KV
 * read cache. Shared by the daily cron (Tier-2) and the on-demand Refresh
 * (ADR-0048 §4). `participation` is always recomputed for all three windows;
 * `team_health` only for retro workspaces (its query is retro-scoped). Defensive:
 * cache invalidation never throws into the caller.
 */
export async function recomputeWorkspaceTrends(
  db: D1Database,
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  kind: WorkspaceKind,
): Promise<RecomputeWorkspaceTrendsResult> {
  const recomputed: Array<{ kind: WorkspaceTrendKind; window: WorkspaceTrendWindow }> = []
  let participation90d: WorkspaceTrendPayload = { instanceCount: 0, message: 'insufficient_data' }

  for (const window of ALL_TREND_WINDOWS) {
    const payload = await recomputeWorkspaceParticipationTrend(db, workspaceId, window)
    if (window === '90d') participation90d = payload
    recomputed.push({ kind: 'participation', window })
  }
  if (kind === 'retro') {
    for (const window of ALL_TREND_WINDOWS) {
      await recomputeWorkspaceTeamHealthTrend(db, workspaceId, window)
      recomputed.push({ kind: 'team_health', window })
    }
  }

  for (const entry of recomputed) {
    try {
      await purgeCachedWorkspaceTrend(kv, teamId, workspaceId, entry.kind, entry.window)
    } catch {
      // Cache invalidation is best-effort; a stale entry expires via its TTL.
    }
  }

  return { recomputed, participation90d }
}

type StaleWorkspaceRow = {
  id: string
  team_id: string
  kind: string
}

/**
 * Tier-2 daily rollup (ADR-0048 §4). Recompute `workspace_trend` for every
 * retro/ideate workspace that has at least one instance closed AFTER its newest
 * trend `computed_at` (or that has no trend rows yet), filtered to teams holding
 * the `crossSessionInsights` entitlement (cost control). Invalidates the KV read
 * cache for everything it recomputes. Returns counts for observability.
 */
export async function recomputeStaleWorkspaceTrends(
  db: D1Database,
  kv: KVNamespace,
  teamsKv: KVNamespace,
): Promise<{ scanned: number; recomputed: number }> {
  // One query: workspaces whose latest closed instance is newer than their
  // newest trend computed_at (LEFT JOIN → NULL when no trend rows exist yet).
  const rows = await db
    .prepare(
      `SELECT w.id, w.team_id, w.kind
         FROM workspaces w
         JOIN sessions s ON s.workspace_id = w.id
        WHERE w.kind IN ('retro', 'ideate')
          AND w.archived_at IS NULL
          AND s.status IN ('closed', 'archived')
          AND s.closed_at IS NOT NULL
        GROUP BY w.id, w.team_id, w.kind
       HAVING MAX(s.closed_at) > COALESCE(
                (SELECT MAX(t.computed_at) FROM workspace_trend t WHERE t.workspace_id = w.id),
                0)`,
    )
    .all<StaleWorkspaceRow>()

  const candidates = rows.results ?? []
  let recomputed = 0
  // Cache per-team entitlement so each team's plan is resolved at most once.
  const entitledByTeam = new Map<string, boolean>()

  for (const ws of candidates) {
    let entitled = entitledByTeam.get(ws.team_id)
    if (entitled === undefined) {
      entitled = await teamHoldsCrossSessionInsights(teamsKv, ws.team_id)
      entitledByTeam.set(ws.team_id, entitled)
    }
    if (!entitled) continue // cost control: skip non-entitled teams
    await recomputeWorkspaceTrends(db, kv, ws.team_id, ws.id, ws.kind as WorkspaceKind)
    recomputed++
  }

  return { scanned: candidates.length, recomputed }
}

/** Resolve a team's plan from TEAMS_KV and test the crossSessionInsights gate. */
async function teamHoldsCrossSessionInsights(teamsKv: KVNamespace, teamId: string): Promise<boolean> {
  const team = await readKvJson<{ plan?: PlanTier }>(teamsKv, teamDocumentKey(teamId))
  const plan: PlanTier = team?.plan ?? 'free'
  const quotas = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free
  return featureAllowed(quotas, 'crossSessionInsights')
}

/** Narrow Zod output to app payload types (exactOptionalPropertyTypes-safe). */
function asWorkspaceTrendPayload(
  parsed: z.infer<typeof WorkspaceTrendUnionSchema> | null,
): WorkspaceTrendPayload | WorkspaceTeamHealthPayload | null {
  if (!parsed) return null
  return parsed as WorkspaceTrendPayload | WorkspaceTeamHealthPayload
}
