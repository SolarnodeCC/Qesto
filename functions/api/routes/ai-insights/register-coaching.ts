import type { Hono } from 'hono'
import { z } from 'zod'
import { generateFacilitatorCoaching, type CoachingTurn } from '../../lib/ai/coaching'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { sentimentContextFromMeta } from '../../lib/ai/session-context'
import { validateBody } from '../../lib/validate'
import { fetchQuestions } from '../sessions/shared'
import type { AiInsightsVars } from './types'

const CoachingBodySchema = z.object({
  followUp: z.string().max(500).optional(),
})

function coachingHistoryKey(sessionId: string): string {
  return `coaching:history:${sessionId}`
}

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

    const parsed = await validateBody(c, CoachingBodySchema)
    if ('error' in parsed) return parsed.error
    const history =
      c.env.SESSIONS_KV ?
        ((await readKvJson<CoachingTurn[]>(c.env.SESSIONS_KV, coachingHistoryKey(sessionId))) ?? [])
      : []

    const coaching = await generateFacilitatorCoaching(
      c.env,
      ctx,
      {
        sessionTitle: session.title,
        questionSummaries: summaries,
        totalVotes: voteRow?.n ?? 0,
        anonymity: session.anonymity,
      },
      { followUp: parsed.data.followUp, history },
    )

    if (!coaching) {
      return c.json(
        { ok: false, error: { code: 'coaching_unavailable', message: 'Coaching not available for this session' }, trace_id: traceId },
        422,
      )
    }

    const nextHistory: CoachingTurn[] = [
      ...history,
      ...(parsed.data.followUp ? [{ role: 'user' as const, content: parsed.data.followUp, at: Date.now() }] : []),
      {
        role: 'assistant',
        content: `${coaching.headline}\n${coaching.bullets.join('\n')}`,
        at: Date.now(),
      },
    ].slice(-20)
    if (c.env.SESSIONS_KV) {
      await writeKvJson(c.env.SESSIONS_KV, coachingHistoryKey(sessionId), nextHistory, {
        expirationTtl: 30 * 24 * 60 * 60,
      })
    }

    return c.json({ ok: true, data: { coaching, turns: nextHistory.length }, trace_id: traceId })
  })

  app.get('/sessions/:sessionId/coaching/export', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')
    const session = await c.env.DB.prepare(`SELECT title, owner_id FROM sessions WHERE id = ?1`).bind(sessionId).first<{
      title: string
      owner_id: string
    }>()
    if (!session || session.owner_id !== user.sub) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId }, 404)
    }
    const history =
      c.env.SESSIONS_KV ?
        ((await readKvJson<CoachingTurn[]>(c.env.SESSIONS_KV, coachingHistoryKey(sessionId))) ?? [])
      : []
    const lines = [`# Coaching export: ${session.title}`, '', ...history.map((t) => `## ${t.role} (${new Date(t.at).toISOString()})\n${t.content}`)]
    return new Response(lines.join('\n\n'), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="coaching-${sessionId}.md"`,
        'X-Trace-Id': traceId,
      },
    })
  })
}
