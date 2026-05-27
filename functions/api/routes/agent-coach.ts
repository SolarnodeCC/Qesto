/**
 * AI-COACH-AGENT-01 — edge coach status for LIVE sessions (S67).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export function mountAgentCoachRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/live/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId')
    const enabled = c.env.SENTIMENT_ENABLED === 'true' && (c.get('plan') === 'team' || c.get('plan') === 'starter')
    return c.json({
      ok: true,
      data: {
        sessionId,
        coachEnabled: enabled,
        mode: enabled ? 'workers_ai' : 'disabled',
        capabilities: ['facilitator_coaching', 'similar_sessions', 'sentiment_mood'],
        endpoint: `/api/sessions/${sessionId}/coaching`,
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/agent/coach', app)
}
