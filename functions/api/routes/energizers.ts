// Advanced Energizers — Battle Royale + Bracket + Emoji Poll + Quick Finger + Team Quiz + Word Cloud
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/energizers                        — Create energizer
//   GET    /sessions/:sessionId/energizers                        — List energizers
//   GET    /sessions/:sessionId/energizers/active                 — Get active energizer + results
//   GET    /sessions/:sessionId/energizers/:energizerId           — Get state + results
//   PATCH  /sessions/:sessionId/energizers/:energizerId           — Update state / prompt / config
//   POST   /sessions/:sessionId/energizers/:energizerId/vote      — Submit vote / answer / word
//   POST   /sessions/:sessionId/energizers/:energizerId/next      — Team Quiz: advance question
//   POST   /sessions/:sessionId/energizers/:energizerId/advance   — battle_royale/bracket: next round
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
  type QuickFingerConfig,
  type TeamQuizConfig,
  type WordCloudConfig,
} from '../lib/gamification'
import { recordAuditEvent } from '../lib/audit'
import { sanitizeError } from '../lib/error-handler'
import { z } from 'zod'
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
      const CreateEnergizerSchema = z.object({
        kind: z.enum(['battle_royale', 'bracket', 'emoji_poll', 'quick_finger', 'team_quiz', 'word_cloud']),
        prompt: z.string().min(1).max(400),
        participants: z.array(z.string()).optional(),
        bracket_size: z.union([z.literal(4), z.literal(8), z.literal(16)]).optional(),
        emojis: z.array(z.string()).optional(),
        options: z.array(z.string()).optional(),
        correct_index: z.number().int().nonnegative().optional(),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = CreateEnergizerSchema.safeParse(raw)
      if (!parsed.success) {
        return c.json({ ok: false, error: { code: 'validation', message: 'Invalid energizer payload' }, trace_id }, 400)
      }
      const body = parsed.data

      if (!['battle_royale', 'bracket', 'emoji_poll', 'quick_finger', 'team_quiz', 'word_cloud'].includes(body.kind)) {
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
      } else if (body.kind === 'quick_finger') {
        const options = body.options ?? ['Option A', 'Option B', 'Option C', 'Option D']
        config = { options, correct_index: body.correct_index ?? 0 } satisfies QuickFingerConfig
      } else if (body.kind === 'team_quiz') {
        const defaultQ = (n: number) => ({
          prompt: `Question ${n}`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_index: 0,
        })
        config = {
          questions: [defaultQ(1), defaultQ(2), defaultQ(3)],
          current_index: -1,
        } satisfies TeamQuizConfig
      } else if (body.kind === 'word_cloud') {
        config = { max_words_per_participant: 1 } satisfies WordCloudConfig
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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
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
      let rankings: Array<{ voter_id: string; value: string; correct: boolean; speed_ms: number; rank: number }> | undefined
      const activatedAt = energizer.updated_at as number

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
      } else if (energizer.kind === 'quick_finger') {
        const qf = config as QuickFingerConfig
        const correctAnswer = qf.options[qf.correct_index]

        const votes = await (c.env.DB.prepare as any)(
          `SELECT voter_id, value, created_at FROM energizer_votes
           WHERE energizer_id = ?1 ORDER BY created_at ASC`,
        )
          .bind(energizer.id)
          .all()

        let rank = 1
        rankings = (votes.results ?? []).map((v: { voter_id: string; value: string; created_at: number }) => {
          const correct = v.value === correctAnswer
          return {
            voter_id: v.voter_id,
            value: v.value,
            correct,
            speed_ms: Math.max(0, v.created_at - activatedAt),
            rank: correct ? rank++ : -1,
          }
        })
      } else if (energizer.kind === 'team_quiz') {
        const tq = config as TeamQuizConfig
        const qi = tq.current_index
        // response count for current question
        let responseCount = 0
        if (qi >= 0 && qi < tq.questions.length) {
          const cnt = await (c.env.DB.prepare as any)(
            `SELECT COUNT(*) as n FROM team_quiz_responses WHERE energizer_id = ?1 AND question_index = ?2`,
          )
            .bind(energizer.id, qi)
            .first()
          responseCount = (cnt?.n as number) ?? 0
        }
        // running scores per voter
        const rows = await (c.env.DB.prepare as any)(
          `SELECT voter_id, SUM(correct) as score FROM team_quiz_responses
           WHERE energizer_id = ?1 GROUP BY voter_id ORDER BY score DESC`,
        )
          .bind(energizer.id)
          .all()
        const scores = (rows.results ?? []).map((r: { voter_id: string; score: number }, i: number) => ({
          voter_id: r.voter_id,
          score: r.score,
          rank: i + 1,
        }))
        return c.json({
          ok: true,
          data: {
            energizer: { id: energizer.id, kind: energizer.kind, prompt: energizer.prompt, config, state: energizer.state },
            response_count: responseCount,
            scores,
          },
          trace_id,
        })
      } else if (energizer.kind === 'word_cloud') {
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes
           WHERE energizer_id = ?1 GROUP BY value ORDER BY count DESC`,
        )
          .bind(energizer.id)
          .all()
        const words: Record<string, number> = {}
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) {
          words[row.value] = row.count
        }
        return c.json({
          ok: true,
          data: {
            energizer: { id: energizer.id, kind: energizer.kind, prompt: energizer.prompt, config, state: energizer.state },
            words,
          },
          trace_id,
        })
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
          ...(rankings !== undefined ? { rankings } : {}),
        },
        trace_id,
      })
    } catch (err) {
      console.error('[energizers] active failed:', err)
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  // PATCH /sessions/:sessionId/energizers/:energizerId — update state and/or config
  app.patch('/sessions/:sessionId/energizers/:energizerId', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const body = await c.req.json<{
        state?: 'active' | 'completed'
        prompt?: string
        config?: object
      }>()

      if (body.state !== undefined && !['active', 'completed'].includes(body.state)) {
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

      // Build dynamic SET clause based on provided fields
      const sets: string[] = ['updated_at = ?1']
      const binds: unknown[] = [Date.now()]
      let paramIdx = 2

      if (body.state !== undefined) {
        sets.push(`state = ?${paramIdx++}`)
        binds.push(body.state)
      }
      if (body.prompt !== undefined) {
        sets.push(`prompt = ?${paramIdx++}`)
        binds.push(body.prompt)
      }
      if (body.config !== undefined) {
        sets.push(`config_json = ?${paramIdx++}`)
        binds.push(JSON.stringify(body.config))
      }

      binds.push(energizerId, sessionId)
      const result = await (c.env.DB.prepare as any)(
        `UPDATE energizers SET ${sets.join(', ')}
         WHERE id = ?${paramIdx++} AND session_id = ?${paramIdx++}`,
      )
        .bind(...binds)
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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
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
      } else if (energizer.kind === 'quick_finger') {
        const config = JSON.parse(energizer.config_json) as QuickFingerConfig
        if (!config.options.includes(body.value)) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'Invalid answer choice' }, trace_id },
            400,
          )
        }
      } else if (energizer.kind === 'word_cloud') {
        const trimmed = body.value.trim()
        if (!trimmed || /\s/.test(trimmed)) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'Submit a single word' }, trace_id },
            400,
          )
        }
      }

      // team_quiz stores per-question responses in team_quiz_responses table
      if (energizer.kind === 'team_quiz') {
        const config = JSON.parse(energizer.config_json) as TeamQuizConfig
        const qi = config.current_index
        if (qi < 0 || qi >= config.questions.length) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'No active question' }, trace_id },
            400,
          )
        }
        const q = config.questions[qi]
        const correct = body.value === q.options[q.correct_index] ? 1 : 0
        await (c.env.DB.prepare as any)(
          `INSERT INTO team_quiz_responses (id, energizer_id, voter_id, question_index, value, correct, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(energizer_id, voter_id, question_index) DO UPDATE SET value = excluded.value, correct = excluded.correct`,
        )
          .bind(crypto.randomUUID(), energizerId, body.voter_id, qi, body.value, correct, Date.now())
          .run()
        return c.json({ ok: true, data: { voted: body.value, correct: correct === 1 }, trace_id })
      }

      // emoji_poll, quick_finger, word_cloud → energizer_votes table
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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  // POST /sessions/:sessionId/energizers/:energizerId/next — Team Quiz advance question
  app.post('/sessions/:sessionId/energizers/:energizerId/next', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
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

      if (energizer.kind !== 'team_quiz') {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Only team_quiz supports /next' }, trace_id },
          400,
        )
      }

      if (energizer.state !== 'active') {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Energizer must be active' }, trace_id },
          400,
        )
      }

      const config = JSON.parse(energizer.config_json) as TeamQuizConfig
      const nextIndex = config.current_index + 1
      const isDone = nextIndex >= config.questions.length
      const newState = isDone ? 'completed' : 'active'

      config.current_index = nextIndex
      const now = Date.now()

      await (c.env.DB.prepare as any)(
        `UPDATE energizers SET config_json = ?1, state = ?2, updated_at = ?3 WHERE id = ?4`,
      )
        .bind(JSON.stringify(config), newState, now, energizerId)
        .run()

      await recordAuditEvent(c, {
        action: 'energizer.advance',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { current_index: nextIndex, state: newState },
        trace_id,
      })

      return c.json({
        ok: true,
        data: { current_index: nextIndex, state: newState, done: isDone },
        trace_id,
      })
    } catch (err) {
      console.error('[energizers] next failed:', err)
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
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
        { ok: false, error: { code: 'internal', message: sanitizeError(err, c.env.ENV, 500).message }, trace_id },
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
      const extra: Record<string, unknown> = {}

      if (result.kind === 'emoji_poll') {
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes WHERE energizer_id = ?1 GROUP BY value`,
        )
          .bind(energizerId)
          .all()
        const r: Record<string, number> = {}
        for (const emoji of (config as EmojiPollConfig).emojis) r[emoji] = 0
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) r[row.value] = row.count
        extra.results = r
      } else if (result.kind === 'quick_finger') {
        const qf = config as QuickFingerConfig
        const correctAnswer = qf.options[qf.correct_index]
        const votes = await (c.env.DB.prepare as any)(
          `SELECT voter_id, value, created_at FROM energizer_votes WHERE energizer_id = ?1 ORDER BY created_at ASC`,
        )
          .bind(energizerId)
          .all()
        let rank = 1
        extra.rankings = (votes.results ?? []).map((v: { voter_id: string; value: string; created_at: number }) => {
          const correct = v.value === correctAnswer
          return { voter_id: v.voter_id, value: v.value, correct, speed_ms: v.created_at, rank: correct ? rank++ : -1 }
        })
      } else if (result.kind === 'team_quiz') {
        const rows = await (c.env.DB.prepare as any)(
          `SELECT voter_id, SUM(correct) as score FROM team_quiz_responses
           WHERE energizer_id = ?1 GROUP BY voter_id ORDER BY score DESC`,
        )
          .bind(energizerId)
          .all()
        extra.scores = (rows.results ?? []).map((r: { voter_id: string; score: number }, i: number) => ({
          voter_id: r.voter_id, score: r.score, rank: i + 1,
        }))
      } else if (result.kind === 'word_cloud') {
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes WHERE energizer_id = ?1 GROUP BY value ORDER BY count DESC`,
        )
          .bind(energizerId)
          .all()
        const words: Record<string, number> = {}
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) words[row.value] = row.count
        extra.words = words
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
            ...extra,
          },
          trace_id,
        },
        200,
      )
    } catch (err) {
      console.error('[energizers] get failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: sanitizeError(err, c.env.ENV, 500).message }, trace_id },
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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  parent.route('/api', app)
}
