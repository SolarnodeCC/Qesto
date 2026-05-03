import type { EmojiPollConfig, QuickFingerConfig, TeamQuizConfig } from '../../lib/gamification'
import { recordAuditEvent } from '../../lib/audit'
import { sanitizeError } from '../../lib/error-handler'
import { z } from 'zod'
import type { EnergizerApp } from './types'

export function registerEnergizerVoteNextRoutes(app: EnergizerApp): void {
  app.post('/sessions/:sessionId/energizers/:energizerId/vote', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const VoteSchema = z.object({
        value: z.string().min(1).max(200),
        voter_id: z.string().min(1).max(120),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = VoteSchema.safeParse(raw)
      if (!parsed.success) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'value and voter_id required' }, trace_id },
          400,
        )
      }
      const body = parsed.data

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
}
