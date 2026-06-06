import type { Hono } from 'hono'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { teamDocumentKey } from '../../lib/kv-keys'
import { ulid } from '../../lib/ulid'
import { requireFeature } from '../../middleware/feature-gate'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import { canReadWorkspace, canWriteWorkspace } from '../../lib/workspace-rbac'
import {
  carryOpenActionsToNewInstance,
  openActionItems,
  readWorkspaceActions,
  writeWorkspaceActions,
} from '../../lib/workspace-actions'
import { createWorkspaceInstance, listWorkspaceInstances } from '../../lib/workspace-instances'
import {
  getWorkspaceTrend,
  recomputeWorkspaceParticipationTrend,
  recomputeWorkspaceTeamHealthTrend,
  readCachedWorkspaceTrend,
  writeCachedWorkspaceTrend,
} from '../../lib/workspace-trends'
import type { WorkspaceTrendWindow } from '../../lib/workspace-types'
import { DEFAULT_IDEATE_TEMPLATE, DEFAULT_RETRO_TEMPLATE } from '../../lib/workspace-types'
import { ideateSeedKey, type IdeateSessionSeed } from '../ideate-sessions'
import { retroSeedKey, type RetroSessionSeed } from '../retro-sessions'
import {
  IdeateWorkspaceTemplateSchema,
  parseJsonString,
  RetroWorkspaceTemplateSchema,
} from '../../lib/boundary-decode'
import type { Team } from '../teams'
import type { Env } from '../../types'
import { ActionsPatchSchema, loadWorkspaceRow, TrendsQuerySchema } from './helpers'

type Vars = AuthVariables & PlanVariables

export function registerWorkspaceInstanceRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  app.get('/:id/workspaces/:wsId/instances', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const ws = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!ws) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const instances = await listWorkspaceInstances(c.env.DB, wsId)
    return c.json({ ok: true, data: { instances }, trace_id: c.get('trace_id') })
  })

  app.post('/:id/workspaces/:wsId/instances', requireFeature('recurringWorkspaces'), async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const ws = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!ws || ws.archived_at) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const created = await createWorkspaceInstance({
      db: c.env.DB,
      workspace: ws,
      ownerId: c.get('user').sub,
      teamId,
    })
    let carriedActions: Awaited<ReturnType<typeof carryOpenActionsToNewInstance>> = []
    if (ws.kind === 'retro' && c.env.ACTIONS_KV) {
      carriedActions = await carryOpenActionsToNewInstance(c.env.ACTIONS_KV, teamId, wsId, created.sessionId)
    }
    if (ws.kind === 'retro' && c.env.SESSIONS_KV) {
      const template = parseJsonString(RetroWorkspaceTemplateSchema, ws.template_json || '{}') ?? {}
      const seed: RetroSessionSeed = {
        dotVoteLimit: template.dotVoteLimit ?? DEFAULT_RETRO_TEMPLATE.dotVoteLimit,
        carriedActions: carriedActions.map((a) => a.text),
      }
      await writeKvJson(c.env.SESSIONS_KV, retroSeedKey(created.sessionId), seed, { expirationTtl: 86400 * 7 })
    }
    if (ws.kind === 'ideate' && c.env.SESSIONS_KV) {
      const template = parseJsonString(IdeateWorkspaceTemplateSchema, ws.template_json || '{}') ?? {}
      const seed: IdeateSessionSeed = {
        dotVoteLimit: template.dotVoteLimit ?? DEFAULT_IDEATE_TEMPLATE.dotVoteLimit,
        clusterDebounceMs: template.clusterDebounceMs ?? DEFAULT_IDEATE_TEMPLATE.clusterDebounceMs,
      }
      await writeKvJson(c.env.SESSIONS_KV, ideateSeedKey(created.sessionId), seed, { expirationTtl: 86400 * 7 })
    }
    return c.json(
      {
        ok: true,
        data: {
          session: {
            id: created.sessionId,
            code: created.code,
            title: created.title,
            workspaceSeq: created.workspaceSeq,
            sessionMode: created.sessionMode,
          },
          carriedActions,
        },
        trace_id: c.get('trace_id'),
      },
      201,
    )
  })

  app.get('/:id/workspaces/:wsId/actions', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const ws = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!ws) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const blob = c.env.ACTIONS_KV
      ? await readWorkspaceActions(c.env.ACTIONS_KV, teamId, wsId)
      : { items: [] }
    return c.json({
      ok: true,
      data: { items: blob.items, openCount: openActionItems(blob).length },
      trace_id: c.get('trace_id'),
    })
  })

  app.patch('/:id/workspaces/:wsId/actions', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const body = ActionsPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid actions' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const ws = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!ws) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (!c.env.ACTIONS_KV) {
      return c.json({ ok: false, error: { code: 'unavailable', message: 'Actions store unavailable' }, trace_id: c.get('trace_id') }, 503)
    }
    const now = Date.now()
    const items = body.data.items.map((item) => ({
      id: item.id ?? ulid(),
      text: item.text,
      status: item.status,
      sourceSessionId: null,
      createdAt: now,
      resolvedAt: item.status === 'resolved' ? now : null,
    }))
    await writeWorkspaceActions(c.env.ACTIONS_KV, teamId, wsId, { items })
    return c.json({ ok: true, data: { items }, trace_id: c.get('trace_id') })
  })

  app.get('/:id/workspaces/:wsId/trends', requireFeature('crossSessionInsights'), async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const parsed = TrendsQuerySchema.safeParse({
      window: c.req.query('window') ?? '90d',
      kind: c.req.query('kind') ?? 'participation',
    })
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid query' }, trace_id: c.get('trace_id') }, 400)
    }
    const window = parsed.data.window as WorkspaceTrendWindow
    const kind = parsed.data.kind as 'participation' | 'team_health'
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const ws = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!ws) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (kind === 'team_health' && ws.kind !== 'retro') {
      return c.json({ ok: false, error: { code: 'validation', message: 'Team health trends require a retro workspace' }, trace_id: c.get('trace_id') }, 400)
    }
    const kv = c.env.ACTIONS_KV ?? c.env.TEAMS_KV
    let payload = await readCachedWorkspaceTrend(kv, teamId, wsId, kind, window)
    if (!payload) {
      payload = await getWorkspaceTrend(c.env.DB, wsId, kind, window)
      if (!payload) {
        payload =
          kind === 'team_health'
            ? await recomputeWorkspaceTeamHealthTrend(c.env.DB, wsId, window)
            : await recomputeWorkspaceParticipationTrend(c.env.DB, wsId, window)
      }
      await writeCachedWorkspaceTrend(kv, teamId, wsId, kind, window, payload)
    }
    return c.json({
      ok: true,
      data: { kind, window, trend: payload },
      trace_id: c.get('trace_id'),
    })
  })
}
