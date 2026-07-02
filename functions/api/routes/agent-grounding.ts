/**
 * KB-RAG-01 — decision memory grounding for agents.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { queryDecisionGrounding } from '../lib/agent-grounding'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountAgentGroundingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  app.get('/grounding', async (c) => {
    const q = c.req.query('q') ?? ''
    if (q.trim().length < 3) {
      return errorResponse(c, 400, 'bad_query', 'Query must be at least 3 characters')
    }
    writeEvent(c.env.METRICS_AE, { name: 'kb_rag.query', userId: c.get('user').sub, detail: q.slice(0, 80) })
    const chunks = await queryDecisionGrounding(c.env, q, 8)
    writeEvent(c.env.METRICS_AE, {
      name: 'kb_rag.result_returned',
      userId: c.get('user').sub,
      count: chunks.length,
    })
    return c.json({ ok: true, data: { chunks }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/agent', app)
}
