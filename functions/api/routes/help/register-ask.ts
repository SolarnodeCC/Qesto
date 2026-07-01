/**
 * Help Assistant Question Endpoint (Week 2).
 * POST /api/help/ask — Ask a question, get RAG-enhanced Mistral response.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../../types'
import { rateLimit } from '../../lib/rate-limit'
import { askHelpAI, HelpAIError, HelpValidationError } from '../../lib/help-rag'
import { errorResponse, sanitizeError } from '../../lib/error-handler'
import { verifyJwt } from '../../lib/jwt'
import { safeLogContext , logEvent} from '../../lib/log'
import type { AuthVariables } from '../../middleware/auth'

const AskSchema = z.object({
  question: z.string().min(1).max(500).trim(),
})

export function registerHelpAskRoute(app: Hono<{ Bindings: Env; Variables: AuthVariables }>): void {
  app.post('/help/ask', async (c) => {
    const traceId = c.get('trace_id') ?? crypto.randomUUID()

    // Auth is optional — anonymous users get free-tier scope
    let userId: string | null = null
    const userPlan: 'free' | 'starter' | 'team' = 'free'
    const authHeader = c.req.header('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const claims = await verifyJwt(token, c.env.JWT_SECRET)
      if (claims) userId = claims.sub
    }

    // Parse and validate input
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return errorResponse(c, 400, 'bad_request', 'Invalid JSON')
    }

    const parsed = AskSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(c, 400, 'validation_error', 'Question must be 1-500 characters')
    }

    const { question } = parsed.data

    // Rate limiting: 10 questions per minute (keyed by user ID or IP)
    const rateLimitKey = userId ?? (c.req.header('cf-connecting-ip') ?? 'anonymous')
    const rl = await rateLimit(c.env.ACTIONS_KV, rateLimitKey, {
      max: 10,
      windowSeconds: 60,
      prefix: 'help-ask',
    })
    if (!rl.allowed) {
      return errorResponse(c, 429, 'rate_limited', 'Too many questions; please wait before asking again')
    }

    const userScope = userPlan

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
      logEvent({
          event: 'help.ask.ok',
          user_id: userId ?? 'anonymous',
          plan: userPlan,
          latencyMs,
          source_count: result.sources.length,
        })

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
      safeLogContext(err, { traceId: traceId, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })

      if (err instanceof HelpValidationError) {
        return errorResponse(c, 502, 'ai_output_invalid', 'AI response failed validation')
      }

      if (err instanceof HelpAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return errorResponse(c, 500, 'ai_failed', sanitized.message)
      }

      // Unknown error
      const sanitized = sanitizeError(err as Error, c.env.ENV, 500)
      return errorResponse(c, 500, sanitized.code, sanitized.message)
    }
  })
}
