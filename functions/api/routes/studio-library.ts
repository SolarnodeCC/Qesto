/**
 * STUDIO-LIBRARY-01 (ADR-0060, S97) — persistent content library for the STUDIO
 * authoring co-pilot.
 *
 * Drafts produced by `POST /api/studio/authoring/generate` are ephemeral. These
 * routes let an operator SAVE a validated authored question, LIST the team's
 * library, FORK an existing item into an independent copy (incrementing the
 * original's use_count), and DELETE an item.
 *
 * Tenant isolation: every route resolves the caller's team via TEAMS_KV (mirroring
 * routes/federation.ts) and scopes every D1 read/write to that team_id, so a team
 * only ever sees its own library. Cross-tenant fork is OUT OF SCOPE this sprint.
 *
 * Audit discipline mirrors `routes/studio.ts`: a non-PII snapshot (id / team / source
 * / action), never the question prompt, options, or topic text.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { AIQuestionSchema } from '../lib/domain-schemas'
import { STUDIO_THEME_NAMES } from '../lib/studio-theme'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { recordAuditEvent } from '../lib/audit'
import { writeEvent } from '../lib/observability'
import { fail, ok } from '../lib/http'
import {
  insertLibraryItem,
  listLibraryItems,
  getLibraryItem,
  incrementUseCount,
  deleteLibraryItem,
} from '../repositories/studioLibraryRepository'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const SaveSchema = z.object({
  teamId: z.string().min(1).max(128),
  questionJson: AIQuestionSchema,
  themeId: z.enum(STUDIO_THEME_NAMES).optional(),
  title: z.string().trim().min(1).max(200),
})

function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

/** Clamp a query-string positive int into [0, max] with a fallback. */
function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

export function mountStudioLibraryRoutes(parent: ParentApp) {
  const app = new Hono<{
    Bindings: Env
    Variables: AuthVariables & PlanVariables & { trace_id: string }
  }>()

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // POST /api/studio/library — save an authored draft.
  app.post('/library', async (c) => {
    if (!c.env.TEAMS_KV) {
      return fail(c, 'kv_unavailable', 'TEAMS_KV required', 503)
    }
    const parsed = await validateBody(c, SaveSchema)
    if ('error' in parsed) return parsed.error

    const user = c.get('user')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(parsed.data.teamId))
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isTeamMember(team, user.sub)) {
      return fail(c, 'forbidden', 'Not a member of this team', 403)
    }

    const now = Date.now()
    const item = await insertLibraryItem(c.env.DB, {
      id: crypto.randomUUID(),
      teamId: team.id,
      createdBy: user.sub,
      source: 'authored',
      forkedFromId: null,
      questionJson: parsed.data.questionJson,
      themeId: parsed.data.themeId ?? null,
      title: parsed.data.title,
      now,
    })

    await recordAuditEvent(c, {
      action: 'studio.library.saved',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: { id: item.id, source: item.source, themeApplied: item.theme_id !== null },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, {
      name: 'studio.library_saved',
      userId: user.sub,
      teamId: team.id,
      plan: c.get('plan'),
      detail: item.source,
      traceId: c.get('trace_id'),
    })

    return ok(c, { item }, 201)
  })

  // GET /api/studio/library?teamId=...&limit=&offset= — list the team's items.
  app.get('/library', async (c) => {
    if (!c.env.TEAMS_KV) {
      return fail(c, 'kv_unavailable', 'TEAMS_KV required', 503)
    }
    const teamId = c.req.query('teamId')
    if (!teamId) return fail(c, 'bad_request', 'teamId required', 400)

    const user = c.get('user')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isTeamMember(team, user.sub)) {
      return fail(c, 'forbidden', 'Not a member of this team', 403)
    }

    const limit = parseBoundedInt(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    const offset = parseBoundedInt(c.req.query('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    const items = await listLibraryItems(c.env.DB, team.id, limit, offset)

    return ok(c, { items, limit, offset })
  })

  // POST /api/studio/library/:id/fork — copy an item into a new independent item.
  app.post('/library/:id/fork', async (c) => {
    if (!c.env.TEAMS_KV) {
      return fail(c, 'kv_unavailable', 'TEAMS_KV required', 503)
    }
    const teamId = c.req.query('teamId')
    if (!teamId) return fail(c, 'bad_request', 'teamId required', 400)

    const user = c.get('user')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isTeamMember(team, user.sub)) {
      return fail(c, 'forbidden', 'Not a member of this team', 403)
    }

    // Tenant-scoped read: a cross-team item resolves to null → 404 (no leakage).
    const original = await getLibraryItem(c.env.DB, c.req.param('id'), team.id)
    if (!original) return fail(c, 'not_found', 'Library item not found', 404)

    const now = Date.now()
    const fork = await insertLibraryItem(c.env.DB, {
      id: crypto.randomUUID(),
      teamId: team.id,
      createdBy: user.sub,
      source: 'fork',
      forkedFromId: original.id,
      questionJson: original.question_json,
      themeId: original.theme_id,
      title: original.title,
      now,
    })
    await incrementUseCount(c.env.DB, original.id, team.id, now)

    await recordAuditEvent(c, {
      action: 'studio.library.forked',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: { id: fork.id, source: fork.source, forkedFromId: original.id },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, {
      name: 'studio.library_forked',
      userId: user.sub,
      teamId: team.id,
      plan: c.get('plan'),
      detail: original.id,
      traceId: c.get('trace_id'),
    })

    return ok(c, { item: { ...fork, use_count: 0 }, forkedFrom: original.id }, 201)
  })

  // DELETE /api/studio/library/:id — remove an item (tenant-scoped).
  app.delete('/library/:id', async (c) => {
    if (!c.env.TEAMS_KV) {
      return fail(c, 'kv_unavailable', 'TEAMS_KV required', 503)
    }
    const teamId = c.req.query('teamId')
    if (!teamId) return fail(c, 'bad_request', 'teamId required', 400)

    const user = c.get('user')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) return fail(c, 'not_found', 'Team not found', 404)
    if (!isTeamMember(team, user.sub)) {
      return fail(c, 'forbidden', 'Not a member of this team', 403)
    }

    const id = c.req.param('id')
    const changes = await deleteLibraryItem(c.env.DB, id, team.id)
    if (changes === 0) return fail(c, 'not_found', 'Library item not found', 404)

    await recordAuditEvent(c, {
      action: 'studio.library.deleted',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: { id },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, {
      name: 'studio.library_deleted',
      userId: user.sub,
      teamId: team.id,
      plan: c.get('plan'),
      detail: id,
      traceId: c.get('trace_id'),
    })

    return ok(c, { deleted: true, id })
  })

  parent.route('/api/studio', app)
}
