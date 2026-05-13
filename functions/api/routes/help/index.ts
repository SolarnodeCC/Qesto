// AI Help Assistant — RAG-powered Q&A with streaming and source citations
//
// Routes (mounted under /api):
//   POST   /help/ask           — Ask a question, get streamed answer + sources
//   POST   /help/feedback      — Submit helpful/unhelpful feedback on a response
//   GET    /help/history       — Retrieve conversation history (optional)
//   POST   /help/conversations/:id/close — Close a conversation

import { Hono } from 'hono'
import type { Env } from '../../types'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { planMiddleware, type PlanVariables } from '../../middleware/plan'
import { registerHelpAskRoute } from './register-ask'
import { registerHelpFeedbackRoute } from './register-feedback'

type Vars = AuthVariables & PlanVariables

export function mountHelpRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  registerHelpAskRoute(app)
  registerHelpFeedbackRoute(app)

  parent.route('/api', app)
}
