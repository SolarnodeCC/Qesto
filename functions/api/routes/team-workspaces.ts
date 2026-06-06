/**
 * ADR-0048 — recurring workspaces (RETRO / IDEATE / EVENT).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { ulid } from '../lib/ulid'
import {
  canAdminWorkspace,
  canReadWorkspace,
  canWriteWorkspace,
} from '../lib/workspace-rbac'
import { purgeWorkspaceActions } from '../lib/workspace-actions'
import { defaultTemplateForKind } from '../lib/workspace-instances'
import { purgeWorkspaceTrends } from '../lib/workspace-trends'
import type { WorkspaceKind, WorkspaceRow } from '../lib/workspace-types'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'
import {
  loadWorkspaceRow,
  mapWorkspace,
  WorkspaceCreateSchema,
  WorkspaceKindQuerySchema,
  WorkspacePatchSchema,
} from './team-workspaces/helpers'
import { registerWorkspaceInstanceRoutes } from './team-workspaces/instance-routes'

type Vars = AuthVariables & PlanVariables

export function mountTeamWorkspaceRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:id/workspaces', async (c) => {
    const teamId = c.req.param('id')
    const parsedQuery = WorkspaceKindQuerySchema.safeParse({ kind: c.req.query('kind') })
    if (!parsedQuery.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid kind' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (!canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Not a member' }, trace_id: c.get('trace_id') }, 403)
    }
    const kind = parsedQuery.data.kind
    const sql = kind
      ? `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
                created_by, created_at, updated_at
           FROM workspaces WHERE team_id = ?1 AND kind = ?2 AND archived_at IS NULL ORDER BY updated_at DESC`
      : `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
                created_by, created_at, updated_at
           FROM workspaces WHERE team_id = ?1 AND archived_at IS NULL ORDER BY updated_at DESC`
    const rows = kind
      ? await c.env.DB.prepare(sql).bind(teamId, kind).all<WorkspaceRow>()
      : await c.env.DB.prepare(sql).bind(teamId).all<WorkspaceRow>()
    return c.json({
      ok: true,
      data: { workspaces: (rows.results ?? []).map(mapWorkspace) },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/:id/workspaces', requireFeature('recurringWorkspaces'), async (c) => {
    const teamId = c.req.param('id')
    const body = WorkspaceCreateSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid workspace' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (!canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const now = Date.now()
    const id = ulid()
    const kind = body.data.kind as WorkspaceKind
    const cadence = kind === 'event' ? null : (body.data.cadence ?? 'sprint')
    const template = body.data.templateJson ?? defaultTemplateForKind(kind)
    await c.env.DB.prepare(
      `INSERT INTO workspaces (id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8, ?9, ?10)`,
    )
      .bind(
        id,
        teamId,
        kind,
        body.data.title,
        JSON.stringify(template),
        cadence,
        body.data.retentionDays ?? null,
        c.get('user').sub,
        now,
        now,
      )
      .run()
    return c.json(
      {
        ok: true,
        data: { workspace: { id, teamId, kind, title: body.data.title, createdAt: now } },
        trace_id: c.get('trace_id'),
      },
      201,
    )
  })

  app.get('/:id/workspaces/:wsId', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canReadWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const row = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!row) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    return c.json({ ok: true, data: { workspace: mapWorkspace(row) }, trace_id: c.get('trace_id') })
  })

  app.patch('/:id/workspaces/:wsId', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const body = WorkspacePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid patch' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canWriteWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const existing = await loadWorkspaceRow(c.env.DB, wsId, teamId)
    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    let n = 1
    const sets: string[] = [`updated_at = ?${n++}`]
    const binds: unknown[] = [Date.now()]
    if (body.data.title) {
      sets.push(`title = ?${n++}`)
      binds.push(body.data.title)
    }
    if (body.data.templateJson) {
      sets.push(`template_json = ?${n++}`)
      binds.push(JSON.stringify(body.data.templateJson))
    }
    if (body.data.cadence !== undefined) {
      sets.push(`cadence = ?${n++}`)
      binds.push(body.data.cadence)
    }
    if (body.data.retentionDays !== undefined) {
      sets.push(`retention_days = ?${n++}`)
      binds.push(body.data.retentionDays)
    }
    if (body.data.archived === true) {
      sets.push(`archived_at = ?${n++}`)
      binds.push(Date.now())
    } else if (body.data.archived === false) {
      sets.push(`archived_at = ?${n++}`)
      binds.push(null)
    }
    const idParam = n++
    const teamParam = n
    binds.push(wsId, teamId)
    await c.env.DB.prepare(
      `UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?${idParam} AND team_id = ?${teamParam}`,
    )
      .bind(...binds)
      .run()
    return c.json({ ok: true, data: { updated: true }, trace_id: c.get('trace_id') })
  })

  app.delete('/:id/workspaces/:wsId', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !canAdminWorkspace(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    await c.env.DB.prepare(`UPDATE sessions SET workspace_id = NULL, workspace_seq = NULL WHERE workspace_id = ?1`)
      .bind(wsId)
      .run()
    await purgeWorkspaceTrends(c.env.DB, wsId)
    if (c.env.ACTIONS_KV) {
      await purgeWorkspaceActions(c.env.ACTIONS_KV, teamId, wsId)
    }
    await c.env.DB.prepare(`DELETE FROM workspaces WHERE id = ?1 AND team_id = ?2`).bind(wsId, teamId).run()
    return c.json({ ok: true, data: { deleted: true }, trace_id: c.get('trace_id') })
  })

  registerWorkspaceInstanceRoutes(app)
  parent.route('/api/teams', app)
}
