import { Hono } from 'hono'
import type { Env, Session } from '../../types'
import type { SessionVars } from './shared'

import { rateLimit } from '../../lib/rate-limit'
import { validateBody } from '../../lib/request-validation'
import {
  GenerateQuestionsSchema,
  DuplicateSessionSchema,
  RefineQuestionsSchema,
  ReorderQuestionsSchema,
  AddQuestionSchema,
  autoPopulateOptions,
} from '../../lib/domain-schemas'
import { ensurePersonalTeam } from '../teams'
import { WizardAIError, WizardValidationError, generateQuestions } from '../../lib/ai-wizard'
import { sanitizeError } from '../../lib/error-handler'
import { requireFeature } from '../../middleware/feature-gate'
import { validateKvJson, CachedQuestionsSchema } from '../../lib/protocol-schemas'
import { hardDeleteSession } from '../../lib/session-delete'
import { suggestDuplicateTitle } from '../../lib/session-title'
import { requireFound, requireDraft, requireClosedOrArchivedForInsights } from '../../lib/session-lifecycle'
import { ulid } from '../../lib/ulid'
import { generateJoinCode } from '../../lib/code'
import { incrementSessionQuota } from '../../lib/quota'
import { WIZARD_DRAFT_TTL_SECONDS } from '../../lib/constants'
import { writeEvent } from '../../lib/observability'
import { logEvent } from '../../lib/log'
import {
  fetchOwnerSessionTitles,
  fetchSession,
  fetchQuestions,
  hashGrounding,
  deniedQuestionFeature,
  recordSprint19JourneyEvent,
} from './shared'

