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
      await (c.env.DB.prepare as any)(
        `INSERT INTO energizers (id, session_id, kind, prompt, config_json, position, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
        .bind(energizerId, sessionId, body.kind, body.prompt, JSON.stringify(config), 0, Date.now())
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
