import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { WEBHOOK_TEMPLATES } from '../lib/webhook-templates'
import type { Env } from '../types'

export function mountWebhookTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: AuthVariables }>) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  app.get('/templates', authMiddleware, (c) =>
    c.json({ ok: true, data: { templates: WEBHOOK_TEMPLATES }, trace_id: c.get('trace_id') }),
  )
  parent.route('/api/webhooks', app)
}
