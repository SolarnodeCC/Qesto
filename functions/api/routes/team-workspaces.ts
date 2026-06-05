/**
 * RETRO-WORKSPACE-01 + IDEATE-BOARD-01 — recurring workspaces CRUD.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { ulid } from '../lib/ulid'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const WorkspaceCreateSchema = z.object({
  kind: z.enum(['retro', 'ideate']),
  title: z.string().trim().min(1).max(120),
  templateJson: z.record(z.string(), z.unknown()).optional(),
})

const WorkspacePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  templateJson: z.record(z.string(), z.unknown()).optional(),
})

const WorkspaceKindQuerySchema = z.object({
  kind: z.enum(['retro', 'ideate']).optional(),
})

function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountTeamWorkspaceRoutes(parent: any) {
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
    if (!isTeamMember(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Not a member' }, trace_id: c.get('trace_id') }, 403)
    }
    const kind = parsedQuery.data.kind
    const rows = kind
      ? await c.env.DB.prepare(
          `SELECT id, team_id, kind, title, template_json, created_by, created_at, updated_at
             FROM workspaces WHERE team_id = ?1 AND kind = ?2 ORDER BY updated_at DESC`,
        )
          .bind(teamId, kind)
          .all<{
        id: string
        team_id: string
        kind: string
        title: string
        template_json: string
        created_by: string
        created_at: number
        updated_at: number
      }>()
      : await c.env.DB.prepare(
          `SELECT id, team_id, kind, title, template_json, created_by, created_at, updated_at
             FROM workspaces WHERE team_id = ?1 ORDER BY updated_at DESC`,
        )
          .bind(teamId)
          .all<{
        id: string
        team_id: string
        kind: string
        title: string
        template_json: string
        created_by: string
        created_at: number
        updated_at: number
      }>()
    return c.json({
      ok: true,
      data: {
        workspaces: (rows.results ?? []).map((r) => ({
          id: r.id,
          teamId: r.team_id,
          kind: r.kind,
          title: r.title,
          template: JSON.parse(r.template_json || '{}'),
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/:id/workspaces', async (c) => {
    const teamId = c.req.param('id')
    const body = WorkspaceCreateSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid workspace' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Not a member' }, trace_id: c.get('trace_id') }, 403)
    }
    const now = Date.now()
    const id = ulid()
    await c.env.DB.prepare(
      `INSERT INTO workspaces (id, team_id, kind, title, template_json, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(
        id,
        teamId,
        body.data.kind,
        body.data.title,
        JSON.stringify(body.data.templateJson ?? {}),
        c.get('user').sub,
        now,
        now,
      )
      .run()
    return c.json(
      {
        ok: true,
        data: { workspace: { id, teamId, kind: body.data.kind, title: body.data.title, createdAt: now } },
        trace_id: c.get('trace_id'),
      },
      201,
    )
  })

  app.get('/:id/workspaces/:wsId', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !isTeamMember(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const row = await c.env.DB.prepare(
      `SELECT id, team_id, kind, title, template_json, created_by, created_at, updated_at
         FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
      .bind(wsId, teamId)
      .first<{
        id: string
        team_id: string
        kind: string
        title: string
        template_json: string
        created_by: string
        created_at: number
        updated_at: number
      }>()
    if (!row) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Workspace not found' }, trace_id: c.get('trace_id') }, 404)
    }
    return c.json({
      ok: true,
      data: {
        workspace: {
          id: row.id,
          teamId: row.team_id,
          kind: row.kind,
          title: row.title,
          template: JSON.parse(row.template_json || '{}'),
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.patch('/:id/workspaces/:wsId', async (c) => {
    const { id: teamId, wsId } = c.req.param()
    const body = WorkspacePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid patch' }, trace_id: c.get('trace_id') }, 400)
    }
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !isTeamMember(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    const existing = await c.env.DB.prepare(`SELECT id FROM workspaces WHERE id = ?1 AND team_id = ?2`)
      .bind(wsId, teamId)
      .first()
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
    if (!team || !isTeamMember(team, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Forbidden' }, trace_id: c.get('trace_id') }, 403)
    }
    await c.env.DB.prepare(`DELETE FROM workspaces WHERE id = ?1 AND team_id = ?2`).bind(wsId, teamId).run()
    return c.json({ ok: true, data: { deleted: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}
