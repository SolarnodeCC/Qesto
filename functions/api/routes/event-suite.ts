/**
 * STAGE-SUITE-01 — event-level start/close, live feed, per-track status.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { canReadWorkspace, canWriteWorkspace } from '../lib/workspace-rbac'
import { parseEventTemplate, type EventAgendaTemplate } from '../lib/event-agenda'
import {
  findEventWorkspaceByCode,
  loadEventWorkspace,
  loadSessionsForWorkspace,
} from '../lib/event-workspace'
import {
  appendFeedItem,
  closeEventSuite,
  computeTrackSummaries,
  FeedPostSchema,
  publicFeedItems,
  startEventSuite,
} from '../lib/event-suite'
import type { WorkspaceRow } from '../lib/workspace-types'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

async function persistTemplate(db: D1Database, wsId: string, teamId: string, template: EventAgendaTemplate) {
  const now = Date.now()
  await db
    .prepare(`UPDATE workspaces SET template_json = ?1, updated_at = ?2 WHERE id = ?3 AND team_id = ?4`)
    .bind(JSON.stringify(template), now, wsId, teamId)
    .run()
}

function buildSuitePayload(
  row: WorkspaceRow,
  template: EventAgendaTemplate,
  sessions: Awaited<ReturnType<typeof loadSessionsForWorkspace>>,
) {
  const tracks = computeTrackSummaries(template.tracks, sessions)
  const liveSessions = [...sessions.values()].filter((s) => s.status === 'live' || s.status === 'energizing').length
  return {
    workspaceId: row.id,
    title: row.title,
    eventCode: template.eventCode,
    attendeeUrl: `/e/${template.eventCode}`,
    status: template.suite.status,
    startedAt: template.suite.startedAt,
    closedAt: template.suite.closedAt,
    liveSessionCount: liveSessions,
    tracks,
    feed: [...template.suite.feed].sort((a, b) => b.createdAt - a.createdAt),
    sessions: [...sessions.values()],
  }
}

export function mountPublicEventSuiteRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.get('/events/:code/feed', async (c) => {
    const code = c.req.param('code').toUpperCase()
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      return errorResponse(c, 400, 'bad_code', 'Invalid event code')
    }
    const row = await findEventWorkspaceByCode(c.env.DB, code)
    if (!row) {
      return errorResponse(c, 404, 'not_found', 'Event not found')
    }
    const template = parseEventTemplate(row.template_json)
    const trackId = c.req.query('track') ?? undefined
    const sessions = await loadSessionsForWorkspace(c.env.DB, row.id)
    const tracks = computeTrackSummaries(template.tracks, sessions)
    return c.json({
      ok: true,
      data: {
        eventTitle: row.title,
        eventCode: template.eventCode,
        status: template.suite.status,
        tracks,
        feed: publicFeedItems(template.suite.feed, trackId),
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}

export function mountTeamEventSuiteRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:teamId/workspaces/:wsId/suite', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Forbidden')
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return errorResponse(c, 404, 'not_found', 'Event workspace not found')
    }
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: buildSuitePayload(loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/:teamId/workspaces/:wsId/suite/start', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Forbidden')
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return errorResponse(c, 404, 'not_found', 'Event workspace not found')
    }
    if (loaded.template.suite.status === 'closed') {
      return errorResponse(c, 409, 'conflict', 'Event is closed')
    }
    startEventSuite(loaded.template.suite)
    await persistTemplate(c.env.DB, wsId, teamId, loaded.template)
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: buildSuitePayload(loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/:teamId/workspaces/:wsId/suite/close', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Forbidden')
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return errorResponse(c, 404, 'not_found', 'Event workspace not found')
    }
    if (loaded.template.suite.status === 'draft') {
      return errorResponse(c, 409, 'conflict', 'Event has not started')
    }
    closeEventSuite(loaded.template.suite)
    await persistTemplate(c.env.DB, wsId, teamId, loaded.template)
    const sessions = await loadSessionsForWorkspace(c.env.DB, loaded.row.id)
    return c.json({
      ok: true,
      data: buildSuitePayload(loaded.row, loaded.template, sessions),
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/:teamId/workspaces/:wsId/suite/feed', async (c) => {
    const teamId = c.req.param('teamId')
    const wsId = c.req.param('wsId')
    const body = FeedPostSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return errorResponse(c, 400, 'validation', 'Invalid feed message')
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Forbidden')
    }
    const loaded = await loadEventWorkspace(c.env.DB, teamId, wsId)
    if (!loaded) {
      return errorResponse(c, 404, 'not_found', 'Event workspace not found')
    }
    if (body.data.trackId && !loaded.template.tracks.some((t) => t.id === body.data.trackId)) {
      return errorResponse(c, 400, 'validation', 'Unknown track')
    }
    const item = appendFeedItem(loaded.template.suite, body.data.message, body.data.trackId ?? null)
    await persistTemplate(c.env.DB, wsId, teamId, loaded.template)
    return c.json({ ok: true, data: { item }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}
