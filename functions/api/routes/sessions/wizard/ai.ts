import { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'

import { rateLimit } from '../../../lib/rate-limit'
import { readKvText, writeKvJson } from '../../../lib/kv'
import { validateBody } from '../../../lib/request-validation'
import { GenerateQuestionsSchema, RefineQuestionsSchema } from '../../../lib/domain-schemas'
import { WizardAIError, WizardValidationError, generateQuestions } from '../../../lib/ai-wizard'
import { sanitizeError } from '../../../lib/error-handler'
import { validateKvJson, CachedQuestionsSchema } from '../../../lib/protocol-schemas'
import { requireFound, requireDraft } from '../../../lib/session-lifecycle'
import { WIZARD_DRAFT_TTL_SECONDS } from '../../../lib/constants'
import { writeEvent } from '../../../lib/observability'
import { fetchSession, hashGrounding } from '../shared'

export function mountWizardAIRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  // ──────────────────────────────────────────────────────────────────────────
  // WIZ-AI-01/02: POST /api/sessions/:id/questions/generate
  // Uses Workers AI (Llama-3.3) to draft 3–5 questions from a prompt. The
  // caller must own a DRAFT session (matches the editing model). Draft
  // questions are *not* auto-persisted — the frontend surfaces them in a
  // review step so the host can tweak labels before save.
  // Rate-limited per-user: 20 generations / hour.
  // ─────────────────────────────────────────────────────────────────────────-
  app.post('/:id/questions/generate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 20,
      windowSeconds: 3600,
      prefix: 'ai-wizard',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 20,
        traceId: c.get('trace_id'),
      })
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many AI generations. Try again in an hour.',
            details: { reset_at: rl.resetAt, limit: 20 },
          },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    const genLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!genLoaded.ok) {
      return c.json(
        { ok: false, error: { code: genLoaded.error.code, message: genLoaded.error.message }, trace_id: c.get('trace_id') },
        genLoaded.error.status,
      )
    }
    const genDraft = requireDraft(genLoaded.session, 'generate_questions')
    if (!genDraft.ok) {
      return c.json(
        { ok: false, error: { code: genDraft.error.code, message: genDraft.error.message }, trace_id: c.get('trace_id') },
        genDraft.error.status,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = GenerateQuestionsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid generation payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    try {
      const language = c.req.header('accept-language') ?? 'en'
      const inferenceStart = Date.now()
      const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.inference',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        durationMs: Date.now() - inferenceStart,
        count: result.questions.length,
        traceId: c.get('trace_id'),
      })
      return c.json({
        ok: true,
        data: { questions: result.questions, confidence: result.confidence },
        trace_id: c.get('trace_id'),
      })
    } catch (err) {
      if (err instanceof WizardValidationError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            },
            trace_id: c.get('trace_id'),
          },
          502,
        )
      }
      if (err instanceof WizardAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          {
            ok: false,
            error: { ...sanitized, code: 'ai_failed' },
            trace_id: c.get('trace_id'),
          },
          500,
        )
      }
      throw err
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // WIZ-AI-01: POST /api/sessions/:id/ai/generate
  // SSE variant used by the Sprint 19 wizard. It sends a ready event
  // immediately, then streams the final validated question payload when the
  // Workers AI generation completes.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/ai/generate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 20,
      windowSeconds: 3600,
      prefix: 'ai-wizard',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 20,
        traceId: c.get('trace_id'),
      })
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many AI generations. Try again in an hour.',
            details: { reset_at: rl.resetAt, limit: 20 },
          },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    const sseLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!sseLoaded.ok) {
      return c.json(
        { ok: false, error: { code: sseLoaded.error.code, message: sseLoaded.error.message }, trace_id: c.get('trace_id') },
        sseLoaded.error.status,
      )
    }
    const sseDraft = requireDraft(sseLoaded.session, 'generate_questions')
    if (!sseDraft.ok) {
      return c.json(
        { ok: false, error: { code: sseDraft.error.code, message: sseDraft.error.message }, trace_id: c.get('trace_id') },
        sseDraft.error.status,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = GenerateQuestionsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid generation payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const encoder = new TextEncoder()
    const language = c.req.header('accept-language') ?? 'en'
    const grounding = JSON.stringify({
      sessionTitle: parsed.data.sessionTitle,
      sessionGoal: parsed.data.sessionGoal,
      focusArea: parsed.data.focusArea ?? null,
      language,
    })
    const groundingHash = await hashGrounding(grounding)
    const traceId = c.get('trace_id')

    function sse(event: string, data: unknown): Uint8Array {
      return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // ENTERPRISE-POLISH s3a: include AI transparency metadata in the ready
        // event so the consent UI can show model name + privacy policy link.
        controller.enqueue(sse('ready', {
          trace_id: traceId,
          groundingHash,
          ai: {
            model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            provider: 'Cloudflare Workers AI',
            dataRetention: 'none',
            inferenceRegion: 'EU-edge',
            thirdPartyEgress: false,
            policyUrl: 'https://qesto.cc/trust/gdpr#ai',
          },
        }))
        try {
          const inferenceStart = Date.now()
          const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
          writeEvent(c.env.METRICS_AE, {
            name: 'ai.inference',
            userId: user.sub,
            sessionId: id,
            plan: c.get('plan'),
            durationMs: Date.now() - inferenceStart,
            count: result.questions.length,
            traceId,
          })
          controller.enqueue(sse('questions', {
            questions: result.questions,
            confidence: result.confidence,
            groundingHash,
          }))
          controller.enqueue(sse('done', { ok: true }))
        } catch (err) {
          if (err instanceof WizardValidationError) {
            controller.enqueue(sse('error', {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            }))
          } else if (err instanceof WizardAIError) {
            const sanitized = sanitizeError(err, c.env.ENV, 500)
            controller.enqueue(sse('error', { ...sanitized, code: 'ai_failed' }))
          } else {
            controller.enqueue(sse('error', {
              code: 'internal_error',
              message: err instanceof Error ? err.message : 'Unexpected AI generation error',
            }))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: POST /api/sessions/:id/ai/refine
  // Iterative refinement of AI-generated drafts. Caches by SHA-256 of the
  // grounding text so repeated identical refines are free. Rate-limit:
  // 10/hour/user. DRAFT-only.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/ai/refine', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 10,
      windowSeconds: 3600,
      prefix: 'ai-refine',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 10,
        traceId,
      })
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many AI refinements. Try again in an hour.',
            details: { reset_at: rl.resetAt, limit: 10 },
          },
          trace_id: traceId,
        },
        429,
      )
    }

    const refineLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!refineLoaded.ok) {
      return c.json(
        { ok: false, error: { code: refineLoaded.error.code, message: refineLoaded.error.message }, trace_id: traceId },
        refineLoaded.error.status,
      )
    }
    const refineDraft = requireDraft(refineLoaded.session, 'ai_refine')
    if (!refineDraft.ok) {
      return c.json(
        { ok: false, error: { code: refineDraft.error.code, message: refineDraft.error.message }, trace_id: traceId },
        refineDraft.error.status,
      )
    }
    const session = refineDraft.session

    const validated = await validateBody(c, RefineQuestionsSchema)
    if ('error' in validated) return validated.error
    const { grounding, feedback } = validated.data

    const groundingHash = await hashGrounding(grounding)
    const cacheKey = `draft:ai:${id}`

    // Cache hit: same grounding hash already stored. Return cached questions.
    if (session.ai_grounding_hash && session.ai_grounding_hash === groundingHash) {
      const cachedRaw = await readKvText(c.env.SESSIONS_KV, cacheKey)
      if (cachedRaw) {
        const cached = validateKvJson(cachedRaw, CachedQuestionsSchema)
        if (cached) {
          return c.json({
            ok: true,
            data: { questions: cached.questions, confidence: cached.confidence ?? 1, cached: true },
            trace_id: traceId,
          })
        }
      }
    }

    try {
      const language = c.req.header('accept-language') ?? 'en'
      // The refine prompt blends grounding + user feedback into the goal field.
      const inferenceStart = Date.now()
      const result = await generateQuestions(c.env.AI, {
        sessionTitle: session.title,
        sessionGoal: `${grounding}\n\nRefinement feedback: ${feedback}`,
        language,
      })
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.inference',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        durationMs: Date.now() - inferenceStart,
        count: result.questions.length,
        traceId,
      })

      // Persist hash on the session row for future cache hits.
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_grounding_hash = ?1 WHERE id = ?2`)
        .bind(groundingHash, id)
        .run()
      // Store refined questions in KV (24h TTL) for cache replays.
      await writeKvJson(
        c.env.SESSIONS_KV,
        cacheKey,
        { questions: result.questions, confidence: result.confidence },
        { expirationTtl: WIZARD_DRAFT_TTL_SECONDS },
      )

      return c.json({
        ok: true,
        data: { questions: result.questions, confidence: result.confidence, cached: false },
        trace_id: traceId,
      })
    } catch (err) {
      if (err instanceof WizardValidationError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            },
            trace_id: traceId,
          },
          502,
        )
      }
      if (err instanceof WizardAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          { ok: false, error: { ...sanitized, code: 'ai_failed' }, trace_id: traceId },
          500,
        )
      }
      throw err
    }
  })
}
