/**
 * FE-STAGE-PRES-01 — event presenter shell API (slide deck, talk switch, feed).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { canWriteWorkspace } from '../lib/workspace-rbac'
import {
  joinPathForMode,
  parseEventTemplate,
  type EventAgendaTemplate,
  type LinkedSessionInfo,
} from '../lib/event-agenda'
import { computeTrackSummaries } from '../lib/event-suite'
import {
  applyPresenterPut,
  PresenterPutSchema,
  resolveActiveSlot,
} from '../lib/event-presenter'
import type { WorkspaceRow } from '../lib/workspace-types'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

async function loadSessionsForWorkspace(
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

async function loadEventWorkspace(
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
  if (!row || row.kind !== 'event') return null
  return { row, template: parseEventTemplate(row.template_json) }
}

function buildPresenterPayload(
  row: WorkspaceRow,
  template: EventAgendaTemplate,
  sessions: Map<string, LinkedSessionInfo>,
) {
  const tracks = computeTrackSummaries(template.tracks, sessions)
  const liveSessions = [...sessions.values()].filter((s) => s.status === 'live' || s.status === 'energizing').length
  const activeSlot = resolveActiveSlot(template.tracks, sessions, template.presenter)
  return {
    workspaceId: row.id,
    title: row.title,
    eventCode: template.eventCode,
    attendeeUrl: `/e/${template.eventCode}`,
    suiteStatus: template.suite.status,
    liveSessionCount: liveSessions,
    tracks: template.tracks,
    trackSummaries: tracks,
    sessions: [...sessions.values()],
    presenter: template.presenter,
    feed: [...template.suite.feed].sort((a, b) => b.createdAt - a.createdAt),
    activeSlot,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountTeamEventPresenterRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:teamId/workspaces/:wsId/present', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: buildPresenterPayload(loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  app.put('/:teamId/workspaces/:wsId/present', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const body = PresenterPutSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid presenter config' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (body.data.activeSlotId) {
      const found = loaded.template.tracks.some((t) => t.slots.some((s) => s.id === body.data.activeSlotId))
      if (!found) {
        return c.json({ ok: false, error: { code: 'validation', message: 'Unknown slot' }, trace_id: c.get('trace_id') }, 400)
      }
    }
    loaded.template.presenter = applyPresenterPut(loaded.template.presenter, body.data)
    const now = Date.now()
    await c.env.DB.prepare(`UPDATE workspaces SET template_json = ?1, updated_at = ?2 WHERE id = ?3 AND team_id = ?4`)
      .bind(JSON.stringify(loaded.template), now, wsId, teamId)
      .run()
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: buildPresenterPayload(loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/teams', app)
}
