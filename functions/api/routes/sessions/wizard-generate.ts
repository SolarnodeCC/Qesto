// Split out of the 892-line sessions/wizard.ts (issue #687). Each module mounts
// one family of wizard routes onto the shared sessions app; wizard.ts composes
// them, so the mounted paths and their order are unchanged.

import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { readKvText, writeKvJson } from '../../lib/kv'
import { validateBody } from '../../lib/request-validation'
import {
  GenerateQuestionsSchema,
    RefineQuestionsSchema } from '../../lib/domain-schemas'
import {
  WizardAIError,
  WizardValidationError,
  generateQuestions,
  streamQuestions,
  FAST_MODEL,
  QUALITY_FALLBACK_MODEL
} from '../../lib/ai-wizard'
import {
  enforceWizardAiRateLimit,
  loadDraftSessionForAi,
  recordWizardAiInference,
  wizardAiErrorPayload
} from './wizard-ai'
import { updateSessionGroundingHash } from '../../repositories/sessionRepository'
import { validateKvJson, CachedQuestionsSchema } from '../../lib/protocol-schemas'
import { WIZARD_DRAFT_TTL_SECONDS } from '../../lib/constants'
import {
        hashGrounding } from './shared'

// WIZ-CACHE-01: repeated identical generations (same title/goal/focus/language)
// are common while a host iterates on a draft — serve them from KV instead of
// re-running two model batches. Key is per-user so one user's generations are
// never replayed to another. Same 24 h TTL as the refine cache.
async function generationCacheKey(
  userId: string,
  input: { sessionTitle: string; sessionGoal: string; focusArea?: string | undefined },
  language: string,
): Promise<string> {
  const hash = await hashGrounding(
    JSON.stringify({
      sessionTitle: input.sessionTitle,
      sessionGoal: input.sessionGoal,
      focusArea: input.focusArea ?? null,
      language,
    }),
  )
  return `wizard:gen:${userId}:${hash}`
}

