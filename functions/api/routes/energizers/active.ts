import { errorResponse, sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import type { EnergizerApp } from './types'
import { validateData, EnergizerConfigEnvelopeSchema, EmojiPollConfigSchema, QuickFingerConfigSchema, TeamQuizConfigSchema } from '../../lib/protocol-schemas'
import type { EnergizerRow, EnergizerVoteRow, TeamQuizScoreRow, CountRow } from '../../lib/db-row-types'
import { requireSessionAccess, fetchDO } from '../sessions/shared'
import type { LiveEnergizerState } from '../../realtime'

type Ranking = { voter_id: string; value: string; correct: boolean; speed_ms: number; rank: number }
type Score = { voter_id: string; score: number; rank: number }

// Audit E-2: participants receive energizers over the DO WebSocket, so live
// answers accumulate in the DO — read them from there for the host monitor,
// falling back to the D1 vote tables (legacy REST votes) when the DO has no
// matching state.
async function fetchDOEnergizerState(
  env: Parameters<typeof fetchDO>[0],
  sessionId: string,
  energizerId: string,
): Promise<LiveEnergizerState | null> {
  try {
    const res = await fetchDO(env, sessionId, '/energizer-state', { method: 'GET' })
    if (!res.ok) return null
    const body = (await res.json()) as { energizer?: LiveEnergizerState | null }
    return body.energizer && body.energizer.id === energizerId ? body.energizer : null
  } catch {
    return null
  }
}

export function registerEnergizerActiveRoute(app: EnergizerApp): void {
  app.get('/sessions/:sessionId/energizers/active', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // Audit E-1: this endpoint returns the raw config — including answer
      // keys (`correct_index`) — so it is host-only. It previously had no
      // access check at all, letting any authenticated user read any
      // session's answer keys. Participants get their (redacted) energizer
      // view over the DO WebSocket instead.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return errorResponse(c, 404, 'not_found', 'Session not found or access denied')
      }

      const energizer = await c.env.DB.prepare(
        `SELECT id, kind, prompt, config_json, state, position, created_at, updated_at FROM energizers
         WHERE session_id = ?1 AND state = 'active' LIMIT 1`,
      )
        .bind(sessionId)
        .first<EnergizerRow>()

      if (!energizer) {
        return c.json({ ok: true, data: { energizer: null }, trace_id })
      }

      let config: unknown
      try {
        config = JSON.parse(energizer.config_json)
      } catch {
        return errorResponse(c, 500, 'invalid_config', 'Malformed energizer config')
      }

      const validConfig = validateData(config, EnergizerConfigEnvelopeSchema)
      if (!validConfig) {
        return errorResponse(c, 500, 'invalid_config', 'Invalid energizer config')
      }

      const live =
        session.status === 'energizing' || session.status === 'live'
          ? await fetchDOEnergizerState(c.env, sessionId, energizer.id)
          : null

      const energizerPayload = {
        id: energizer.id,
        kind: energizer.kind,
        prompt: energizer.prompt,
        config: validConfig,
        state: energizer.state,
      }

      if (energizer.kind === 'emoji_poll') {
        const emojiConfig = validateData(config, EmojiPollConfigSchema)
        if (!emojiConfig) {
          return errorResponse(c, 500, 'invalid_config', 'Invalid emoji poll config')
        }
        const results: Record<string, number> = {}
        for (const emoji of emojiConfig.emojis) {
          results[emoji] = 0
        }
        if (live) {
          for (const [value, count] of Object.entries(live.optionCounts ?? {})) {
            results[value] = count
          }
        } else {
          const votes = await c.env.DB.prepare(
            `SELECT value, COUNT(*) as count FROM energizer_votes
             WHERE energizer_id = ?1 GROUP BY value`,
          )
            .bind(energizer.id)
            .all<{value: string; count: number}>()
          for (const row of (votes.results ?? []) as {value: string; count: number}[]) {
            results[row.value] = row.count
          }
        }
        return c.json({ ok: true, data: { energizer: energizerPayload, results }, trace_id })
      }

      if (energizer.kind === 'quick_finger') {
        const qfConfig = validateData(config, QuickFingerConfigSchema)
        if (!qfConfig) {
          return errorResponse(c, 500, 'invalid_config', 'Invalid quick finger config')
        }
        let rankings: Ranking[]
        if (live) {
          rankings = (live.answers ?? []).map((a) => ({
            voter_id: a.voterId,
            value: a.value,
            correct: a.correct,
            speed_ms: a.speedMs,
            rank: a.rank > 0 ? a.rank : -1,
          }))
        } else {
          const correctAnswer = qfConfig.options[qfConfig.correct_index]
          const activatedAt = energizer.updated_at
          const votes = await c.env.DB.prepare(
            `SELECT voter_id, value, created_at FROM energizer_votes
             WHERE energizer_id = ?1 ORDER BY created_at ASC`,
          )
            .bind(energizer.id)
            .all<EnergizerVoteRow>()
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
        }
        return c.json({ ok: true, data: { energizer: energizerPayload, results: {}, rankings }, trace_id })
      }

      if (energizer.kind === 'team_quiz') {
        const tqConfig = validateData(config, TeamQuizConfigSchema)
        if (!tqConfig) {
          return errorResponse(c, 500, 'invalid_config', 'Invalid team quiz config')
        }
        let responseCount = 0
        let scores: Score[]
        if (live) {
          const qi = live.currentIndex ?? 0
          responseCount = (live.submissions ?? []).filter((s) => s.questionIndex === qi).length
          scores = (live.scores ?? []).map((s) => ({ voter_id: s.voterId, score: s.score, rank: s.rank }))
        } else {
          const qi = tqConfig.current_index
          if (qi >= 0 && qi < tqConfig.questions.length) {
            const cnt = await c.env.DB.prepare(
              `SELECT COUNT(*) as n FROM team_quiz_responses WHERE energizer_id = ?1 AND question_index = ?2`,
            )
              .bind(energizer.id, qi)
              .first<CountRow>()
            responseCount = cnt?.n ?? 0
          }
          const rows = await c.env.DB.prepare(
            `SELECT voter_id, SUM(correct) as score FROM team_quiz_responses
             WHERE energizer_id = ?1 GROUP BY voter_id ORDER BY score DESC`,
          )
            .bind(energizer.id)
            .all<TeamQuizScoreRow>()
          scores = (rows.results ?? []).map((r: { voter_id: string; score: number }, i: number) => ({
            voter_id: r.voter_id,
            score: r.score,
            rank: i + 1,
          }))
        }
        return c.json({
          ok: true,
          data: { energizer: energizerPayload, response_count: responseCount, scores },
          trace_id,
        })
      }

      if (energizer.kind === 'word_cloud') {
        let words: Record<string, number>
        if (live) {
          words = { ...(live.optionCounts ?? {}) }
        } else {
          const votes = await c.env.DB.prepare(
            `SELECT value, COUNT(*) as count FROM energizer_votes
             WHERE energizer_id = ?1 GROUP BY value ORDER BY count DESC`,
          )
            .bind(energizer.id)
            .all<{value: string; count: number}>()
          words = {}
          for (const row of (votes.results ?? []) as {value: string; count: number}[]) {
            words[row.value] = row.count
          }
        }
        return c.json({ ok: true, data: { energizer: energizerPayload, words }, trace_id })
      }

      return c.json({ ok: true, data: { energizer: energizerPayload, results: {} }, trace_id })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return errorResponse(c, 500, 'internal', message)
    }
  })
}
