import {
  advanceBattleRoyaleRound,
  advanceBracketRound,
  determineBadgesAwarded,
  type EmojiPollConfig,
  type QuickFingerConfig,
} from '../../lib/gamification'
import { recordAuditEvent } from '../../lib/audit'
import { sanitizeError } from '../../lib/error-handler'
import { z } from 'zod'
import type { EnergizerApp } from './types'

export function registerEnergizerAdvanceDetailLeaderboardRoutes(app: EnergizerApp): void {
  app.post('/sessions/:sessionId/energizers/:energizerId/advance', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')

    try {
      const AdvanceSchema = z.object({
        scores: z.record(z.string(), z.number()),
        round: z.number().int().nonnegative(),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = AdvanceSchema.safeParse(raw)
      if (!parsed.success) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'scores and round required' }, trace_id },
          400,
        )
      }
      const body = parsed.data

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

        if (nextMatches.length === 0 || winnerIds.length === 1) {
          nextState = 'completed'
          winners = { champion: winnerIds[0], scores: body.scores }
        } else {
          nextRound = { round: body.round + 1, matches: nextMatches }
        }
      }

      await (c.env.DB.prepare as any)(
        `UPDATE energizers SET state = ?1, config_json = ?2, updated_at = ?3 WHERE id = ?4`
      )
        .bind(nextState, JSON.stringify(config), Date.now(), energizerId)
        .run()

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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json(
        { ok: false, error: { code: 'internal', message }, trace_id },
        500
      )
    }
  })

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
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json(
        { ok: false, error: { code: 'internal', message }, trace_id },
        500,
      )
    }
  })

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
}
