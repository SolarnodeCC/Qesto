/**
 * STAGE-FOUNDATION-01 — hybrid-event session mode (draft configuration).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireDraft } from '../lib/session-lifecycle'
import type { Env, Session } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const StageConfigSchema = z.object({
  broadcastEnabled: z.boolean().optional(),
  presenterNotes: z.string().max(2000).optional(),
})

export function mountStageSessionRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:id/stage/config', async (c) => {
    const id = c.req.param('id')
    const row = await c.env.DB.prepare(
      `SELECT id, session_mode, status, title FROM sessions WHERE id = ?1 AND owner_id = ?2`,
    )
      .bind(id, c.get('user').sub)
      .first<{ id: string; session_mode: string; status: string; title: string }>()
    if (!row) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    return c.json({
      ok: true,
      data: {
        sessionId: row.id,
        sessionMode: row.session_mode,
        status: row.status,
        title: row.title,
        stageReady: row.session_mode === 'stage',
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sessions/:id/stage/config', async (c) => {
    const id = c.req.param('id')
    const body = StageConfigSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid stage config' }, trace_id: c.get('trace_id') }, 400)
    }
    const row = await c.env.DB.prepare(`SELECT id, status, owner_id, workspace_id FROM sessions WHERE id = ?1`)
      .bind(id)
      .first<{ id: string; status: string; owner_id: string; workspace_id: string | null }>()
    if (!row || row.owner_id !== c.get('user').sub) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const draftGate = requireDraft({ status: row.status } as Session, 'stage_config')
    if (!draftGate.ok) {
      return c.json({ ok: false, error: draftGate.error, trace_id: c.get('trace_id') }, 409)
    }
    await c.env.DB.prepare(`UPDATE sessions SET session_mode = 'stage' WHERE id = ?1`)
      .bind(id)
      .run()
    return c.json({
      ok: true,
      data: {
        sessionMode: 'stage',
        config: body.data,
        note: 'Event-level presenter shell at /teams/:teamId/workspaces/:wsId/present',
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}
