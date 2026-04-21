// Advanced Energizers — Battle Royale + Bracket competitions (Phase 9 Step 1)
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/energizers              — Create energizer
//   GET    /sessions/:sessionId/energizers/:energizerId — Get state
//   POST   /sessions/:sessionId/energizers/:energizerId/advance — Next round
//   GET    /sessions/:sessionId/leaderboard             — Live leaderboard

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import {
  initializeBattleRoyale,
  initializeBracket,
  advanceBattleRoyaleRound,
  advanceBracketRound,
  getBattleRoyaleWinner,
  getBracketWinner,
  determineBadgesAwarded,
} from '../lib/gamification'
import { recordAuditEvent } from '../lib/audit'
import type { Env } from '../types'

type Vars = AuthVariables

export function mountEnergizerRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  // POST /sessions/:sessionId/energizers
  app.post('/sessions/:sessionId/energizers', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')

    try {
      const body = await c.req.json<{
        kind: 'battle_royale' | 'bracket'
        prompt: string
        participants: string[]
        bracket_size?: 4 | 8 | 16
      }>()

      if (!['battle_royale', 'bracket'].includes(body.kind)) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Invalid energizer kind' }, trace_id },
          400,
        )
      }

      if (!Array.isArray(body.participants) || body.participants.length < 2) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'At least 2 participants required' }, trace_id },
          400,
        )
      }

      const energizerId = crypto.randomUUID()
      const config = body.kind === 'battle_royale'
        ? initializeBattleRoyale(body.participants)
        : initializeBracket(body.participants, body.bracket_size ?? 8)

      // Insert energizer
      const now = Date.now()
      await (c.env.DB.prepare as any)(
        `INSERT INTO energizers (id, session_id, kind, prompt, config_json, position, state, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
        .bind(energizerId, sessionId, body.kind, body.prompt, JSON.stringify(config), 0, 'draft', now, now)
        .run()

      // Audit
      await recordAuditEvent(c, {
        action: 'energizer.create',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { kind: body.kind, participant_count: body.participants.length },
        trace_id,
      })

      return c.json({ ok: true, data: { id: energizerId, kind: body.kind }, trace_id }, 201)
    } catch (err) {
      console.error('[energizers] create failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  // POST /sessions/:sessionId/energizers/:energizerId/advance
  app.post('/sessions/:sessionId/energizers/:energizerId/advance', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const body = await c.req.json<{
        scores: Record<string, number> // participant_id -> score
        round: number // current round number
      }>()

      // Fetch energizer config
      const energizer = await (c.env.DB.prepare as any)(
        `SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2`
      )
        .bind(energizerId, sessionId)
        .first()

      if (!energizer) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404
        )
      }

      const config = JSON.parse(energizer.config_json)
      let nextState = energizer.state
      let winners = null
      let nextRound = null

      if (energizer.kind === 'battle_royale') {
        const { advancing, eliminated, scaledScores } = advanceBattleRoyaleRound(
          config.participants,
          body.scores,
          config.elimination_threshold ?? 0.5,
          config.scoring_multiplier ?? 1
        )

        // Check if competition is over
        if (advancing.length === 1) {
          nextState = 'completed'
          winners = { champion: advancing[0], scores: scaledScores }
        } else {
          nextRound = { round: body.round + 1, participants: advancing, scores: scaledScores }
          config.participants = advancing
        }
      } else if (energizer.kind === 'bracket') {
        const winnerIds = Object.entries(body.scores)
          .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
          .slice(0, Object.keys(body.scores).length / 2)
          .map(([id]) => id)

        const nextMatches = advanceBracketRound(winnerIds)

        // Check if bracket is over (only 1 winner)
        if (nextMatches.length === 0 || winnerIds.length === 1) {
          nextState = 'completed'
          winners = { champion: winnerIds[0], scores: body.scores }
        } else {
          nextRound = { round: body.round + 1, matches: nextMatches }
        }
      }

      // Update energizer state
      await (c.env.DB.prepare as any)(
        `UPDATE energizers SET state = ?1, config_json = ?2, updated_at = ?3 WHERE id = ?4`
      )
        .bind(nextState, JSON.stringify(config), Date.now(), energizerId)
        .run()

      // Award badges if competition completed
      if (nextState === 'completed' && winners) {
        const user = c.get('user')
        const badges = determineBadgesAwarded(user.sub, {
          leaderboard_rank: winners.champion === user.sub ? 1 : undefined,
        })

        if (badges.length > 0) {
          for (const badge of badges) {
            await (c.env.DB.prepare as any)(
              `INSERT OR IGNORE INTO badges (user_id, badge_type, session_id, awarded_at)
               VALUES (?1, ?2, ?3, ?4)`
            )
              .bind(user.sub, badge, sessionId, Date.now())
              .run()
          }
        }
      }

      // Audit
      await recordAuditEvent(c, {
        action: 'energizer.advance',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { round: body.round + 1, state: nextState, winners },
        trace_id,
      })

      return c.json(
        {
          ok: true,
          data: { state: nextState, nextRound, winners },
          trace_id,
        },
        200
      )
    } catch (err) {
      console.error('[energizers] advance failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500
      )
    }
  })

  // GET /sessions/:sessionId/energizers/:energizerId
  app.get('/sessions/:sessionId/energizers/:energizerId', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const result = await (c.env.DB.prepare as any)(
        `SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers
         WHERE id = ?1 AND session_id = ?2`
      )
        .bind(energizerId, sessionId)
        .first()

      if (!result) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404
        )
      }

      return c.json(
        {
          ok: true,
          data: {
            id: result.id,
            kind: result.kind,
            prompt: result.prompt,
            config: JSON.parse(result.config_json),
            state: result.state,
            position: result.position,
            created_at: result.created_at,
          },
          trace_id,
        },
        200
      )
    } catch (err) {
      console.error('[energizers] get failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500
      )
    }
  })

  // GET /sessions/:sessionId/leaderboard
  app.get('/sessions/:sessionId/leaderboard', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')

    try {
      const result = await (c.env.DB.prepare as any)(
        `SELECT user_id, rank, score FROM leaderboard_entries
         WHERE session_id = ?1 ORDER BY rank ASC LIMIT 100`,
      )
        .bind(sessionId)
        .all()

      return c.json(
        { ok: true, data: { entries: result.results ?? [], updated_at: Date.now() }, trace_id },
        200,
      )
    } catch (err) {
      console.error('[leaderboard] get failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  parent.route('/api', app)
}
