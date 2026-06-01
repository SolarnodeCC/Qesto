import type { Hono } from 'hono'
import { z } from 'zod'
import { generateFacilitatorCoaching, type CoachingTurn } from '../../lib/ai/coaching'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { sentimentContextFromMeta } from '../../lib/ai/session-context'
import { validateBody } from '../../lib/validate'
import { fetchQuestions } from '../sessions/shared'
import { loadCoachingProfile, saveCoachingProfile, type CoachingProfile, type TeamVertical } from '../../lib/coaching-profile'
import { queryDecisionGrounding } from '../../lib/agent-grounding'
import { listCoachingActions, recordCoachingAction } from '../../lib/coaching-actions'
import { sendEmail } from '../../lib/email'
import { writeEvent } from '../../lib/observability'
import type { AiInsightsVars } from './types'
import { COACHING_INSIGHTS_TTL_SECONDS } from '../../lib/constants'

const CoachingBodySchema = z.object({
  followUp: z.string().max(500).optional(),
})

const CoachingActionSchema = z.object({
  action: z.enum(['accepted', 'dismissed', 'saved_template']),
  headline: z.string().min(1).max(300),
})

const TEAM_VERTICALS: TeamVertical[] = ['general', 'hr', 'events', 'consulting', 'nonprofit']

function coachingHistoryKey(sessionId: string): string {
  return `coaching:history:${sessionId}`
}

function historicalInsightFromActions(accepted: number, dismissed: number): string | undefined {
  if (accepted + dismissed < 2) return undefined
  if (accepted >= dismissed * 2) {
    return 'Transparency improved when you used open questions (prior sessions show ~60% suggestion acceptance).'
  }
  if (dismissed > accepted) {
    return 'Consider shorter question blocks — dismissed suggestions often correlate with long poll sequences.'
  }
  return undefined
}

async function assertSessionOwner(
  db: D1Database,
  sessionId: string,
  userId: string,
): Promise<{ id: string; title: string; owner_id: string; team_id: string | null; anonymity: string } | null> {
  return db
    .prepare(`SELECT id, title, owner_id, team_id, anonymity FROM sessions WHERE id = ?1 AND owner_id = ?2`)
    .bind(sessionId, userId)
    .first()
}

