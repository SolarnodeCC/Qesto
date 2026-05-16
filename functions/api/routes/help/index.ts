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
import { registerHelpAskRoute } from './register-ask'
import { registerHelpFeedbackRoute } from './register-feedback'

export function mountHelpRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  app.use('*', authMiddleware)

  registerHelpAskRoute(app)
  registerHelpFeedbackRoute(app)

  parent.route('/api', app)
}