export function mountSessionWizardRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
  // LAUNCHPAD-02: POST /api/sessions/:id/questions
  // Appends a new question to a DRAFT session without replacing existing ones.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/questions', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const addQLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!addQLoaded.ok) {
      return c.json(
        { ok: false, error: { code: addQLoaded.error.code, message: addQLoaded.error.message }, trace_id: c.get('trace_id') },
        addQLoaded.error.status,
      )
    }
    const addQDraft = requireDraft(addQLoaded.session, 'add_question')
    if (!addQDraft.ok) {
      return c.json(
        { ok: false, error: { code: addQDraft.error.code, message: addQDraft.error.message }, trace_id: c.get('trace_id') },
        addQDraft.error.status,
      )
    }
    const session = addQDraft.session

    const body = await c.req.json().catch(() => null)
    const parsed = AddQuestionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid question payload', details: parsed.error.flatten() }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const existing = await fetchQuestions(c.env.DB, id)
    const nextPosition = existing.length
    const qid = ulid()
    const now = Date.now()
    const rawOptions = autoPopulateOptions(parsed.data.kind, parsed.data.options)
    const denied = deniedQuestionFeature(c.get('plan'), c.get('planQuotas'), parsed.data.kind)
    if (denied) {
      return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
    }
    const options = rawOptions.map((o) => ({ id: o.id ?? ulid(), label: o.label }))
    const optionsJson = JSON.stringify(options)

    await c.env.DB
      .prepare(
        `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(qid, id, nextPosition, parsed.data.kind, parsed.data.prompt, optionsJson, now)
      .run()

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') }, 201)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // LAUNCHPAD-01: PUT /api/sessions/:id/questions/reorder
  // Idempotent reorder of the DRAFT session's questions. Accepts a full list
  // of existing question ids; validates that the set matches exactly (no
  // additions, no deletions) and then rewrites `position` in a single D1
  // batch. Repeating the same call is a no-op.
  // ──────────────────────────────────────────────────────────────────────────
  app.put('/:id/questions/reorder', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const reorderLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!reorderLoaded.ok) {
      return c.json(
        { ok: false, error: { code: reorderLoaded.error.code, message: reorderLoaded.error.message }, trace_id: c.get('trace_id') },
        reorderLoaded.error.status,
      )
    }
    const reorderDraft = requireDraft(reorderLoaded.session, 'reorder')
    if (!reorderDraft.ok) {
      return c.json(
        { ok: false, error: { code: reorderDraft.error.code, message: reorderDraft.error.message }, trace_id: c.get('trace_id') },
        reorderDraft.error.status,
      )
    }
    const session = reorderDraft.session

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = ReorderQuestionsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid reorder payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const existing = await fetchQuestions(c.env.DB, id)
    const existingIds = new Set(existing.map((q) => q.id))
    const inputIds = parsed.data.questionIds
    // Dedup and exact-set check.
    const dedup = new Set(inputIds)
    if (dedup.size !== inputIds.length) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'questionIds contains duplicates' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    if (dedup.size !== existingIds.size || inputIds.some((qid) => !existingIds.has(qid))) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation',
            message: 'questionIds must match the current set of question ids exactly',
            details: {
              expected: [...existingIds],
              received: inputIds,
            },
          },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    // Two-phase update: shift all positions to a high offset, then set final.
    // Avoids tripping UNIQUE(session_id, position) during reassignment.
    const OFFSET = 10_000
    const shiftBatch = existing.map((q, idx) =>
      c.env.DB
        .prepare(`UPDATE questions SET position = ?1 WHERE id = ?2 AND session_id = ?3`)
        .bind(OFFSET + idx, q.id, id),
    )
    const finalBatch = inputIds.map((qid, idx) =>
      c.env.DB
        .prepare(`UPDATE questions SET position = ?1 WHERE id = ?2 AND session_id = ?3`)
        .bind(idx, qid, id),
    )
    await c.env.DB.batch([...shiftBatch, ...finalBatch])

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({
      ok: true,
      data: { session, questions },
      trace_id: c.get('trace_id'),
    })
  })

  // PATCH /api/sessions/:id/questions/:questionId — Update a question in place
  // Updates kind/prompt/options without touching other questions or positions.
  app.patch('/:id/questions/:questionId', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const questionId = c.req.param('questionId')

    const patchQLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!patchQLoaded.ok) {
      return c.json(
        { ok: false, error: { code: patchQLoaded.error.code, message: patchQLoaded.error.message }, trace_id: c.get('trace_id') },
        patchQLoaded.error.status,
      )
    }
    const patchQDraft = requireDraft(patchQLoaded.session, 'patch')
    if (!patchQDraft.ok) {
      return c.json(
        { ok: false, error: { code: patchQDraft.error.code, message: patchQDraft.error.message }, trace_id: c.get('trace_id') },
        patchQDraft.error.status,
      )
    }
    const session = patchQDraft.session

    const body = await c.req.json().catch(() => null)
    const parsed = AddQuestionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid question payload', details: parsed.error.flatten() }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const rawOptions = autoPopulateOptions(parsed.data.kind, parsed.data.options)
    const denied = deniedQuestionFeature(c.get('plan'), c.get('planQuotas'), parsed.data.kind)
    if (denied) {
      return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
    }
    const options = rawOptions.map((o) => ({ id: o.id ?? ulid(), label: o.label }))
    const result = await c.env.DB
      .prepare(`UPDATE questions SET kind = ?1, prompt = ?2, options_json = ?3 WHERE id = ?4 AND session_id = ?5`)
      .bind(parsed.data.kind, parsed.data.prompt, JSON.stringify(options), questionId, id)
      .run()

    if (result.meta.changes === 0) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Question not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // DELETE /api/sessions/:id — hard-delete a session the caller owns
  app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const { deleted } = await hardDeleteSession(c.env.DB, id, user.sub)
    if (!deleted) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    return c.json({ ok: true, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/duplicate — create a DRAFT copy (optional body.title)
  app.post('/:id/duplicate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const quotas = c.get('planQuotas')

    const validated = await validateBody(c, DuplicateSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const { allowed } = await incrementSessionQuota(c.env.SESSIONS_KV, user.sub, quotas.maxSessionsPerMonth)
    if (!allowed) {
      return c.json(
        { ok: false, error: { code: 'quota_exceeded', message: 'Session quota exceeded' }, trace_id: c.get('trace_id') },
        429,
      )
    }

    const existingTitles = await fetchOwnerSessionTitles(c.env.DB, user.sub)
    const title =
      body.title ?? suggestDuplicateTitle(session.title, existingTitles)

    const newId = ulid()
    const code = generateJoinCode()
    const now = Date.now()

    let duplicateTeamId: string | null = (session as { team_id?: string | null }).team_id ?? null
    if (!duplicateTeamId) {
      try {
        const personal = await ensurePersonalTeam(c.env.TEAMS_KV, c.env.DB, user.sub, user.email)
        duplicateTeamId = personal.id
      } catch {
        duplicateTeamId = null
      }
    }

    await c.env.DB
      .prepare(
        `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
         VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(newId, user.sub, code, title, session.anonymity, session.vote_policy, session.session_mode, now, duplicateTeamId)
      .run()

    const questions = await fetchQuestions(c.env.DB, id)
    for (const q of questions) {
      const qid = ulid()
      await c.env.DB
        .prepare(
          `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(qid, newId, q.position, q.kind, q.prompt, JSON.stringify(q.options), now)
        .run()
    }

    const newSession: Session = {
      id: newId,
      owner_id: user.sub,
      code,
      title,
      status: 'draft',
      anonymity: session.anonymity,
      vote_policy: session.vote_policy,
      session_mode: session.session_mode,
      created_at: now,
      started_at: null,
      closed_at: null,
      archived_at: null,
      team_id: duplicateTeamId,
    }
    const newQuestions = await fetchQuestions(c.env.DB, newId)
    return c.json(
      { ok: true, data: { session: newSession, questions: newQuestions }, trace_id: c.get('trace_id') },
      201,
    )
  })

  // (Former GET /api/sessions/:id/export.csv handler removed —
  //  superseded by the team-gated rich CSV defined above as part of
  //  EXPORT-RICH-01-A. See v2.2 audit outcomes.)

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: GET /api/sessions/:id/preflight
  // Validates a DRAFT session is launch-ready. Returns a list of named checks
  // with pass/fail and a top-level `ready` boolean (true iff all pass).
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/:id/preflight', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const pfLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!pfLoaded.ok) {
      return c.json(
        { ok: false, error: { code: pfLoaded.error.code, message: pfLoaded.error.message }, trace_id: traceId },
        pfLoaded.error.status,
      )
    }
    const pfDraft = requireDraft(pfLoaded.session, 'preflight')
    if (!pfDraft.ok) {
      return c.json(
        { ok: false, error: { code: pfDraft.error.code, message: pfDraft.error.message }, trace_id: traceId },
        pfDraft.error.status,
      )
    }
    const session = pfDraft.session

    const questions = await fetchQuestions(c.env.DB, id)
    const checks: { id: string; label: string; pass: boolean; message?: string }[] = []

    const pushCheck = (
      check: { id: string; label: string; pass: boolean; message?: string | undefined },
    ) => {
      const entry: { id: string; label: string; pass: boolean; message?: string } = {
        id: check.id,
        label: check.label,
        pass: check.pass,
      }
      if (check.message !== undefined) entry.message = check.message
      checks.push(entry)
    }

    // 1. has_questions
    pushCheck({
      id: 'has_questions',
      label: 'At least one question',
      pass: questions.length >= 1,
      message: questions.length === 0 ? 'Add at least one question before launching' : undefined,
    })

    // 2. questions_valid: every poll/ranking/consent question must have ≥2 options
    const invalid = questions.filter(
      (q) => q.kind !== 'open' && q.kind !== 'word_cloud' && q.options.length < 2,
    )
    pushCheck({
      id: 'questions_valid',
      label: 'All questions have ≥2 options',
      pass: invalid.length === 0,
      message: invalid.length > 0 ? `${invalid.length} question(s) need more options` : undefined,
    })

    // 3. title_set
    const titleOk = !!(session.title && session.title.trim().length > 0)
    pushCheck({
      id: 'title_set',
      label: 'Session title set',
      pass: titleOk,
      message: titleOk ? undefined : 'Set a session title before launching',
    })

    // 4. ai_consent: only required if AI-generated
    const consentOk = session.ai_generated === 1 ? !!session.ai_consent_at : true
    pushCheck({
      id: 'ai_consent',
      label: 'AI generation consent recorded',
      pass: consentOk,
      message: consentOk ? undefined : 'GDPR consent required for AI-generated sessions',
    })

    const ready = checks.every((check) => check.pass)
    const failureCount = checks.filter((check) => !check.pass).length
    await recordSprint19JourneyEvent(c.env, {
      name: 'preflight.checked',
      userId: user.sub,
      sessionId: id,
      teamId: session.team_id,
      plan: c.get('plan'),
      count: failureCount,
      traceId,
    })
    if (!ready) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'preflight.failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        count: failureCount,
        traceId,
      })
      logEvent({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'preflight.failed',
          session_id: id,
          failed_checks: checks.filter((check) => !check.pass).map((check) => check.id),
          trace_id: traceId,
        })
    }
    return c.json({ ok: true, data: { ready, checks }, trace_id: traceId })
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
      const cachedRaw = await c.env.SESSIONS_KV.get(cacheKey)
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
      await c.env.SESSIONS_KV.put(
        cacheKey,
        JSON.stringify({ questions: result.questions, confidence: result.confidence }),
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

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: GET /api/sessions/:id/insights/themes?window=7d|30d
  // Reads pre-computed daily insights for the DX-INSIGHTS-02 sparkline. No AI
  // call here — only reads from `insights_daily`. Closed/archived only.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/:id/insights/themes', requireFeature('insightsAI'), async (c) => {
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const themesLoaded = requireFound(await fetchSession(c.env.DB, id, c.get('user').sub))
    if (!themesLoaded.ok) {
      return c.json(
        { ok: false, error: { code: themesLoaded.error.code, message: themesLoaded.error.message }, trace_id: traceId },
        themesLoaded.error.status,
      )
    }
    const themesGate = requireClosedOrArchivedForInsights(themesLoaded.session)
    if (!themesGate.ok) {
      return c.json(
        { ok: false, error: { code: themesGate.error.code, message: themesGate.error.message }, trace_id: traceId },
        themesGate.error.status,
      )
    }

    const windowParam = c.req.query('window') === '7d' ? '7d' : '30d'
    const sqliteOffset = windowParam === '7d' ? '-7 days' : '-30 days'

    const { results } = await c.env.DB
      .prepare(
        `SELECT day, themes_json, confidence, n_votes
           FROM insights_daily
          WHERE session_id = ?1 AND day >= date('now', ?2)
          ORDER BY day DESC`,
      )
      .bind(id, sqliteOffset)
      .all<{ day: string; themes_json: string; confidence: number; n_votes: number }>()

    const rows = results ?? []
    if (rows.length === 0) {
      return c.json({
        ok: true,
        data: { themes: [], trend: [], window: windowParam },
        trace_id: traceId,
      })
    }

    let topThemes: unknown = []
    try {
      topThemes = JSON.parse(rows[0].themes_json)
    } catch {
      topThemes = []
    }
    const trend = rows.map((r) => ({ day: r.day, confidence: r.confidence, n_votes: r.n_votes }))

    return c.json({
      ok: true,
      data: { themes: topThemes, trend, window: windowParam },
      trace_id: traceId,
    })
  })
}
