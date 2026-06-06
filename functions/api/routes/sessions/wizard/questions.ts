import { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'

import {
  ReorderQuestionsSchema,
  AddQuestionSchema,
  autoPopulateOptions,
} from '../../../lib/domain-schemas'
import { requireFound, requireDraft } from '../../../lib/session-lifecycle'
import { ulid } from '../../../lib/ulid'
import { fetchSession, fetchQuestions, deniedQuestionFeature } from '../shared'

export function mountWizardQuestionRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
}
