import { generateJoinCode } from './code'
import { ulid } from './ulid'
import type { WorkspaceKind, WorkspaceRow } from './workspace-types'
import { DEFAULT_IDEATE_TEMPLATE, DEFAULT_RETRO_TEMPLATE } from './workspace-types'
import { defaultEventTemplate } from './event-agenda'

export function defaultTemplateForKind(kind: WorkspaceKind): Record<string, unknown> {
  if (kind === 'retro') return { ...DEFAULT_RETRO_TEMPLATE }
  if (kind === 'ideate') return { ...DEFAULT_IDEATE_TEMPLATE }
  if (kind === 'event') return defaultEventTemplate()
  return { tracks: [] }
}

export function sessionModeForWorkspaceKind(kind: WorkspaceKind): 'reflection' | 'stage' | 'retro' | 'ideate' {
  if (kind === 'event') return 'stage'
  if (kind === 'retro') return 'retro'
  if (kind === 'ideate') return 'ideate'
  return 'reflection'
}

export function instanceTitle(workspace: Pick<WorkspaceRow, 'title' | 'kind'>, seq: number): string {
  const label = workspace.kind === 'retro' ? 'Retro' : workspace.kind === 'ideate' ? 'Ideate' : 'Session'
  return `${workspace.title} — ${label} #${seq}`
}

export async function nextWorkspaceSeq(db: D1Database, workspaceId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(MAX(workspace_seq), 0) AS max_seq FROM sessions WHERE workspace_id = ?1`)
    .bind(workspaceId)
    .first<{ max_seq: number }>()
  return (row?.max_seq ?? 0) + 1
}

export type CreateInstanceParams = {
  db: D1Database
  workspace: WorkspaceRow
  ownerId: string
  teamId: string
}

export type CreateInstanceResult = {
  sessionId: string
  code: string
  title: string
  workspaceSeq: number
  sessionMode: 'reflection' | 'stage' | 'retro' | 'ideate'
}

export async function createWorkspaceInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
  const { db, workspace, ownerId, teamId } = params
  const seq = await nextWorkspaceSeq(db, workspace.id)
  const id = ulid()
  const code = generateJoinCode()
  const now = Date.now()
  const title = instanceTitle(workspace, seq)
  const sessionMode = sessionModeForWorkspaceKind(workspace.kind)

  await db
    .prepare(
      `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id, workspace_id, workspace_seq)
       VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(id, ownerId, code, title, sessionMode, now, teamId, workspace.id, seq)
    .run()

  await db
    .prepare(`UPDATE workspaces SET last_instance_at = ?1, updated_at = ?1 WHERE id = ?2`)
    .bind(now, workspace.id)
    .run()

  return { sessionId: id, code, title, workspaceSeq: seq, sessionMode }
}

export async function listWorkspaceInstances(
  db: D1Database,
  workspaceId: string,
): Promise<
  Array<{
    id: string
    title: string
    status: string
    workspaceSeq: number | null
    createdAt: number
    closedAt: number | null
  }>
> {
  const rows = await db
    .prepare(
      `SELECT id, title, status, workspace_seq, created_at, closed_at
         FROM sessions WHERE workspace_id = ?1 ORDER BY workspace_seq DESC`,
    )
    .bind(workspaceId)
    .all<{
      id: string
      title: string
      status: string
      workspace_seq: number | null
      created_at: number
      closed_at: number | null
    }>()
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    workspaceSeq: r.workspace_seq,
    createdAt: r.created_at,
    closedAt: r.closed_at,
  }))
}

export type WorkspaceHistoryEntry = {
  id: string
  title: string
  status: string
  workspaceSeq: number | null
  createdAt: number
  closedAt: number | null
  /** Per-session insight summary (null for sessions with no rollup, incl. ZK). */
  insight: { responseCount: number; confidence: number | null; computedAt: number } | null
}

/**
 * Linked instances + per-session insight summary (ADR-0048 §2 "history is a
 * query"). LEFT JOIN to `insights_daily`: zero-knowledge instances are absent
 * from that table by construction (Tier-1 ZK write-boundary guard), so they
 * surface here with `insight: null` — no special-casing, no PII leak.
 */
export async function listWorkspaceHistory(
  db: D1Database,
  workspaceId: string,
): Promise<WorkspaceHistoryEntry[]> {
  const rows = await db
    .prepare(
      `SELECT s.id, s.title, s.status, s.workspace_seq, s.created_at, s.closed_at,
              i.n_votes AS insight_votes, i.confidence AS insight_confidence, i.computed_at AS insight_computed_at
         FROM sessions s
         LEFT JOIN insights_daily i ON i.session_id = s.id
        WHERE s.workspace_id = ?1
        ORDER BY s.workspace_seq DESC`,
    )
    .bind(workspaceId)
    .all<{
      id: string
      title: string
      status: string
      workspace_seq: number | null
      created_at: number
      closed_at: number | null
      insight_votes: number | null
      insight_confidence: number | null
      insight_computed_at: number | null
    }>()
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    workspaceSeq: r.workspace_seq,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    insight:
      r.insight_computed_at != null
        ? {
            responseCount: r.insight_votes ?? 0,
            confidence: r.insight_confidence ?? null,
            computedAt: r.insight_computed_at,
          }
        : null,
  }))
}
