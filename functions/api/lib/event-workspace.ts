import { absent } from './absent'
/**
 * Shared event workspace loaders (STAGE-AGENDA / SUITE / PRESENTER).
 */
import { joinPathForMode, parseEventTemplate, type EventAgendaTemplate, type LinkedSessionInfo } from './event-agenda'
import type { WorkspaceRow } from './workspace-types'

export async function loadSessionsForWorkspace(
  db: D1Database,
  workspaceId: string,
): Promise<Map<string, LinkedSessionInfo>> {
  const rows = await db
    .prepare(
      `SELECT id, code, title, status, session_mode FROM sessions WHERE workspace_id = ?1 ORDER BY workspace_seq ASC`,
    )
    .bind(workspaceId)
    .all<{ id: string; code: string; title: string; status: string; session_mode: string }>()
  const map = new Map<string, LinkedSessionInfo>()
  for (const row of rows.results ?? []) {
    map.set(row.id, {
      id: row.id,
      code: row.code,
      title: row.title,
      status: row.status,
      sessionMode: row.session_mode,
      joinPath: joinPathForMode(row.session_mode, row.code),
    })
  }
  return map
}

export async function findEventWorkspaceByCode(db: D1Database, code: string): Promise<WorkspaceRow | null> {
  const row = await db
    .prepare(
      `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
              created_by, created_at, updated_at
         FROM workspaces
        WHERE kind = 'event' AND archived_at IS NULL AND json_extract(template_json, '$.eventCode') = ?1`,
    )
    .bind(code)
    .first<WorkspaceRow>()
  return row ?? null
}

export async function loadEventWorkspace(
  db: D1Database,
  teamId: string,
  wsId: string,
): Promise<{ row: WorkspaceRow; template: EventAgendaTemplate } | null> {
  const row = await db
    .prepare(
      `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
              created_by, created_at, updated_at
         FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(wsId, teamId)
    .first<WorkspaceRow>()
  if (!row || row.kind !== 'event') {
    return absent()
  }
  return { row, template: parseEventTemplate(row.template_json) }
}

export async function fetchSessionConnectionCount(env: { SESSION_ROOM: DurableObjectNamespace }, sessionId: string): Promise<number | null> {
  try {
    const roomId = env.SESSION_ROOM.idFromName(sessionId)
    const room = env.SESSION_ROOM.get(roomId)
    const res = await room.fetch(new Request('https://do.internal/state', { method: 'GET' }))
    if (!res.ok) {
      return absent()
    }
    const body = (await res.json()) as { ok?: boolean; data?: { connections?: number } }
    if (typeof body.data?.connections !== 'number') {
      return absent()
    }
    return body.data.connections
  } catch {
    return absent()
  }
}
