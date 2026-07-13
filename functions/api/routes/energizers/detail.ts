/** GET /sessions/:sessionId/energizers/:energizerId — host-only detail view with
 * per-kind result aggregation (emoji poll, quick finger, team quiz, word cloud). */
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import type { EnergizerApp } from './types'
import { validateData, EnergizerConfigEnvelopeSchema, EmojiPollConfigSchema, QuickFingerConfigSchema } from '../../lib/protocol-schemas'
import type { EnergizerRow, EnergizerVoteRow } from '../../lib/db-row-types'
import { requireSessionAccess } from '../sessions/shared'

export function registerEnergizerDetailRoutes(app: EnergizerApp): void {
  app.get('/sessions/:sessionId/energizers/:energizerId', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')
    const user = c.get('user')

    try {
      // SEC (#537): the detail view exposes per-voter rankings/scores — host-only.
      // Verify session ownership before reading cross-tenant energizer data.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
      const result = await c.env.DB.prepare(
        `SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers
         WHERE id = ?1 AND session_id = ?2`,
      )
        .bind(energizerId, sessionId)
        .first<EnergizerRow>()

      if (!result) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404,
        )
      }

      let configParsed: unknown
      try {
        configParsed = JSON.parse(result.config_json)
      } catch {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Malformed energizer config' }, trace_id }, 500)
      }

      const config = validateData(configParsed, EnergizerConfigEnvelopeSchema)
      if (!config) {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid energizer config' }, trace_id }, 500)
      }

      const extra: Record<string, unknown> = {}

      if (result.kind === 'emoji_poll') {
        const emojiConfig = validateData(config, EmojiPollConfigSchema)
        if (!emojiConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid emoji poll config' }, trace_id }, 500)
        }
        const votes = await c.env.DB.prepare(
          `SELECT value, COUNT(*) as count FROM energizer_votes WHERE energizer_id = ?1 GROUP BY value`,
        )
          .bind(energizerId)
          .all<{value:string;count:number}>()
        const r: Record<string, number> = {}
        for (const emoji of emojiConfig.emojis) r[emoji] = 0
        for (const row of (votes.results ?? [])) r[row.value] = row.count
        extra.results = r
      } else if (result.kind === 'quick_finger') {
        const qfConfig = validateData(config, QuickFingerConfigSchema)
        if (!qfConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid quick finger config' }, trace_id }, 500)
        }
        const correctAnswer = qfConfig.options[qfConfig.correct_index]
        const votes = await c.env.DB.prepare(
          `SELECT voter_id, value, created_at FROM energizer_votes WHERE energizer_id = ?1 ORDER BY created_at ASC`,
        )
          .bind(energizerId)
          .all<EnergizerVoteRow>()
        let rank = 1
        extra.rankings = (votes.results ?? []).map((v: { voter_id: string; value: string; created_at: number }) => {
          const correct = v.value === correctAnswer
          return { voter_id: v.voter_id, value: v.value, correct, speed_ms: v.created_at, rank: correct ? rank++ : -1 }
        })
      } else if (result.kind === 'team_quiz') {
        const rows = await c.env.DB.prepare(
          `SELECT voter_id, SUM(correct) as score FROM team_quiz_responses
           WHERE energizer_id = ?1 GROUP BY voter_id ORDER BY score DESC`,
        )
          .bind(energizerId)
          .all<{voter_id:string;score:number}>()
        extra.scores = (rows.results ?? []).map((r: { voter_id: string; score: number }, i: number) => ({
          voter_id: r.voter_id, score: r.score, rank: i + 1,
        }))
      } else if (result.kind === 'word_cloud') {
        const votes = await c.env.DB.prepare(
          `SELECT value, COUNT(*) as count FROM energizer_votes WHERE energizer_id = ?1 GROUP BY value ORDER BY count DESC`,
        )
          .bind(energizerId)
          .all<{value:string;count:number}>()
        const words: Record<string, number> = {}
        for (const row of (votes.results ?? [])) words[row.value] = row.count
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
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json(
        { ok: false, error: { code: 'internal', message }, trace_id },
        500,
      )
    }
  })
}
