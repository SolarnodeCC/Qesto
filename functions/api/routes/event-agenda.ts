/**
 * STAGE-AGENDA-01 — agenda API + public attendee navigation.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { canReadWorkspace, canWriteWorkspace } from '../lib/workspace-rbac'
import {
  AgendaPutSchema,
  buildPublicAgenda,
  normalizeAgendaPut,
  parseEventTemplate,
  type EventAgendaTemplate,
} from '../lib/event-agenda'
import { findEventWorkspaceByCode, loadSessionsForWorkspace } from '../lib/event-workspace'
import type { WorkspaceRow } from '../lib/workspace-types'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

function persistTemplate(template: EventAgendaTemplate): string {
  return JSON.stringify(template)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountPublicEventAgendaRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.get('/events/:code/agenda', async (c) => {
    const code = c.req.param('code').toUpperCase()
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      return c.json({ ok: false, error: { code: 'bad_code', message: 'Invalid event code' }, trace_id: c.get('trace_id') }, 400)
    }
    const row = await findEventWorkspaceByCode(c.env.DB, code)
    if (!row) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const template = parseEventTemplate(row.template_json)
    const trackId = c.req.query('track') ?? undefined
    const sessions = await loadSessionsForWorkspace(c.env.DB, row.id)
    const agenda = buildPublicAgenda(row.title, template.eventCode, template.tracks, trackId, sessions)
    return c.json({ ok: true, data: agenda, trace_id: c.get('trace_id') })
  })

  parent.route('/api', app)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountTeamEventAgendaRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:teamId/workspaces/:wsId/agenda', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const row = await c.env.DB.prepare(
      `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
              created_by, created_at, updated_at
         FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
      .bind(wsId, teamId)
      .first<WorkspaceRow>()
    if (!row || row.kind !== 'event') {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const template = parseEventTemplate(row.template_json)
    const sessions = await loadSessionsForWorkspace(c.env.DB, row.id)
    return c.json({
      ok: true,
      data: {
        workspaceId: row.id,
        title: row.title,
        eventCode: template.eventCode,
        attendeeUrl: `/e/${template.eventCode}`,
        tracks: template.tracks,
        sessions: [...sessions.values()],
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.put('/:teamId/workspaces/:wsId/agenda', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const body = AgendaPutSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid agenda' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const row = await c.env.DB.prepare(
      `SELECT id, team_id, kind, title, template_json FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
      .bind(wsId, teamId)
      .first<{ id: string; team_id: string; kind: string; title: string; template_json: string }>()
    if (!row || row.kind !== 'event') {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const template = parseEventTemplate(row.template_json)
    const sessions = await loadSessionsForWorkspace(c.env.DB, row.id)
    const linkedIds = new Set<string>()
    for (const track of body.data.tracks) {
      for (const slot of track.slots) {
        if (slot.sessionId) {
          if (!sessions.has(slot.sessionId)) {
            return c.json(
              { ok: false, error: { code: 'validation', message: 'Slot references unknown session' }, trace_id: c.get('trace_id') },
              400,
            )
          }
          linkedIds.add(slot.sessionId)
        }
      }
    }
    const existingSuite = template.suite
    template.tracks = normalizeAgendaPut(body.data)
    template.suite = existingSuite
    const now = Date.now()
    await c.env.DB.prepare(`UPDATE workspaces SET template_json = ?1, updated_at = ?2 WHERE id = ?3 AND team_id = ?4`)
      .bind(persistTemplate(template), now, wsId, teamId)
      .run()
    return c.json({
      ok: true,
      data: { tracks: template.tracks, eventCode: template.eventCode },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/teams', app)
}
