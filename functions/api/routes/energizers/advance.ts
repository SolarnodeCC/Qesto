/** POST /sessions/:sessionId/energizers/:energizerId/advance — host advances a
 * battle-royale/bracket round (and awards badges on completion). */
import {
  advanceBattleRoyaleRound,
  advanceBracketRound,
  determineBadgesAwarded,
} from '../../lib/gamification'
import { recordAuditEvent } from '../../lib/audit'
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import { z } from 'zod'
import type { EnergizerApp } from './types'
import { validateData, EnergizerConfigEnvelopeSchema, BattleRoyaleConfigSchema, BracketConfigSchema } from '../../lib/protocol-schemas'
import type { EnergizerRow } from '../../lib/db-row-types'
import { requireSessionAccess } from '../sessions/shared'

export function registerEnergizerAdvanceRoutes(app: EnergizerApp): void {
  app.post('/sessions/:sessionId/energizers/:energizerId/advance', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')
    const user = c.get('user')

    try {
      // SEC (#537): advancing rounds (and awarding badges) is host-only — verify
      // session ownership before any DB access to block cross-tenant IDOR.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
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

      const energizer = await c.env.DB.prepare(
        `SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2`
      )
        .bind(energizerId, sessionId)
        .first<Pick<EnergizerRow, "kind"|"config_json"|"state">>()

      if (!energizer) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404
        )
      }

      let configParsed: unknown
      try {
        configParsed = JSON.parse(energizer.config_json)
      } catch {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Malformed energizer config' }, trace_id }, 500)
      }

      const config = validateData(configParsed, EnergizerConfigEnvelopeSchema)
      if (!config) {
        return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid energizer config' }, trace_id }, 500)
      }

      let nextState = energizer.state
      let winners = null
      let nextRound = null

      if (energizer.kind === 'battle_royale') {
        const brConfig = validateData(config, BattleRoyaleConfigSchema)
        if (!brConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid battle royale config' }, trace_id }, 500)
        }
        const { advancing, scaledScores } = advanceBattleRoyaleRound(
          brConfig.participants,
          body.scores,
          brConfig.elimination_threshold ?? 0.5,
          brConfig.scoring_multiplier ?? 1
        )

        if (advancing.length === 1) {
          nextState = 'completed'
          winners = { champion: advancing[0], scores: scaledScores }
        } else {
          nextRound = { round: body.round + 1, participants: advancing, scores: scaledScores }
          brConfig.participants = advancing
        }
      } else if (energizer.kind === 'bracket') {
        const bracketConfig = validateData(config, BracketConfigSchema)
        if (!bracketConfig) {
          return c.json({ ok: false, error: { code: 'invalid_config', message: 'Invalid bracket config' }, trace_id }, 500)
        }
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

      await c.env.DB.prepare(
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
            await c.env.DB.prepare(
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
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json(
        { ok: false, error: { code: 'internal', message }, trace_id },
        500
      )
    }
  })
}
