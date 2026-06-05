/**
 * FE-STAGE-PRES-01 — event presenter shell API (slide deck, talk switch, feed).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { canReadWorkspace, canWriteWorkspace } from '../lib/workspace-rbac'
import type { LinkedSessionInfo } from '../lib/event-agenda'
import { computeTrackSummaries } from '../lib/event-suite'
import {
  applyPresenterPut,
  normalizeSlideDeckUrl,
  PresenterPutSchema,
  resolveActiveSlot,
} from '../lib/event-presenter'
import {
  fetchSessionConnectionCount,
  loadEventWorkspace,
  loadSessionsForWorkspace,
} from '../lib/event-workspace'
import type { WorkspaceRow } from '../lib/workspace-types'
import type { Team } from './teams'
import type { Env } from '../types'
import type { EventAgendaTemplate } from '../lib/event-agenda'

type Vars = AuthVariables & PlanVariables

async function buildPresenterPayload(
  env: Env,
  row: WorkspaceRow,
  template: EventAgendaTemplate,
  sessions: Map<string, LinkedSessionInfo>,
) {
  const tracks = computeTrackSummaries(template.tracks, sessions)
  const liveSessions = [...sessions.values()].filter((s) => s.status === 'live' || s.status === 'energizing')
  const activeSlot = resolveActiveSlot(template.tracks, sessions, template.presenter)
  const liveSessionParticipants: Array<{ sessionId: string; title: string; connections: number | null }> = []
  for (const session of liveSessions) {
    const connections = await fetchSessionConnectionCount(env, session.id)
    liveSessionParticipants.push({ sessionId: session.id, title: session.title, connections })
  }
  const activeSlotParticipantCount =
    activeSlot?.session?.id != null ? await fetchSessionConnectionCount(env, activeSlot.session.id) : null

  return {
    workspaceId: row.id,
    title: row.title,
    eventCode: template.eventCode,
    attendeeUrl: `/e/${template.eventCode}`,
    suiteStatus: template.suite.status,
    liveSessionCount: liveSessions.length,
    liveSessionParticipants,
    activeSlotParticipantCount,
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
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Event workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: await buildPresenterPayload(c.env, loaded.row, loaded.template, sessions),
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
    if (body.data.slideDeckUrl != null && body.data.slideDeckUrl !== '' && !normalizeSlideDeckUrl(body.data.slideDeckUrl)) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Slide URL must be HTTPS from an allowed provider' }, trace_id: c.get('trace_id') },
        400,
      )
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
      data: await buildPresenterPayload(c.env, loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/teams', app)
}
