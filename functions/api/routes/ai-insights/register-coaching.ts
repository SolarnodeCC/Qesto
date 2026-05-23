import type { Hono } from 'hono'
import { generateFacilitatorCoaching } from '../../lib/ai/coaching'
import { sentimentContextFromMeta } from '../../lib/ai/session-context'
import { fetchQuestions } from '../sessions/shared'
import type { AiInsightsVars } from './types'

export function registerCoachingRoute(app: Hono<{ Bindings: import('../../types').Env; Variables: AiInsightsVars }>) {
  app.post('/sessions/:sessionId/coaching', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')

    const session = await c.env.DB.prepare(
      `SELECT id, title, owner_id, team_id, anonymity FROM sessions WHERE id = ?1 AND owner_id = ?2`,
    )
      .bind(sessionId, user.sub)
      .first<{ id: string; title: string; owner_id: string; team_id: string | null; anonymity: string }>()

    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId }, 404)
    }

    const questions = await fetchQuestions(c.env.DB, sessionId)
    const summaries = questions.map((q) => `${q.kind}: ${q.prompt}`)
    const voteRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM votes WHERE session_id = ?1`,
    )
      .bind(sessionId)
      .first<{ n: number }>()

    const ctx = sentimentContextFromMeta({
      sessionId: session.id,
      teamId: session.team_id ?? undefined,
      plan: c.get('plan'),
      anonymity: session.anonymity as 'full' | 'partial' | 'none' | 'zero_knowledge',
    })

    const coaching = await generateFacilitatorCoaching(c.env, ctx, {
      sessionTitle: session.title,
      questionSummaries: summaries,
      totalVotes: voteRow?.n ?? 0,
      anonymity: session.anonymity,
    })

    if (!coaching) {
      return c.json(
        { ok: false, error: { code: 'coaching_unavailable', message: 'Coaching not available for this session' }, trace_id: traceId },
        422,
      )
    }

    return c.json({ ok: true, data: { coaching }, trace_id: traceId })
  })
}
