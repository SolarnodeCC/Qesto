import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import type { EnergizerApp } from './types'
import { validateData, EnergizerConfigEnvelopeSchema, EmojiPollConfigSchema, QuickFingerConfigSchema, TeamQuizConfigSchema } from '../../lib/validators'

export function registerEnergizerActiveRoute(app: EnergizerApp): void {
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

      let config: unknown
      try {
        config = JSON.parse(energizer.config_json)
      } catch {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Malformed energizer config' }, trace_id }, 500)
      }

      const validConfig = validateData(config, EnergizerConfigEnvelopeSchema)
      if (!validConfig) {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid energizer config' }, trace_id }, 500)
      }

      let results: Record<string, number> = {}
      let rankings: Array<{ voter_id: string; value: string; correct: boolean; speed_ms: number; rank: number }> | undefined
      const activatedAt = energizer.updated_at as number

      if (energizer.kind === 'emoji_poll') {
        const emojiConfig = validateData(config, EmojiPollConfigSchema)
        if (!emojiConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid emoji poll config' }, trace_id }, 500)
        }
        const votes = await (c.env.DB.prepare as any)(
          `SELECT value, COUNT(*) as count FROM energizer_votes
           WHERE energizer_id = ?1 GROUP BY value`,
        )
          .bind(energizer.id)
          .all()

        for (const emoji of emojiConfig.emojis) {
          results[emoji] = 0
        }
        for (const row of (votes.results ?? []) as { value: string; count: number }[]) {
          results[row.value] = row.count
        }
      } else if (energizer.kind === 'quick_finger') {
        const qfConfig = validateData(config, QuickFingerConfigSchema)
        if (!qfConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid quick finger config' }, trace_id }, 500)
        }
        const correctAnswer = qfConfig.options[qfConfig.correct_index]

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
        const tqConfig = validateData(config, TeamQuizConfigSchema)
        if (!tqConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid team quiz config' }, trace_id }, 500)
        }
        const tq = tqConfig
        const qi = tq.current_index
        let responseCount = 0
        if (qi >= 0 && qi < tq.questions.length) {
          const cnt = await (c.env.DB.prepare as any)(
            `SELECT COUNT(*) as n FROM team_quiz_responses WHERE energizer_id = ?1 AND question_index = ?2`,
          )
            .bind(energizer.id, qi)
            .first()
          responseCount = (cnt?.n as number) ?? 0
        }
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
            energizer: { id: energizer.id, kind: energizer.kind, prompt: energizer.prompt, config: validConfig, state: energizer.state },
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
            energizer: { id: energizer.id, kind: energizer.kind, prompt: energizer.prompt, config: validConfig, state: energizer.state },
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
            config: validConfig,
            state: energizer.state,
          },
          results,
          ...(rankings !== undefined ? { rankings } : {}),
        },
        trace_id,
      })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}
