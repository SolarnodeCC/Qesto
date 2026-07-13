import { recordAuditEvent } from '../../lib/audit'
import { errorResponse, sanitizeError } from '../../lib/error-handler'
import { safeLogContext, logEvent } from '../../lib/log'
import { z } from 'zod'
import type { EnergizerApp } from './types'
import { requireSessionAccess, postDO, type SessionRow } from '../sessions/shared'
import { buildLiveEnergizerFromRow } from '../../lib/energizer-live-projection'
import { getEnergizerById } from '../../repositories/energizerRepository'
import type { Env } from '../../types'

// Audit E-2: the DO WebSocket is the participant-facing energizer plane.
// Host lifecycle changes made over REST are reconciled into the SessionRoom
// DO here — best-effort, because the D1 write is the source of truth for the
// host lobby and a sync miss must not fail the host's action.
export async function syncEnergizerToDO(
  env: Env,
  session: Pick<SessionRow, 'id' | 'status'>,
  energizerId: string,
  newState: 'active' | 'completed',
): Promise<void> {
  if (session.status !== 'energizing' && session.status !== 'live') return
  try {
    if (newState === 'active') {
      const row = await getEnergizerById(env.DB, session.id, energizerId)
      const live = row ? buildLiveEnergizerFromRow(row) : null
      if (!live) return
      await postDO(env, session.id, '/energizer-sync', { action: 'activate', energizer: live })
    } else {
      await postDO(env, session.id, '/energizer-sync', { action: 'complete', energizerId })
    }
  } catch (err) {
    logEvent({
      event: 'energizer.do_sync_failed',
      session_id: session.id,
      errorClass: err instanceof Error ? err.name : 'UnknownError',
    })
  }
}

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
        return errorResponse(c, 404, 'not_found', 'Session not found or access denied')
      }
      const PatchEnergizerSchema = z.object({
        state: z.enum(['active', 'completed']).optional(),
        prompt: z.string().min(1).max(400).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      const raw = await c.req.json().catch(() => null)
      const parsed = PatchEnergizerSchema.safeParse(raw)
      if (!parsed.success) {
        return errorResponse(c, 400, 'validation', 'Invalid energizer patch payload')
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
        return errorResponse(c, 404, 'not_found', 'Energizer not found')
      }

      await recordAuditEvent(c, {
        action: 'energizer.activate',
        subject_type: 'energizer',
        subject_id: energizerId,
        after_snapshot: { state: body.state },
        trace_id,
      })

      if (body.state !== undefined) {
        await syncEnergizerToDO(c.env, session, energizerId, body.state)
      }

      return c.json({ ok: true, data: { state: body.state }, trace_id })
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return errorResponse(c, 500, 'internal', message)
    }
  })
}
