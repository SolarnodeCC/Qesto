/**
 * ADR-0048 — recurring workspaces (RETRO / IDEATE / EVENT).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import { readKvJson, writeKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { ulid } from '../lib/ulid'
import {
  canAdminWorkspace,
  canReadWorkspace,
  canWriteWorkspace,
} from '../lib/workspace-rbac'
import {
  carryOpenActionsToNewInstance,
  openActionItems,
  purgeWorkspaceActions,
  readWorkspaceActions,
  writeWorkspaceActions,
} from '../lib/workspace-actions'
import {
  createWorkspaceInstance,
  defaultTemplateForKind,
  listWorkspaceInstances,
} from '../lib/workspace-instances'
import {
  getWorkspaceTrend,
  recomputeWorkspaceParticipationTrend,
  recomputeWorkspaceTeamHealthTrend,
  readCachedWorkspaceTrend,
  purgeWorkspaceTrends,
  writeCachedWorkspaceTrend,
} from '../lib/workspace-trends'
import type { WorkspaceKind, WorkspaceRow, WorkspaceTrendWindow } from '../lib/workspace-types'
import { DEFAULT_IDEATE_TEMPLATE, DEFAULT_RETRO_TEMPLATE } from '../lib/workspace-types'
import { ideateSeedKey, type IdeateSessionSeed } from './ideate-sessions'
import { retroSeedKey, type RetroSessionSeed } from './retro-sessions'
import {
  IdeateWorkspaceTemplateSchema,
  decodeKvJson,
  RetroWorkspaceTemplateSchema,
} from '../lib/boundary-decode'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const WorkspaceKindSchema = z.enum(['retro', 'ideate', 'event'])
const WorkspaceCadenceSchema = z.enum(['weekly', 'biweekly', 'sprint', 'manual'])

const WorkspaceCreateSchema = z.object({
  kind: WorkspaceKindSchema,
  title: z.string().trim().min(1).max(120),
  templateJson: z.record(z.string(), z.unknown()).optional(),
  cadence: WorkspaceCadenceSchema.optional(),
  retentionDays: z.number().int().min(7).max(3650).optional(),
})

const WorkspacePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  templateJson: z.record(z.string(), z.unknown()).optional(),
  cadence: WorkspaceCadenceSchema.nullable().optional(),
  retentionDays: z.number().int().min(7).max(3650).nullable().optional(),
  archived: z.boolean().optional(),
})

const WorkspaceKindQuerySchema = z.object({
  kind: WorkspaceKindSchema.optional(),
})

const ActionsPatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().trim().min(1).max(500),
      status: z.enum(['open', 'resolved']),
    }),
  ),
})

const TrendsQuerySchema = z.object({
  window: z.enum(['30d', '90d', '180d']).default('90d'),
  kind: z.enum(['participation', 'team_health']).default('participation'),
})

function mapWorkspace(row: WorkspaceRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    kind: row.kind,
    title: row.title,
    template: JSON.parse(row.template_json || '{}'),
    cadence: row.cadence,
    retentionDays: row.retention_days,
    lastInstanceAt: row.last_instance_at,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadWorkspaceRow(db: D1Database, wsId: string, teamId: string): Promise<WorkspaceRow | null> {
  return db
    .prepare(
      `SELECT id, team_id, kind, title, template_json, cadence, retention_days, last_instance_at, archived_at,
              created_by, created_at, updated_at
         FROM workspaces WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(wsId, teamId)
    .first<WorkspaceRow>()
}

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
    let team: Team | null = null
    try {
      team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    } catch {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') }, 404)
    }
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
    let rows: { results: WorkspaceRow[] }
    try {
      rows = kind
        ? await c.env.DB.prepare(sql).bind(teamId, kind).all<WorkspaceRow>()
        : await c.env.DB.prepare(sql).bind(teamId).all<WorkspaceRow>()
    } catch (err) {
      throw new Error(`Failed to fetch workspaces: ${err instanceof Error ? err.message : String(err)}`)
    }
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
      const template = decodeKvJson(ws.template_json || '{}', RetroWorkspaceTemplateSchema) ?? {}
      const seed: RetroSessionSeed = {
        dotVoteLimit: template.dotVoteLimit ?? DEFAULT_RETRO_TEMPLATE.dotVoteLimit,
        carriedActions: carriedActions.map((a) => a.text),
      }
      await writeKvJson(c.env.SESSIONS_KV, retroSeedKey(created.sessionId), seed, { expirationTtl: 86400 * 7 })
    }
    if (ws.kind === 'ideate' && c.env.SESSIONS_KV) {
      const template = decodeKvJson(ws.template_json || '{}', IdeateWorkspaceTemplateSchema) ?? {}
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

  parent.route('/api/teams', app)
}
