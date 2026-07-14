// Marketing webhook endpoint — receives session.closed events and strips PII before
// triggering Cloudflare Workflows for template generation.

import { Hono } from 'hono'
import { hmacSha256Hex } from '../lib/webhooks'
import { SessionWebhookPayload } from '../lib/template-schemas'
import type { Env, MarketingWorkflowPayload } from '../types'
import { type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { logEvent } from '../lib/log'
import { incrementWebhookStats } from './admin/growth'

type Vars = AuthVariables & PlanVariables

export function mountMarketingWebhookRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  /**
   * POST /api/webhooks/marketing
   * Receives session.closed webhook events from internal session-end triggers.
   * Validates HMAC signature, strips PII, and queues a Cloudflare Workflow.
   *
   * Expects:
   *   Headers:
   *     Content-Type: application/json
   *     X-Qesto-Signature: sha256=<hex_hmac>
   *   Body: SessionWebhookPayload
   */
  app.post('/', async (c) => {
    // Read and validate HMAC
    const signature = c.req.header('x-qesto-signature')
    if (!signature) {
      logEvent({ event: 'webhook.marketing.missing_signature' })
      return c.json({ error: 'Missing signature' }, 401)
    }

    const body = await c.req.text()
    const secret = c.env.MARKETING_WEBHOOK_SECRET
    if (!secret) {
      logEvent({ event: 'webhook.marketing.secret_not_configured' })
      return c.json({ error: 'Webhook not configured' }, 500)
    }

    const expectedSig = `sha256=${await hmacSha256Hex(secret, body)}`
    if (signature !== expectedSig) {
      logEvent({
        event: 'webhook.marketing.invalid_signature',
        provided: signature.slice(0, 20),
        expected: expectedSig.slice(0, 20),
      })
      return c.json({ error: 'Invalid signature' }, 401)
    }

    // Parse and validate payload with the Zod schema
    let payload: SessionWebhookPayload
    try {
      const raw = JSON.parse(body)
      const result = SessionWebhookPayload.safeParse(raw)
      if (!result.success) {
        logEvent({ event: 'webhook.marketing.parse_error', issues: result.error.issues })
        return c.json({ error: 'Invalid JSON' }, 400)
      }
      payload = result.data
    } catch {
      logEvent({ event: 'webhook.marketing.parse_error' })
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    // Check if session is public
    if (!payload.isPublic) {
      logEvent({ event: 'webhook.marketing.skipped_private_session', sessionId: payload.sessionId })
      if (c.env.MARKETING_KV) {
        await incrementWebhookStats(c.env.MARKETING_KV, { total_received: 1, total_skipped: 1 })
      }
      return c.json({ ok: true, skipped: true })
    }

    // Queue Cloudflare Workflow (async, non-blocking)
    let queued = false
    try {
      if (c.env.WORKFLOWS) {
        const workflowPayload: MarketingWorkflowPayload = {
          sessionId: payload.sessionId,
          language: payload.language,
          questionCount: payload.questionCount,
          participantCount: payload.participantCount,
          durationMinutes: payload.durationMinutes,
        }
        await c.env.WORKFLOWS.create({
          params: workflowPayload,
        })
        queued = true
        logEvent({ event: 'workflow.queued', sessionId: payload.sessionId })
      } else {
        logEvent({
          event: 'workflow.not_available',
          sessionId: payload.sessionId,
          note: 'WORKFLOWS binding not configured; template generation skipped',
        })
      }
    } catch (err) {
      logEvent({
        event: 'workflow.queue_error',
        sessionId: payload.sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    if (c.env.MARKETING_KV) {
      await incrementWebhookStats(c.env.MARKETING_KV, queued ? { total_received: 1, total_queued: 1 } : { total_received: 1 })
    }

    return c.json({ ok: true })
  })

  parent.route('/api/webhooks/marketing', app)
}
