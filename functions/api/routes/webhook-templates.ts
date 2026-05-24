import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { WEBHOOK_TEMPLATES } from '../lib/webhook-templates'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountWebhookTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.get('/templates', authMiddleware, (c) =>
    c.json({ ok: true, data: { templates: WEBHOOK_TEMPLATES }, trace_id: c.get('trace_id') }),
  )
  parent.route('/api/webhooks', app)
}
