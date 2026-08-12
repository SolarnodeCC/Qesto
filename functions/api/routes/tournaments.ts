/**
 * GAM-05 — bracket tournament REST (seed + list matches).
 *
 * SECURITY: every route here is object-scoped to a session the caller may
 * access. `bracket_matches` rows key only on `energizer_id`, and an energizer id
 * alone carries no tenant, so a bare `WHERE energizer_id = ?` (or
 * `WHERE id = ?` on a match) is a cross-tenant read/write. The RBAC matrix
 * lists these paths but `rbacMiddleware` deliberately hard-enforces only the
 * platform-admin surface and defers everything else to the route's own check —
 * so the check has to live here. Resolve energizer → session (or match →
 * energizer → session) and run `requireSessionAccess` before touching a row.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { seedSingleEliminationBracket } from '../lib/tournament-bracket'
import { errorResponse } from '../lib/error-handler'
import { writeEvent } from '../lib/observability'
import { requireSessionAccess } from './sessions/shared'
import {
  getEnergizerById,
  getEnergizerIdForBracketMatch,
  getSessionIdForEnergizer,
} from '../repositories/energizerRepository'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const SeedSchema = z.object({
  energizerId: z.string().min(1),
  participants: z
    .array(z.object({ id: z.string().min(1), label: z.string().max(120).optional() }))
    .min(2)
    .max(64),
})

/**
 * Authorize `(sessionId, energizerId)` for the caller.
 *
 * Both legs matter: `requireSessionAccess` proves the caller may act on the
 * session, and `getEnergizerById` proves the energizer actually belongs to
 * THAT session — without the second leg a caller could pair their own
 * sessionId with someone else's energizerId and pass the first check.
 *
 * Returns `null` when unauthorized; callers must answer 404 (never 403) so the
 * endpoint cannot be used to probe which energizer ids exist in other tenants.
 */
async function authorizeEnergizer(
  env: Env,
  sessionId: string,
  energizerId: string,
  userId: string,
): Promise<{ sessionId: string; energizerId: string } | null> {
  const session = await requireSessionAccess(env.DB, sessionId, userId)
  if (!session) return null
  const energizer = await getEnergizerById(env.DB, sessionId, energizerId)
  if (!energizer) return null
  return { sessionId: session.id, energizerId: energizer.id }
}

export function mountTournamentRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:sessionId/bracket/:energizerId', async (c) => {
    const energizerId = c.req.param('energizerId')
    const authorized = await authorizeEnergizer(c.env, c.req.param('sessionId'), energizerId, c.get('user').sub)
    if (!authorized) {
      return errorResponse(c, 404, 'not_found', 'Bracket not found')
    }
    const { results } = await c.env.DB.prepare(
      `SELECT id, round_number, match_number, participant_a_id, participant_b_id, winner_id, score_a, score_b, state
         FROM bracket_matches WHERE energizer_id = ?1 ORDER BY round_number, match_number`,
    )
      .bind(energizerId)
      .all()
    return c.json({ ok: true, data: { matches: results ?? [] }, trace_id: c.get('trace_id') })
  })

  app.post('/sessions/:sessionId/bracket/seed', async (c) => {
    const body = SeedSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return errorResponse(c, 400, 'validation', 'Invalid seed payload')
    }
    const { energizerId, participants } = body.data
    const authorized = await authorizeEnergizer(c.env, c.req.param('sessionId'), energizerId, c.get('user').sub)
    if (!authorized) {
      return errorResponse(c, 404, 'not_found', 'Energizer not found')
    }
    const existing = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bracket_matches WHERE energizer_id = ?1`,
    )
      .bind(energizerId)
      .first<{ n: number }>()
    if ((existing?.n ?? 0) > 0) {
      return errorResponse(c, 409, 'already_seeded', 'Bracket already seeded for this energizer')
    }

    const seeds = seedSingleEliminationBracket(energizerId, participants)
    for (const m of seeds) {
      await c.env.DB.prepare(
        `INSERT INTO bracket_matches (id, energizer_id, round_number, match_number, participant_a_id, participant_b_id, state, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
        .bind(m.id, m.energizer_id, m.round_number, m.match_number, m.participant_a_id, m.participant_b_id, m.state, m.created_at)
        .run()
    }

    writeEvent(c.env.METRICS_AE, {
      name: 'tournament.started',
      sessionId: c.req.param('sessionId'),
      count: seeds.length,
      detail: energizerId,
    })
    return c.json({ ok: true, data: { matchCount: seeds.length, matchIds: seeds.map((s) => s.id) }, trace_id: c.get('trace_id') }, 201)
  })

  app.get('/sessions/:sessionId/bracket/:energizerId/export', async (c) => {
    const energizerId = c.req.param('energizerId')
    const authorized = await authorizeEnergizer(c.env, c.req.param('sessionId'), energizerId, c.get('user').sub)
    if (!authorized) {
      return errorResponse(c, 404, 'not_found', 'Bracket not found')
    }
    const { results } = await c.env.DB.prepare(
      `SELECT round_number, match_number, participant_a_id, participant_b_id, winner_id, score_a, score_b, state
         FROM bracket_matches WHERE energizer_id = ?1 ORDER BY round_number, match_number`,
    )
      .bind(energizerId)
      .all()
    const lines = [
      `# Tournament export`,
      `energizer: ${energizerId}`,
      '',
      ...(results ?? []).map(
        (m) =>
          `R${(m as { round_number: number }).round_number} M${(m as { match_number: number }).match_number}: ${(m as { participant_a_id: string }).participant_a_id} vs ${(m as { participant_b_id: string }).participant_b_id} → winner ${(m as { winner_id: string | null }).winner_id ?? 'pending'}`,
      ),
    ]
    writeEvent(c.env.METRICS_AE, { name: 'tournament.completed', detail: energizerId, count: results?.length ?? 0 })
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="tournament-${energizerId}.md"`,
      },
    })
  })

  app.patch('/matches/:matchId', async (c) => {
    const body = z
      .object({
        winnerId: z.string().min(1),
        scoreA: z.number().int().nonnegative().optional(),
        scoreB: z.number().int().nonnegative().optional(),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return errorResponse(c, 400, 'validation', 'winnerId required')
    }
    const id = c.req.param('matchId')
    // The match id is the only object reference on this route, so walk it up to
    // a session before writing: match → energizer → session → access check.
    const energizerId = await getEnergizerIdForBracketMatch(c.env.DB, id)
    const sessionId = energizerId ? await getSessionIdForEnergizer(c.env.DB, energizerId) : null
    if (!energizerId || !sessionId) {
      return errorResponse(c, 404, 'not_found', 'Match not found')
    }
    const authorized = await authorizeEnergizer(c.env, sessionId, energizerId, c.get('user').sub)
    if (!authorized) {
      return errorResponse(c, 404, 'not_found', 'Match not found')
    }
    await c.env.DB.prepare(
      `UPDATE bracket_matches SET winner_id = ?1, score_a = COALESCE(?2, score_a), score_b = COALESCE(?3, score_b), state = 'completed' WHERE id = ?4`,
    )
      .bind(body.data.winnerId, body.data.scoreA ?? null, body.data.scoreB ?? null, id)
      .run()
    const remaining = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bracket_matches WHERE energizer_id = (SELECT energizer_id FROM bracket_matches WHERE id = ?1) AND state != 'completed'`,
    )
      .bind(id)
      .first<{ n: number }>()
    if ((remaining?.n ?? 1) === 0) {
      writeEvent(c.env.METRICS_AE, { name: 'tournament.completed', detail: id })
    }
    return c.json({ ok: true, data: { updated: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/tournaments', app)
}
