import { recordAuditEvent } from '../../lib/audit'
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import { z } from 'zod'
import type { EnergizerApp } from './types'
import { requireSessionAccess } from '../sessions/shared'

export function registerEnergizerPatchRoute(app: EnergizerApp): void {
  app.patch('/sessions/:sessionId/energizers/:energizerId', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const energizerId = c.req.param('energizerId')
    const user = c.get('user')

    try {
      // Verify session ownership
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
      const PatchEnergizerSchema = z.object({
        state: z.enum(['active', 'completed']).optional(),
        prompt: z.string().min(1).max(400).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = PatchEnergizerSchema.safeParse(raw)
      if (!parsed.success) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Invalid energizer patch payload' }, trace_id },
          400,
        )
      }
      const body = parsed.data

      if (body.state === 'active') {
        await c.env.DB.prepare(
          `UPDATE energizers SET state = 'completed', updated_at = ?1
           WHERE session_id = ?2 AND state = 'active' AND id != ?3`,
        )
          .bind(Date.now(), sessionId, energizerId)
          .run()
      }

      const sets: string[] = ['updated_at = ?1']
      const binds: unknown[] = [Date.now()]
      let paramIdx = 2

      if (body.state !== undefined) {
        sets.push(`state = ?${paramIdx++}`)
        binds.push(body.state)
      }
      if (body.prompt !== undefined) {
        sets.push(`prompt = ?${paramIdx++}`)
        binds.push(body.prompt)
      }
      if (body.config !== undefined) {
        sets.push(`config_json = ?${paramIdx++}`)
        binds.push(JSON.stringify(body.config))
      }

      binds.push(energizerId, sessionId)
      const result = await c.env.DB.prepare(
        `UPDATE energizers SET ${sets.join(', ')}
         WHERE id = ?${paramIdx++} AND session_id = ?${paramIdx++}`,
      )
        .bind(...binds)
        .run()

      if (result.meta?.changes === 0) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Energizer not found' }, trace_id },
          404,
        )
      }

      await recordAuditEvent(c, {
        action: 'energizer.activate',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { state: body.state },
        trace_id,
      })

      return c.json({ ok: true, data: { state: body.state }, trace_id })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}
