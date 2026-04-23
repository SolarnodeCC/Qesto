// Advanced Energizers — Battle Royale + Bracket + Emoji Poll (Phase 9)
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/energizers                        — Create energizer
//   GET    /sessions/:sessionId/energizers                        — List energizers
//   GET    /sessions/:sessionId/energizers/active                 — Get active energizer + results
//   GET    /sessions/:sessionId/energizers/:energizerId           — Get state
//   PATCH  /sessions/:sessionId/energizers/:energizerId           — Update state (activate/complete)
//   POST   /sessions/:sessionId/energizers/:energizerId/advance   — Next round (battle_royale/bracket)
//   POST   /sessions/:sessionId/energizers/:energizerId/vote      — Submit vote (emoji_poll)
//   GET    /sessions/:sessionId/leaderboard                       — Live leaderboard

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import {
  initializeBattleRoyale,
  initializeBracket,
  advanceBattleRoyaleRound,
  advanceBracketRound,
  determineBadgesAwarded,
  type EmojiPollConfig,
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
        kind: 'battle_royale' | 'bracket' | 'emoji_poll'
        prompt: string
        participants?: string[]
        bracket_size?: 4 | 8 | 16
        emojis?: string[]
      }>()

      if (!['battle_royale', 'bracket', 'emoji_poll'].includes(body.kind)) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Invalid energizer kind' }, trace_id },
          400,
        )
      }

      const energizerId = crypto.randomUUID()
      const now = Date.now()
      let config: object

      if (body.kind === 'emoji_poll') {
        const emojis = body.emojis ?? ['😀', '😐', '😕', '😡', '😴']
        config = { emojis } satisfies EmojiPollConfig
      } else {
        if (!Array.isArray(body.participants) || body.participants.length < 2) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'At least 2 participants required' }, trace_id },
            400,
          )
        }
        config = body.kind === 'battle_royale'
          ? initializeBattleRoyale(body.participants)
          : initializeBracket(body.participants, body.bracket_size ?? 8)
      }

      await (c.env.DB.prepare as any)(
        `INSERT INTO energizers (id, session_id, kind, prompt, config_json, position, state, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
        .bind(energizerId, sessionId, body.kind, body.prompt, JSON.stringify(config), 0, 'draft', now, now)
        .run()

      await recordAuditEvent(c, {
        action: 'energizer.create',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { kind: body.kind },
        trace_id,
      })

      return c.json({ ok: true, data: { id: energizerId, kind: body.kind }, trace_id }, 201)
    } catch (err) {
      console.error('[energizers] create failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  // GET /sessions/:sessionId/energizers — list all energizers for session
  app.get('/sessions/:sessionId/energizers', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')

    try {
      const result = await (c.env.DB.prepare as any)(
        `SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers
         WHERE session_id = ?1 ORDER BY position ASC`,
      )
        .bind(sessionId)
        .all()

      const energizers = (result.results ?? []).map((e: any) => ({
        id: e.id,
        kind: e.kind,
        prompt: e.prompt,
        config: JSON.parse(e.config_json),
        state: e.state,
        position: e.position,
        created_at: e.created_at,
      }))

      return c.json({ ok: true, data: { energizers }, trace_id })
    } catch (err) {
      console.error('[energizers] list failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  // GET /sessions/:sessionId/energizers/active — active energizer with vote counts
  app.get('/sessions/:sessionId/energizers/active', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')

    try {
      const energizer = await (c.env.DB.prepare as any)(
        `SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers
         WHERE session_id = ?1 AND state = 'active' LIMIT 1`,
      )
        .bind(sessionId)
        .first()

      if (!energizer) {
        return c.json({ ok: true, data: { energizer: null }, trace_id })
      }

      const config = JSON.parse(energizer.config_json)
      let results: Record<string, number> = {}

      if (energizer.kind === 'emoji_poll') {
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes
           WHERE energizer_id = ?1 GROUP BY value`,
        )
          .bind(energizer.id)
          .all()

        for (const emoji of (config as EmojiPollConfig).emojis) {
          results[emoji] = 0
        }
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) {
          results[row.value] = row.count
        }
      }

      return c.json({
        ok: true,
        data: {
          energizer: {
            id: energizer.id,
            kind: energizer.kind,
            prompt: energizer.prompt,
            config,
            state: energizer.state,
          },
          results,
        },
        trace_id,
      })
    } catch (err) {
      console.error('[energizers] active failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  // PATCH /sessions/:sessionId/energizers/:energizerId — update state
  app.patch('/sessions/:sessionId/energizers/:energizerId', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const body = await c.req.json<{ state: 'active' | 'completed' }>()
      if (!['active', 'completed'].includes(body.state)) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'state must be active or completed' }, trace_id },
          400,
        )
      }

      // If activating, deactivate any other active energizer in this session first
      if (body.state === 'active') {
        await (c.env.DB.prepare as any)(
          `UPDATE energizers SET state = 'completed', updated_at = ?1
           WHERE session_id = ?2 AND state = 'active' AND id != ?3`,
        )
          .bind(Date.now(), sessionId, energizerId)
          .run()
      }

      const result = await (c.env.DB.prepare as any)(
        `UPDATE energizers SET state = ?1, updated_at = ?2
         WHERE id = ?3 AND session_id = ?4`,
      )
        .bind(body.state, Date.now(), energizerId, sessionId)
        .run()

      if (result.meta?.changes === 0) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404,
        )
      }

      await recordAuditEvent(c, {
        action: 'energizer.activate',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { state: body.state },
        trace_id,
      })

      return c.json({ ok: true, data: { state: body.state }, trace_id })
    } catch (err) {
      console.error('[energizers] patch failed:', err)
      return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
    }
  })

  // POST /sessions/:sessionId/energizers/:energizerId/vote
  app.post('/sessions/:sessionId/energizers/:energizerId/vote', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const body = await c.req.json<{ value: string; voter_id: string }>()

      if (!body.value || !body.voter_id) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'value and voter_id required' }, trace_id },
          400,
        )
      }

      const energizer = await (c.env.DB.prepare as any)(
        `SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2`,
      )
        .bind(energizerId, sessionId)
        .first()

      if (!energizer) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404,
        )
      }

      if (energizer.state !== 'active') {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Energizer is not active' }, trace_id },
          400,
        )
      }

      if (energizer.kind === 'emoji_poll') {
        const config = JSON.parse(energizer.config_json) as EmojiPollConfig
        if (!config.emojis.includes(body.value)) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'Invalid emoji choice' }, trace_id },
            400,
          )
        }
      }

      await (c.env.DB.prepare as any)(
        `INSERT INTO energizer_votes (id, energizer_id, session_id, voter_id, value, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(energizer_id, voter_id) DO UPDATE SET value = excluded.value`,
      )
        .bind(crypto.randomUUID(), energizerId, sessionId, body.voter_id, body.value, Date.now())
        .run()

      return c.json({ ok: true, data: { voted: body.value }, trace_id })
    } catch (err) {
      console.error('[energizers] vote failed:', err)
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
        const { advancing, scaledScores } = advanceBattleRoyaleRound(
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
          ...(winners.champion === user.sub ? { leaderboard_rank: 1 } : {}),
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
         WHERE id = ?1 AND session_id = ?2`,
      )
        .bind(energizerId, sessionId)
        .first()

      if (!result) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404,
        )
      }

      const config = JSON.parse(result.config_json)
      let results: Record<string, number> | undefined

      if (result.kind === 'emoji_poll') {
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes WHERE energizer_id = ?1 GROUP BY value`,
        )
          .bind(energizerId)
          .all()

        results = {}
        for (const emoji of (config as EmojiPollConfig).emojis) {
          results[emoji] = 0
        }
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) {
          results[row.value] = row.count
        }
      }

      return c.json(
        {
          ok: true,
          data: {
            id: result.id,
            kind: result.kind,
            prompt: result.prompt,
            config,
            state: result.state,
            position: result.position,
            created_at: result.created_at,
            ...(results !== undefined ? { results } : {}),
          },
          trace_id,
        },
        200,
      )
    } catch (err) {
      console.error('[energizers] get failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500,
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