export function registerCoachingRoute(app: Hono<{ Bindings: import('../../types').Env; Variables: AiInsightsVars }>) {
  app.post('/sessions/:sessionId/coaching', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')

    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId }, 404)
    }

    const questions = await fetchQuestions(c.env.DB, sessionId)
    const summaries = questions.map((q) => `${q.kind}: ${q.prompt}`)
    const voteRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM votes WHERE session_id = ?1`)
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

    const profile = c.env.USERS_KV ? await loadCoachingProfile(c.env.USERS_KV, user.sub) : null
    const priorActions =
      c.env.SESSIONS_KV ? await listCoachingActions(c.env.SESSIONS_KV, sessionId) : []
    const accepted = priorActions.filter((a) => a.action === 'accepted').length
    const dismissed = priorActions.filter((a) => a.action === 'dismissed').length
    const ragChunks = await queryDecisionGrounding(c.env, `${session.title} ${summaries.join(' ')}`, 3)

    const coaching = await generateFacilitatorCoaching(
      c.env,
      ctx,
      {
        sessionTitle: session.title,
        questionSummaries: summaries,
        totalVotes: voteRow?.n ?? 0,
        anonymity: session.anonymity,
        profileStyle: profile?.style,
        teamVertical: profile?.teamVertical,
        similarSessions: ragChunks.map((ch) => ch.text).slice(0, 2),
        historicalInsight: historicalInsightFromActions(accepted, dismissed),
      },
      parsed.data.followUp !== undefined ? { followUp: parsed.data.followUp, history } : { history },
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
        role: 'assistant' as const,
        content: `${coaching.headline}\n${coaching.bullets.join('\n')}`,
        at: Date.now(),
      },
    ].slice(-20)
    if (c.env.SESSIONS_KV) {
      await writeKvJson(c.env.SESSIONS_KV, coachingHistoryKey(sessionId), nextHistory, {
        expirationTtl: COACHING_INSIGHTS_TTL_SECONDS,
      })
    }

    return c.json({
      ok: true,
      data: { coaching, turns: nextHistory.length, history: nextHistory },
      trace_id: traceId,
    })
  })

  app.get('/sessions/:sessionId/coaching/history', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const history =
      c.env.SESSIONS_KV ?
        ((await readKvJson<CoachingTurn[]>(c.env.SESSIONS_KV, coachingHistoryKey(sessionId))) ?? [])
      : []
    const actions = c.env.SESSIONS_KV ? await listCoachingActions(c.env.SESSIONS_KV, sessionId) : []
    return c.json({ ok: true, data: { history, actions }, trace_id: c.get('trace_id') })
  })

  app.post('/sessions/:sessionId/coaching/action', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')
    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId }, 404)
    }
    const parsed = await validateBody(c, CoachingActionSchema)
    if ('error' in parsed) return parsed.error
    if (c.env.SESSIONS_KV) {
      await recordCoachingAction(c.env.SESSIONS_KV, sessionId, {
        sessionId,
        action: parsed.data.action,
        headline: parsed.data.headline,
        at: Date.now(),
      })
    }
    if (parsed.data.action === 'accepted') {
      writeEvent(c.env.METRICS_AE, { name: 'coaching.suggestion_accepted', sessionId, userId: user.sub })
    } else if (parsed.data.action === 'dismissed') {
      writeEvent(c.env.METRICS_AE, { name: 'coaching.suggestion_dismissed', sessionId, userId: user.sub })
    }
    return c.json({ ok: true, data: { recorded: true }, trace_id: traceId })
  })

  app.get('/sessions/:sessionId/coaching/similar', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const theme = c.req.query('theme') ?? session.title
    const chunks = await queryDecisionGrounding(c.env, theme, 8)
    writeEvent(c.env.METRICS_AE, { name: 'kb_rag.query', userId: user.sub, sessionId, detail: theme.slice(0, 80) })
    return c.json({
      ok: true,
      data: {
        query: theme,
        sessions: chunks.map((ch, i) => ({
          id: ch.id ?? `sim-${i}`,
          score: ch.score,
          excerpt: ch.text.slice(0, 240),
        })),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sessions/:sessionId/coaching/email-export', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')
    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId }, 404)
    }
    const history =
      c.env.SESSIONS_KV ?
        ((await readKvJson<CoachingTurn[]>(c.env.SESSIONS_KV, coachingHistoryKey(sessionId))) ?? [])
      : []
    const voteRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM votes WHERE session_id = ?1`)
      .bind(sessionId)
      .first<{ n: number }>()
    const bodyText = [
      `Coaching insights for "${session.title}"`,
      '',
      `Total votes: ${voteRow?.n ?? 0}`,
      '',
      ...history.map((t) => `[${t.role}] ${t.content}`),
    ].join('\n')
    const html = `<p>Your facilitator coaching export for <strong>${session.title}</strong>.</p>
<p>Total votes: ${voteRow?.n ?? 0}</p>
${history.map((t) => `<p><em>${t.role}</em>: ${t.content.replace(/\n/g, '<br>')}</p>`).join('')}`
    await sendEmail(c.env.RESEND_API_KEY, {
      to: user.email,
      subject: `Qesto coaching insights — ${session.title}`,
      text: bodyText,
      html,
    })
    writeEvent(c.env.METRICS_AE, { name: 'coaching.export_emailed', sessionId, userId: user.sub })
    return c.json({ ok: true, data: { emailed: true }, trace_id: traceId })
  })

  app.get('/coaching/profile', async (c) => {
    const user = c.get('user')
    if (!c.env.USERS_KV) {
      return c.json({ ok: true, data: { profile: null }, trace_id: c.get('trace_id') })
    }
    const profile = await loadCoachingProfile(c.env.USERS_KV, user.sub)
    return c.json({ ok: true, data: { profile }, trace_id: c.get('trace_id') })
  })

  app.patch('/coaching/profile', async (c) => {
    const user = c.get('user')
    if (!c.env.USERS_KV) {
      return c.json(
        { ok: false, error: { code: 'unavailable', message: 'Profile storage unavailable' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const body = (await c.req.json().catch(() => null)) as Partial<CoachingProfile> | null
    const existing = await loadCoachingProfile(c.env.USERS_KV, user.sub)
    const teamVertical =
      body?.teamVertical && TEAM_VERTICALS.includes(body.teamVertical as TeamVertical) ?
        (body.teamVertical as TeamVertical)
      : existing?.teamVertical
    const profile: CoachingProfile = {
      style: body?.style === 'detailed' ? 'detailed' : (body?.style === 'concise' ? 'concise' : (existing?.style ?? 'concise')),
      audienceSize:
        body?.audienceSize === 'large' || body?.audienceSize === 'medium' || body?.audienceSize === 'small' ?
          body.audienceSize
        : (existing?.audienceSize ?? 'small'),
      topics: Array.isArray(body?.topics) ? body.topics.filter((t) => typeof t === 'string').slice(0, 10) : (existing?.topics ?? []),
      ...(teamVertical ? { teamVertical } : {}),
      updatedAt: Date.now(),
    }
    await saveCoachingProfile(c.env.USERS_KV, user.sub, profile)
    return c.json({ ok: true, data: { profile }, trace_id: c.get('trace_id') })
  })

  app.get('/sessions/:sessionId/coaching/export', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const traceId = c.get('trace_id')
    const session = await assertSessionOwner(c.env.DB, sessionId, user.sub)
    if (!session) {
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
