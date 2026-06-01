import {
  initializeBattleRoyale,
  initializeBracket,
  type EmojiPollConfig,
  type QuickFingerConfig,
  type TeamQuizConfig,
  type WordCloudConfig,
} from '../../lib/gamification'
import { recordAuditEvent } from '../../lib/audit'
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import { z } from 'zod'
import type { EnergizerApp } from './types'
import { validateKvJson, EnergizerConfigEnvelopeSchema } from '../../lib/validators'
import type { EnergizerRow } from '../../lib/db-row-types'

export function registerEnergizerCreateListRoutes(app: EnergizerApp): void {
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

      await c.env.DB.prepare(
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
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  app.get('/sessions/:sessionId/energizers', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')

    try {
      const result = await c.env.DB.prepare(
        `SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers
         WHERE session_id = ?1 ORDER BY position ASC`,
      )
        .bind(sessionId)
        .all<EnergizerRow>()

      const energizers = (result.results ?? []).map((e: any) => ({
        id: e.id,
        kind: e.kind,
        prompt: e.prompt,
        config: validateKvJson(e.config_json, EnergizerConfigEnvelopeSchema) ?? {},
        state: e.state,
        position: e.position,
        created_at: e.created_at,
      }))

      return c.json({ ok: true, data: { energizers }, trace_id })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}
