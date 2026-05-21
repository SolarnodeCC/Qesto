// Marketing webhook endpoint — receives session.closed events and strips PII before
// triggering Cloudflare Workflows for template generation.

import { Hono } from 'hono'
import { hmacSha256Hex } from '../lib/webhooks'
import { SessionWebhookPayload } from '../lib/template-schemas'
import type { Env } from '../types'
import { type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'

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
      console.log({ event: 'webhook.marketing.missing_signature' })
      return c.json({ error: 'Missing signature' }, 401)
    }

    const body = await c.req.text()
    const secret = c.env.JWT_SECRET // Fallback secret; should be a dedicated webhook secret in production

    const expectedSig = `sha256=${await hmacSha256Hex(secret, body)}`
    if (signature !== expectedSig) {
      console.log({
        event: 'webhook.marketing.invalid_signature',
        provided: signature.slice(0, 20),
        expected: expectedSig.slice(0, 20),
      })
      return c.json({ error: 'Invalid signature' }, 401)
    }

    // Parse and validate payload
    let payload: SessionWebhookPayload
    try {
      payload = JSON.parse(body) as SessionWebhookPayload
    } catch {
      console.log({ event: 'webhook.marketing.parse_error' })
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    // Check if session is public
    if (!payload.isPublic) {
      console.log({ event: 'webhook.marketing.skipped_private_session', sessionId: payload.sessionId })
      return c.json({ ok: true, skipped: true })
    }

    // Queue Cloudflare Workflow (async, non-blocking)
    try {
      if (c.env.WORKFLOWS) {
        const workflowHandle = await c.env.WORKFLOWS.create({
          trigger: 'sessionClosed',
          params: payload,
        })
        console.log({
          event: 'workflow.queued',
          sessionId: payload.sessionId,
          workflowId: workflowHandle.id,
        })
      } else {
        console.log({
          event: 'workflow.not_available',
          sessionId: payload.sessionId,
        })
      }
    } catch (err) {
      console.log({
        event: 'workflow.queue_error',
        sessionId: payload.sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
      // Don't fail the webhook response; workflow queueing is best-effort
    }

    return c.json({ ok: true })
  })

  parent.route('/api/webhooks/marketing', app)
}
