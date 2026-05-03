// AI-Powered Insights — theme summarization (Phase 9 Step 6)
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/insights/analyze   — Generate AI insights (plan-gated)
//   GET    /sessions/:sessionId/insights           — Retrieve cached insights

import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import type { Env } from '../../types'
import { registerInsightsAnalyzeRoute } from './register-analyze'
import { registerInsightsGetRoute } from './register-get'
import type { AiInsightsVars } from './types'

export function mountAIInsightsRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: AiInsightsVars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  registerInsightsAnalyzeRoute(app)
  registerInsightsGetRoute(app)

  parent.route('/api', app)
}
