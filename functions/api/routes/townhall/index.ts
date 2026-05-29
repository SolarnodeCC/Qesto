import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { planMiddleware, type PlanVariables } from '../../middleware/plan'
import type { Env } from '../../types'
import { featureAllowed, denyFeature } from '../../lib/entitlements'
import { fetchSession } from '../sessions/shared'
import { requireFound, requireDraft } from '../../lib/session-lifecycle'
import { recordAuditEvent } from '../../lib/audit'

type Vars = AuthVariables & PlanVariables

const ConfigSchema = z.object({
  moderation: z.enum(['pre', 'post']),
  anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']).optional(),
})

/**
 * TOWNHALL (ADR-0044) draft-time setup. The live board itself runs over the
 * SessionRoom WebSocket; this REST surface only configures the session while it
 * is still in DRAFT. Team-tier only.
 */
export function registerTownhallConfigRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>): void {
  app.get('/sessions/:id/townhall/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const loaded = requireFound(await fetchSession(c.env.DB, c.req.param('id'), user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const s = loaded.session
    return c.json({
      ok: true,
      data: {
        sessionMode: s.session_mode,
        moderation: s.townhall_moderation ?? null,
        anonymity: s.anonymity,
      },
      trace_id,
    })
  })

  app.post('/sessions/:id/townhall/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')

    if (!featureAllowed(c.get('planQuotas'), 'townhallQA')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'townhallQA'), trace_id }, 403)
    }

    const parsed = ConfigSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid townhall config' }, trace_id }, 400)
    }
    const { moderation, anonymity } = parsed.data

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const draft = requireDraft(loaded.session, 'townhall_config')
    if (!draft.ok) {
      return c.json({ ok: false, error: { code: draft.error.code, message: draft.error.message }, trace_id }, draft.error.status)
    }

    const sets = ['townhall_moderation = ?2', "session_mode = 'townhall'"]
    const binds: unknown[] = [id, moderation]
    if (anonymity) {
      sets.push('anonymity = ?3')
      binds.push(anonymity)
    }
    await c.env.DB.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?1`).bind(...binds).run()

    await recordAuditEvent(c, {
      action: 'townhall.config',
      subject_type: 'session',
      subject_id: id,
      after_snapshot: { moderation, ...(anonymity ? { anonymity } : {}) },
      trace_id,
    })

    return c.json({
      ok: true,
      data: { sessionMode: 'townhall', moderation, ...(anonymity ? { anonymity } : {}) },
      trace_id,
    })
  })
}

export function mountTownhallRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)
  registerTownhallConfigRoutes(app)
  parent.route('/api', app)
}
