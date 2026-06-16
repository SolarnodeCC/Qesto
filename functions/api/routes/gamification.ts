// Gamification routes — badges, leaderboard, and analytics (Phase 9)
//
// Routes (mounted under /api):
//   GET    /users/:userId/badges          — Get badges earned by user
//   GET    /sessions/:sessionId/badges    — Get all badges from session
//   POST   /sessions/:sessionId/close     — Award session badges on close

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { determineBadgesAwarded } from '../lib/gamification'
import { recordAuditEvent } from '../lib/audit'
import { sanitizeError } from '../lib/error-handler'
import { safeLogContext } from '../lib/log'
import type { Env } from '../types'
import type { BadgeRow, SessionRow } from '../lib/db-row-types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables

export function mountGamificationRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  // GET /users/:userId/badges
  app.get('/users/:userId/badges', async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('userId')
    const user = c.get('user')

    // Only allow viewing own badges
    if (userId !== user.sub) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Cannot view other users\' badges' }, trace_id },
        403
      )
    }

    try {
      const result = await c.env.DB.prepare(
        `SELECT badge_type, session_id, awarded_at FROM badges
         WHERE user_id = ?1 ORDER BY awarded_at DESC LIMIT 100`,
      )
        .bind(userId)
        .all<BadgeRow>()

      const badges = result.results ?? []

      return c.json(
        {
          ok: true,
          data: {
            user_id: userId,
            badges: badges.map((b: any) => ({
              type: b.badge_type,
              session_id: b.session_id,
              awarded_at: b.awarded_at,
            })),
            total: badges.length,
          },
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

  // GET /sessions/:sessionId/badges
  app.get('/sessions/:sessionId/badges', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // Verify session ownership
      const sessionCheck = await c.env.DB.prepare(
        `SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2`
      )
        .bind(sessionId, user.sub)
        .first<Pick<SessionRow,"id">>()

      if (!sessionCheck) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404
        )
      }

      const result = await c.env.DB.prepare(
        `SELECT user_id, badge_type, awarded_at FROM badges
         WHERE session_id = ?1 ORDER BY awarded_at DESC`,
      )
        .bind(sessionId)
        .all<BadgeRow>()

      const badges = result.results ?? []

      // Aggregate by user
      const byUser: Record<string, any[]> = {}
      for (const badge of badges) {
        if (!byUser[badge.user_id]) byUser[badge.user_id] = []
        byUser[badge.user_id].push({
          type: badge.badge_type,
          awarded_at: badge.awarded_at,
        })
      }

      return c.json(
        {
          ok: true,
          data: {
            session_id: sessionId,
            by_user: byUser,
            total_badges: badges.length,
          },
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

  // POST /sessions/:sessionId/close (award badges on session close)
  app.post('/sessions/:sessionId/close', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // Get session and verify ownership
      const sessionResult = await c.env.DB.prepare(
        `SELECT id, owner_id FROM sessions WHERE id = ?1 AND owner_id = ?2`,
      )
        .bind(sessionId, user.sub)
        .first<Pick<SessionRow,"id"|"owner_id">>()

      if (!sessionResult) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404
        )
      }

      // Get session start time (once, not per-participant)
      const sessionStartResult = await c.env.DB.prepare(
        `SELECT started_at FROM sessions WHERE id = ?1`,
      )
        .bind(sessionId)
        .first<Pick<SessionRow,"started_at">>()

      const sessionStartTime = sessionStartResult?.started_at

      // Aggregate vote stats per participant (single query instead of N queries)
      const voteStatsResult = await c.env.DB.prepare(
        `SELECT
           voter_id,
           COUNT(*) as vote_count,
           MIN(submitted_at) as first_vote_at
         FROM votes
         WHERE session_id = ?1
         GROUP BY voter_id`,
      )
        .bind(sessionId)
        .all<{voter_id:string; vote_count:number; first_vote_at:number|null}>()

      const voteStats = voteStatsResult.results ?? []
      const awardedBadges: Record<string, string[]> = {}
      const badgesToInsert: Array<{user_id:string; badge_type:string; session_id:string; awarded_at:number}> = []

      // Calculate badges for each participant
      for (const { voter_id, vote_count, first_vote_at } of voteStats) {
        // Determine badges
        const sessionStats = {
          first_answer: first_vote_at === sessionStartTime || (first_vote_at && sessionStartTime && first_vote_at - sessionStartTime < 1000),
          answer_count: vote_count,
          engagement: vote_count > 8,
        }

        const badges = determineBadgesAwarded(voter_id, sessionStats as any)

        // Queue badges for batch insert
        for (const badge of badges) {
          badgesToInsert.push({
            user_id: voter_id,
            badge_type: badge,
            session_id: sessionId,
            awarded_at: Date.now(),
          })

          if (!awardedBadges[voter_id]) awardedBadges[voter_id] = []
          awardedBadges[voter_id].push(badge)
        }
      }

      // Batch insert badges
      if (badgesToInsert.length > 0) {
        await c.env.DB.batch(
          badgesToInsert.map(b =>
            c.env.DB.prepare(
              `INSERT OR IGNORE INTO badges (user_id, badge_type, session_id, awarded_at)
               VALUES (?1, ?2, ?3, ?4)`,
            ).bind(b.user_id, b.badge_type, b.session_id, b.awarded_at)
          )
        )
      }

      // Audit
      await recordAuditEvent(c, {
        action: 'session.close_with_badges',
        subject_type: 'session',
        subject_id: sessionId,
        after_snapshot: { badges_awarded: Object.values(awardedBadges).flat().length },
        trace_id,
      })

      return c.json(
        {
          ok: true,
          data: {
            session_id: sessionId,
            badges_awarded: awardedBadges,
            participant_count: voteStats.length,
          },
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

  parent.route('/api', app)
}