export function mountWizardGenerateRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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

    const limited = await enforceWizardAiRateLimit(c, id, {
      max: 20,
      prefix: 'ai-wizard',
      message: 'Too many AI generations. Try again in an hour.',
    })
    if (limited) return limited

    const loaded = await loadDraftSessionForAi(c, id, 'generate_questions')
    if (!loaded.ok) return loaded.res

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
      const cacheKey = await generationCacheKey(user.sub, parsed.data, language)
      const cachedRaw = await readKvText(c.env.SESSIONS_KV, cacheKey)
      if (cachedRaw) {
        const cached = validateKvJson(cachedRaw, CachedQuestionsSchema)
        if (cached) {
          return c.json({
            ok: true,
            data: { questions: cached.questions, confidence: cached.confidence ?? 1, cached: true },
            trace_id: c.get('trace_id'),
          })
        }
      }
      const inferenceStart = Date.now()
      const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
      recordWizardAiInference(c, id, result.questions.length, inferenceStart)
      await writeKvJson(
        c.env.SESSIONS_KV,
        cacheKey,
        { questions: result.questions, confidence: result.confidence },
        { expirationTtl: WIZARD_DRAFT_TTL_SECONDS },
      )
      return c.json({
        ok: true,
        data: { questions: result.questions, confidence: result.confidence },
        trace_id: c.get('trace_id'),
      })
    } catch (err) {
      const payload = wizardAiErrorPayload(err, c.env.ENV)
      if (!payload) throw err
      const { status, ...error } = payload
      return c.json({ ok: false, error, trace_id: c.get('trace_id') }, status)
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

    const limited = await enforceWizardAiRateLimit(c, id, {
      max: 20,
      prefix: 'ai-wizard',
      message: 'Too many AI generations. Try again in an hour.',
    })
    if (limited) return limited

    const loaded = await loadDraftSessionForAi(c, id, 'generate_questions')
    if (!loaded.ok) return loaded.res

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
    const cacheKey = `wizard:gen:${user.sub}:${groundingHash}`
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
            // The model that actually runs by default; the larger model is only
            // invoked as a quality fallback when the primary fails.
            model: FAST_MODEL,
            fallbackModel: QUALITY_FALLBACK_MODEL,
            provider: 'Cloudflare Workers AI',
            dataRetention: 'none',
            inferenceRegion: 'EU-edge',
            thirdPartyEgress: false,
            policyUrl: 'https://qesto.cc/trust/gdpr#ai',
          },
        }))
        try {
          // WIZ-CACHE-01: identical grounding within the TTL replays the cached
          // result without any model call.
          const cachedRaw = await readKvText(c.env.SESSIONS_KV, cacheKey)
          const cached = cachedRaw ? validateKvJson(cachedRaw, CachedQuestionsSchema) : null
          if (cached) {
            controller.enqueue(sse('questions', {
              questions: cached.questions,
              confidence: cached.confidence ?? 1,
              groundingHash,
              cached: true,
            }))
            controller.enqueue(sse('done', { ok: true }))
            return
          }
          const inferenceStart = Date.now()
          // Stream each question to the client as it finishes generating. If
          // token streaming fails outright, fall back to the buffered
          // all-at-once generation so we never regress past today's behaviour.
          let index = 0
          let result
          try {
            result = await streamQuestions(c.env.AI, { ...parsed.data, language }, (q) => {
              controller.enqueue(sse('question', { question: q, index: index++ }))
            })
          } catch (streamErr) {
            if (streamErr instanceof WizardValidationError || streamErr instanceof WizardAIError) {
              result = await generateQuestions(c.env.AI, { ...parsed.data, language })
            } else {
              throw streamErr
            }
          }
          recordWizardAiInference(c, id, result.questions.length, inferenceStart)
          await writeKvJson(
            c.env.SESSIONS_KV,
            cacheKey,
            { questions: result.questions, confidence: result.confidence },
            { expirationTtl: WIZARD_DRAFT_TTL_SECONDS },
          )
          // Final authoritative payload: reconciliation for incremental clients,
          // the full list for the fallback path, and backward-compat for old clients.
          controller.enqueue(sse('questions', {
            questions: result.questions,
            confidence: result.confidence,
            groundingHash,
          }))
          controller.enqueue(sse('done', { ok: true }))
        } catch (err) {
          const payload = wizardAiErrorPayload(err, c.env.ENV)
          if (payload) {
            const { status: _status, ...errorBody } = payload
            controller.enqueue(sse('error', errorBody))
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
  // LAUNCHPAD-02: POST /api/sessions/:id/questions
  // Appends a new question to a DRAFT session without replacing existing ones.
  // ──────────────────────────────────────────────────────────────────────────

  app.post('/:id/ai/refine', async (c) => {
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const limited = await enforceWizardAiRateLimit(c, id, {
      max: 10,
      prefix: 'ai-refine',
      message: 'Too many AI refinements. Try again in an hour.',
    })
    if (limited) return limited

    const loaded = await loadDraftSessionForAi(c, id, 'ai_refine')
    if (!loaded.ok) return loaded.res
    const session = loaded.session

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
      recordWizardAiInference(c, id, result.questions.length, inferenceStart)

      // Persist hash on the session row for future cache hits.
      await updateSessionGroundingHash(c.env.DB, id, groundingHash)
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
      const payload = wizardAiErrorPayload(err, c.env.ENV)
      if (!payload) throw err
      const { status, ...error } = payload
      return c.json({ ok: false, error, trace_id: traceId }, status)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: GET /api/sessions/:id/insights/themes?window=7d|30d
  // Reads pre-computed daily insights for the DX-INSIGHTS-02 sparkline. No AI
  // call here — only reads from `insights_daily`. Closed/archived only.
  // ──────────────────────────────────────────────────────────────────────────
}
