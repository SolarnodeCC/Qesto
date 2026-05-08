// AI Help Assistant — RAG-powered Q&A with streaming and source citations
//
// Routes (mounted under /api):
//   POST   /help/ask           — Ask a question, get streamed answer + sources
//   POST   /help/feedback      — Submit helpful/unhelpful feedback on a response
//   GET    /help/history       — Retrieve conversation history (optional)
//   POST   /help/conversations/:id/close — Close a conversation

import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import type { Env } from '../../types'

// Week 2: Import route handlers when implemented
// import { registerHelpAskRoute } from './register-ask'
// import { registerHelpFeedbackRoute } from './register-feedback'

export function mountHelpRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env }>()
  app.use('*', authMiddleware)

  // Week 2: Mount help endpoints
  // registerHelpAskRoute(app)
  // registerHelpFeedbackRoute(app)

  parent.route('/api', app)
}
