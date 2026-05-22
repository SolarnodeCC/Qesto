/**
 * GAM-05 — bracket tournament REST (seed + list matches).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { seedSingleEliminationBracket } from '../lib/tournament-bracket'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const SeedSchema = z.object({
  energizerId: z.string().min(1),
  participants: z
    .array(z.object({ id: z.string().min(1), label: z.string().max(120).optional() }))
    .min(2)
    .max(64),
})

export function mountTournamentRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:sessionId/bracket/:energizerId', async (c) => {
    const energizerId = c.req.param('energizerId')
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
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid seed payload' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const { energizerId, participants } = body.data
    const existing = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bracket_matches WHERE energizer_id = ?1`,
    )
      .bind(energizerId)
      .first<{ n: number }>()
    if ((existing?.n ?? 0) > 0) {
      return c.json(
        { ok: false, error: { code: 'already_seeded', message: 'Bracket already seeded for this energizer' }, trace_id: c.get('trace_id') },
        409,
      )
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

    return c.json({ ok: true, data: { matchCount: seeds.length, matchIds: seeds.map((s) => s.id) }, trace_id: c.get('trace_id') }, 201)
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
      return c.json(
        { ok: false, error: { code: 'validation', message: 'winnerId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const id = c.req.param('matchId')
    await c.env.DB.prepare(
      `UPDATE bracket_matches SET winner_id = ?1, score_a = COALESCE(?2, score_a), score_b = COALESCE(?3, score_b), state = 'completed' WHERE id = ?4`,
    )
      .bind(body.data.winnerId, body.data.scoreA ?? null, body.data.scoreB ?? null, id)
      .run()
    return c.json({ ok: true, data: { updated: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/tournaments', app)
}
