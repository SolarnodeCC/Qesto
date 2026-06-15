/**
 * LEARN (ADR-0058) — corporate L&D / LMS engagement via the EMBED rails.
 *
 * - POST /api/learn/lti/launch  — inbound LTI 1.1 launch (LMS → Qesto). No user
 *   auth middleware: the request is authenticated by its OAuth 1.0a signature
 *   (LEARN-LTI-01). Disabled (503) unless LTI credentials are configured.
 * - GET  /api/learn/gate        — EMBED traction checkpoint (LEARN-00), admin only.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { verifyLtiLaunch } from '../lib/lti'
import { evaluateEmbedTractionGate } from '../lib/learn-gate'
import { writeEvent } from '../lib/observability'
import { logEvent } from '../lib/log'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

export function mountLearnRoutes(parent: ParentApp) {
  const pub = new Hono<{ Bindings: Env; Variables: { trace_id: string } }>()

  // LEARN-LTI-01 — inbound LMS launch, authenticated by OAuth 1.0a signature.
  pub.post('/lti/launch', async (c) => {
    const consumerKey = c.env.LTI_CONSUMER_KEY
    const consumerSecret = c.env.LTI_CONSUMER_SECRET
    if (!consumerKey || !consumerSecret) {
      return c.json(
        { ok: false, error: { code: 'lti_disabled', message: 'LTI launch is not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }

    let params: Record<string, string>
    try {
      const form = await c.req.formData()
      params = {}
      for (const [k, v] of form.entries()) {
        if (typeof v === 'string') params[k] = v
      }
    } catch {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'Expected form-encoded launch' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    if (params['oauth_consumer_key'] !== consumerKey) {
      return c.json(
        { ok: false, error: { code: 'unknown_consumer', message: 'Unrecognised consumer key' }, trace_id: c.get('trace_id') },
        401,
      )
    }

    // The signature base string must use the exact launch URL the LMS signed.
    const url = new URL(c.req.url)
    const launchUrl = `${url.origin}${url.pathname}`
    const result = await verifyLtiLaunch({ method: 'POST', url: launchUrl, params, consumerSecret })

    if (!result.valid) {
      logEvent({ event: 'learn.lti.rejected', reason: result.reason })
      writeEvent(c.env.METRICS_AE, { name: 'learn.lti_rejected', detail: result.reason, traceId: c.get('trace_id') })
      return c.json(
        { ok: false, error: { code: 'lti_verification_failed', message: result.reason }, trace_id: c.get('trace_id') },
        401,
      )
    }

    writeEvent(c.env.METRICS_AE, { name: 'learn.lti_launched', detail: result.context.contextId ?? 'no_context', traceId: c.get('trace_id') })

    // The course context links the resource link to a Qesto session surface.
    return c.json({
      ok: true,
      data: {
        context: result.context,
        launch: {
          resourceLinkId: result.context.resourceLinkId,
          contextId: result.context.contextId,
          contextTitle: result.context.contextTitle,
          redirectPath: `/learn/launch?rl=${encodeURIComponent(result.context.resourceLinkId)}`,
        },
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/learn', pub)

  // LEARN-00 — EMBED traction checkpoint (admin only).
  const admin = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables & { trace_id: string } }>()
  admin.use('*', authMiddleware)
  admin.use('*', adminMiddleware)

  admin.get('/gate', async (c) => {
    const embedRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM embed_widgets WHERE revoked_at IS NULL`,
    ).first<{ n: number }>()
    const liveEmbedCount = embedRow?.n ?? 0
    // Open security incidents are tracked out-of-band; default 0 until wired to the
    // incident register. The gate is conservative — any open incident defers LEARN.
    const decision = evaluateEmbedTractionGate({ liveEmbedCount, openSecurityIncidents: 0 })

    return c.json({ ok: true, data: { gate: decision }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/admin/learn', admin)
}
