/**
 * KB-RAG-01 — decision memory grounding for agents.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { queryDecisionGrounding } from '../lib/agent-grounding'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountAgentGroundingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  app.get('/grounding', async (c) => {
    const q = c.req.query('q') ?? ''
    if (q.trim().length < 3) {
      return c.json(
        { ok: false, error: { code: 'bad_query', message: 'Query must be at least 3 characters' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const chunks = await queryDecisionGrounding(c.env, q, 8)
    return c.json({ ok: true, data: { chunks }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/agent', app)
}
