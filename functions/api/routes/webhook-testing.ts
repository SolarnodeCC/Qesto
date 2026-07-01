/**
 * INT-WEBHOOK-TESTING-01 — inject test webhook delivery (team admin).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { deliverWebhook, getWebhookConfig, type WebhookEvent } from '../lib/webhooks'
import { getWebhookTemplate } from '../lib/webhook-templates'
import { validateBody } from '../lib/request-validation'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const TestWebhookSchema = z.object({
  templateId: z.enum(['workday_session_closed', 'bamboohr_session_closed']).optional(),
  event: z.enum(['session.closed', 'session.started']).optional(),
})

export function mountWebhookTestingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/teams/:teamId/webhooks/:webhookId/test', async (c) => {
    const teamId = c.req.param('teamId')
    const webhookId = c.req.param('webhookId')
    if (!c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 503, 'unavailable', 'Integrations KV not configured')
    }
    const validated = await validateBody(c, TestWebhookSchema)
    if ('error' in validated) return validated.error

    const config = await getWebhookConfig(c.env.INTEGRATIONS_KV, teamId, webhookId)
    if (!config) {
      return errorResponse(c, 404, 'not_found', 'Webhook not found')
    }

    const template = validated.data.templateId ? getWebhookTemplate(validated.data.templateId) : undefined
    const event = (validated.data.event ?? 'session.closed') as WebhookEvent
    const payload = {
      event,
      timestamp: Date.now(),
      data: {
        session_id: 'test_session',
        title: template?.label ?? 'Webhook test',
        ...(template?.samplePayload ?? {}),
      },
    }

    const started = Date.now()
    await deliverWebhook(config, payload, c.env.INTEGRATIONS_KV, c.env)
    return c.json({
      ok: true,
      data: { delivered: true, latencyMs: Date.now() - started, event },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}
