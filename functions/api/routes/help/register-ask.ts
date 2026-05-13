/**
 * Help Assistant Question Endpoint (Week 2).
 * POST /api/help/ask — Ask a question, get RAG-enhanced Mistral response.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../../types'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { planMiddleware, type PlanVariables } from '../../middleware/plan'
import { rateLimit } from '../../lib/rate-limit'
import { askHelpAI, HelpAIError, HelpValidationError } from '../../lib/help-rag'
import { sanitizeError } from '../../lib/error-handler'

type Vars = AuthVariables & PlanVariables

const AskSchema = z.object({
  question: z.string().min(1).max(500).trim(),
})

export function registerHelpAskRoute(app: Hono<{ Bindings: Env; Variables: Vars }>): void {
  app.post('/help/ask', authMiddleware, planMiddleware, async (c) => {
    const user = c.get('user')
    const plan = c.get('plan')
    const traceId = c.get('trace_id')

    // Parse and validate input
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'bad_request', message: 'Invalid JSON' },
          trace_id: traceId,
        },
        400,
      )
    }

    const parsed = AskSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Question must be 1-500 characters',
          },
          trace_id: traceId,
        },
        400,
      )
    }

    const { question } = parsed.data

    // Rate limiting: 10 questions per minute per user
    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 10,
      windowSeconds: 60,
      prefix: 'help-ask',
    })
    if (!rl.allowed) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many questions; please wait before asking again',
            details: { retry_after_seconds: Math.ceil((rl.resetAt - Date.now()) / 1000) },
          },
          trace_id: traceId,
        },
        429,
      )
    }

    // Determine user's plan scope
    const userScope = (() => {
      if (plan === 'team') return 'team' as const
      if (plan === 'starter') return 'starter' as const
      return 'free' as const
    })()

    // Check plan entitlements: free users can ask about basic topics only
    // Full gating happens in prompt (docs are scoped to their tier)

    try {
      // Call RAG pipeline
      const t0 = Date.now()
      const result = await askHelpAI(
        c.env.AI as any,
        c.env.HELP_VECTORIZE,
        c.env.DB,
        question,
        userScope,
      )
      const latencyMs = Date.now() - t0

      // Log event
      console.log(
        JSON.stringify({
          event: 'help.ask.ok',
          user_id: user.sub,
          plan,
          latencyMs,
          source_count: result.sources.length,
        }),
      )

      // Stream could go here; for now returning full response
      return c.json(
        {
          ok: true,
          data: {
            answer: result.answer,
            sources: result.sources,
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      console.error('Help ask error:', err)

      if (err instanceof HelpValidationError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'ai_output_invalid',
              message: 'AI response failed validation',
              details: err.details,
            },
            trace_id: traceId,
          },
          502,
        )
      }

      if (err instanceof HelpAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          {
            ok: false,
            error: { ...sanitized, code: 'ai_failed' },
            trace_id: traceId,
          },
          500,
        )
      }

      // Unknown error
      const sanitized = sanitizeError(err as Error, c.env.ENV, 500)
      return c.json(
        {
          ok: false,
          error: sanitized,
          trace_id: traceId,
        },
        500,
      )
    }
  })
}
