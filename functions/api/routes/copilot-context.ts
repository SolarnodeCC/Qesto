/**
 * AI-401–AI-404 — copilot context bundle API (S71).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/validate'
import {
  CopilotContextSchema,
  buildCopilotContext,
  copilotContextKvKey,
} from '../lib/copilot-context'
import { readKvJson, writeKvJson } from '../lib/kv'
import {
  appendTurn,
  copilotThreadKvKey,
  CopilotThreadSchema,
  type CopilotThread,
  type CopilotTurn,
} from '../lib/copilot-multturn'
import type { Env } from '../types'

const TurnBodySchema = z.object({
  message: z.string().min(1).max(2000),
})

type Vars = AuthVariables & PlanVariables

const ValidateBodySchema = z.object({
  context: z.unknown(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountCopilotContextRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub

    const session = await c.env.DB.prepare(
      `SELECT id, title, status, anonymity, owner_id FROM sessions WHERE id = ?1`,
    )
      .bind(sessionId)
      .first<{ id: string; title: string; status: string; anonymity: string; owner_id: string }>()

    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const cached =
      c.env.SESSIONS_KV ? await readKvJson<ReturnType<typeof buildCopilotContext>>(c.env.SESSIONS_KV, copilotContextKvKey(sessionId)) : null
    if (cached) {
      return c.json({ ok: true, data: { context: cached, source: 'cache' }, trace_id: c.get('trace_id') })
    }

    const qCount = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM questions WHERE session_id = ?1`)
      .bind(sessionId)
      .first<{ n: number }>()

    const locale = c.req.header('accept-language')?.split(',')[0]?.slice(0, 10)
    const context = buildCopilotContext({
      sessionId,
      sessionTitle: session.title,
      status: session.status as 'draft' | 'energizing' | 'live' | 'closed' | 'archived',
      anonymity: session.anonymity as 'full' | 'partial' | 'none' | 'zero_knowledge',
      questionCount: qCount?.n ?? 0,
      ...(locale ? { locale } : {}),
    })

    if (c.env.SESSIONS_KV) {
      await writeKvJson(c.env.SESSIONS_KV, copilotContextKvKey(sessionId), context, { expirationTtl: 3600 })
    }

    return c.json({ ok: true, data: { context, source: 'built' }, trace_id: c.get('trace_id') })
  })

  app.post('/sessions/:sessionId/turn', async (c) => {
    const sessionId = c.req.param('sessionId')
    if (c.get('plan') !== 'team' && c.get('plan') !== 'starter') {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const parsed = await validateBody(c, TurnBodySchema)
    if ('error' in parsed) return parsed.error
    if (!c.env.SESSIONS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'SESSIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const key = copilotThreadKvKey(sessionId)
    const existing = await readKvJson<CopilotThread>(c.env.SESSIONS_KV, key)
    let thread =
      existing ??
      CopilotThreadSchema.parse({ sessionId, turns: [], updatedAt: Date.now() })
    const userTurn: CopilotTurn = { role: 'user', content: parsed.data.message, at: Date.now() }
    thread = appendTurn(thread, userTurn)

    let assistantText =
      'Consider summarizing participant themes before closing, and ask one follow-up open question.'
    if (c.env.AI) {
      try {
        const result = (await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: 'You are a facilitation copilot. Be concise and emotion-safe.' },
            ...thread.turns.map((t) => ({ role: t.role, content: t.content })),
          ],
        })) as { response?: string }
        if (result?.response?.trim()) assistantText = result.response.trim().slice(0, 2000)
      } catch {
        /* fallback text */
      }
    }
    const assistantTurn: CopilotTurn = { role: 'assistant', content: assistantText, at: Date.now() }
    thread = appendTurn(thread, assistantTurn)
    await writeKvJson(c.env.SESSIONS_KV, key, thread, { expirationTtl: 86400 })
    return c.json({ ok: true, data: { thread, latest: assistantTurn }, trace_id: c.get('trace_id') })
  })

  app.get('/edge/status', (c) =>
    c.json({
      ok: true,
      data: {
        mode: 'workers_ai_edge',
        inference: 'on-device-colo',
        multturn: true,
        emotionSafe: true,
      },
      trace_id: c.get('trace_id'),
    }),
  )

  app.post('/validate', async (c) => {
    const parsed = await validateBody(c, ValidateBodySchema)
    if ('error' in parsed) return parsed.error
    const result = CopilotContextSchema.safeParse(parsed.data.context)
    if (!result.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_context', message: result.error.message },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    return c.json({ ok: true, data: { valid: true, context: result.data }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/agent/copilot', app)
}
