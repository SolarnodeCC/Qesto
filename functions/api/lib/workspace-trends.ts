import { namespacedKey } from './tenant-namespace'
import type { WorkspaceTrendKind, WorkspaceTrendWindow } from './workspace-types'

const K_ANON_INSTANCES = 3

export type WorkspaceParticipationPoint = {
  instanceSeq: number
  sessionId: string
  closedAt: number
  responseCount: number
}

export type WorkspaceTrendPayload = {
  instanceCount: number
  points?: WorkspaceParticipationPoint[]
  message?: string
}

function trendCacheKey(teamId: string, workspaceId: string, kind: WorkspaceTrendKind, window: WorkspaceTrendWindow): string {
  return namespacedKey(teamId, `ws:${workspaceId}:trend:${kind}:${window}`)
}

export async function upsertWorkspaceTrend(
  db: D1Database,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
  payload: WorkspaceTrendPayload,
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
): Promise<WorkspaceTrendPayload | null> {
  const row = await db
    .prepare(
      `SELECT payload_json FROM workspace_trend
         WHERE workspace_id = ?1 AND kind = ?2 AND window = ?3`,
    )
    .bind(workspaceId, kind, window)
    .first<{ payload_json: string }>()
  if (!row) return null
  try {
    return JSON.parse(row.payload_json) as WorkspaceTrendPayload
  } catch {
    return null
  }
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
): Promise<WorkspaceTrendPayload | null> {
  const raw = await kv.get(trendCacheKey(teamId, workspaceId, kind, window))
  if (!raw) return null
  try {
    return JSON.parse(raw) as WorkspaceTrendPayload
  } catch {
    return null
  }
}

export async function writeCachedWorkspaceTrend(
  kv: KVNamespace,
  teamId: string,
  workspaceId: string,
  kind: WorkspaceTrendKind,
  window: WorkspaceTrendWindow,
  payload: WorkspaceTrendPayload,
): Promise<void> {
  await kv.put(trendCacheKey(teamId, workspaceId, kind, window), JSON.stringify(payload), {
    expirationTtl: 3600,
  })
}

export async function purgeWorkspaceTrends(db: D1Database, workspaceId: string): Promise<void> {
  await db.prepare(`DELETE FROM workspace_trend WHERE workspace_id = ?1`).bind(workspaceId).run()
}
