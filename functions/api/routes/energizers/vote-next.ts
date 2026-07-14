import { recordAuditEvent } from '../../lib/audit'
import { errorResponse, sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import { z } from 'zod'
import type { EnergizerApp } from './types'
import { validateData, EmojiPollConfigSchema, QuickFingerConfigSchema, TeamQuizConfigSchema } from '../../lib/protocol-schemas'
import type { EnergizerRow } from '../../lib/db-row-types'
import { requireSessionAccess, postDO } from '../sessions/shared'

export function registerEnergizerVoteNextRoutes(app: EnergizerApp): void {
  app.post('/sessions/:sessionId/energizers/:energizerId/vote', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')
    const user = c.get('user')

    try {
      // Audit 2026-07-14 H-1: this REST vote plane is only exercised by the
      // host's launchpad energizer panel — participants answer over the DO
      // WebSocket. Without a session-scope check any authenticated user who
      // learned a sessionId+energizerId pair could stuff votes into another
      // tenant's energizer, so lock it to the owner like /active and /next.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
      const VoteSchema = z.object({
        value: z.string().min(1).max(200),
        // Legacy field: older clients still send it, but the server ignores it —
        // voter identity is bound to the authenticated session (see below).
        voter_id: z.string().max(120).optional(),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = VoteSchema.safeParse(raw)
      if (!parsed.success) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'value required' }, trace_id },
          400,
        )
      }
      // Bind the vote to the authenticated caller. A client-supplied voter_id
      // would let any caller overwrite other participants' votes via the
      // ON CONFLICT upsert.
      const body = { value: parsed.data.value, voter_id: user.sub }

      const energizer = await c.env.DB.prepare(
        `SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2`,
      )
        .bind(energizerId, sessionId)
        .first<EnergizerRow>()

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
        let configParsed: unknown
        try {
          configParsed = JSON.parse(energizer.config_json)
        } catch {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid energizer config' }, trace_id }, 400)
        }
        const config = validateData(configParsed, EmojiPollConfigSchema)
        if (!config) {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid emoji poll config' }, trace_id }, 400)
        }
        if (!config.emojis.includes(body.value)) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'Invalid emoji choice' }, trace_id },
            400,
          )
        }
      } else if (energizer.kind === 'quick_finger') {
        let configParsed: unknown
        try {
          configParsed = JSON.parse(energizer.config_json)
        } catch {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid energizer config' }, trace_id }, 400)
        }
        const config = validateData(configParsed, QuickFingerConfigSchema)
        if (!config) {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid quick finger config' }, trace_id }, 400)
        }
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
      } else if (energizer.kind !== 'team_quiz') {
        // Audit 2026-07-14 H-1: battle_royale/bracket rounds are driven by the
        // tournament endpoints, not this generic vote — previously any 200-char
        // string fell through to the insert and surfaced on host result views.
        return c.json(
          { ok: false, error: { code: 'validation', message: `${energizer.kind} does not accept votes on this endpoint` }, trace_id },
          400,
        )
      }

      if (energizer.kind === 'team_quiz') {
        let configParsed: unknown
        try {
          configParsed = JSON.parse(energizer.config_json)
        } catch {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid energizer config' }, trace_id }, 400)
        }
        const config = validateData(configParsed, TeamQuizConfigSchema)
        if (!config) {
          return c.json({ ok: false, error: { code: 'validation', message: 'Invalid team quiz config' }, trace_id }, 400)
        }
        const qi = config.current_index
        if (qi < 0 || qi >= config.questions.length) {
          return c.json(
            { ok: false, error: { code: 'validation', message: 'No active question' }, trace_id },
            400,
          )
        }
        const q = config.questions[qi]
        if (!q.options.includes(body.value)) {
          return errorResponse(c, 400, 'validation', 'Invalid answer choice')
        }
        // Audit E-1: correctness is stored for scoring but never echoed back
        // while the question is open, and answers are final — the previous
        // upsert + immediate `correct` flag let participants brute-force the
        // answer key by re-answering until true.
        const correct = body.value === q.options[q.correct_index] ? 1 : 0
        const result = await c.env.DB.prepare(
          `INSERT INTO team_quiz_responses (id, energizer_id, voter_id, question_index, value, correct, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(energizer_id, voter_id, question_index) DO NOTHING`,
        )
          .bind(crypto.randomUUID(), energizerId, body.voter_id, qi, body.value, correct, Date.now())
          .run()
        if (result.meta?.changes === 0) {
          return errorResponse(c, 409, 'duplicate', 'You already answered this quiz question')
        }
        return c.json({ ok: true, data: { voted: body.value }, trace_id })
      }

      await c.env.DB.prepare(
        `INSERT INTO energizer_votes (id, energizer_id, session_id, voter_id, value, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(energizer_id, voter_id) DO UPDATE SET value = excluded.value`,
      )
        .bind(crypto.randomUUID(), energizerId, sessionId, body.voter_id, body.value, Date.now())
        .run()

      return c.json({ ok: true, data: { voted: body.value }, trace_id })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  app.post('/sessions/:sessionId/energizers/:energizerId/next', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')
    const user = c.get('user')

    try {
      // SEC (#537): advancing the team quiz is a host-only control — verify the
      // caller owns the session before any DB access to block cross-tenant IDOR.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
      const energizer = await c.env.DB.prepare(
        `SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2`,
      )
        .bind(energizerId, sessionId)
        .first<EnergizerRow>()

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

      let configParsed: unknown
      try {
        configParsed = JSON.parse(energizer.config_json)
      } catch {
        return c.json({ ok: false, error: { code: 'validation', message: 'Invalid energizer config' }, trace_id }, 400)
      }
      const config = validateData(configParsed, TeamQuizConfigSchema)
      if (!config) {
        return c.json({ ok: false, error: { code: 'validation', message: 'Invalid team quiz config' }, trace_id }, 400)
      }
      const nextIndex = config.current_index + 1
      const isDone = nextIndex >= config.questions.length
      const newState = isDone ? 'completed' : 'active'

      config.current_index = nextIndex
      const now = Date.now()

      await c.env.DB.prepare(
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

      // Audit E-2: reflect the advance into the DO plane participants watch.
      if (session.status === 'energizing' || session.status === 'live') {
        try {
          await postDO(c.env, sessionId, '/energizer-sync', {
            action: 'advance',
            energizerId,
            currentIndex: nextIndex,
            completed: isDone,
          })
        } catch {
          // Best-effort: D1 stays authoritative for the host lobby.
        }
      }

      return c.json({
        ok: true,
        data: { current_index: nextIndex, state: newState, done: isDone },
        trace_id,
      })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}
