// Session wizard routes (draft-state authoring).
//
// The route handlers live in three modules split out of this file's original 892
// lines (issue #687): AI generation/refinement, question CRUD, and the
// session-level operations below. Mount order matches the original file.

import { Hono } from 'hono'
import type { Env, Session } from '../../types'
import type { SessionVars } from './shared'

import { validateBody } from '../../lib/request-validation'
import {
    DuplicateSessionSchema } from '../../lib/domain-schemas'
import { ensurePersonalTeam } from '../teams'
import { errorResponse } from '../../lib/error-handler'
import { requireFeature } from '../../middleware/feature-gate'
import { hardDeleteSession } from '../../lib/session-delete'
import { suggestDuplicateTitle } from '../../lib/session-title'
import { requireFound, requireDraft, requireClosedOrArchivedForInsights } from '../../lib/session-lifecycle'
import { ulid } from '../../lib/ulid'
import { generateJoinCode } from '../../lib/code'
import { incrementSessionQuota } from '../../lib/quota'
import { logEvent } from '../../lib/log'
import {
  fetchOwnerSessionTitles,
  fetchSession,
  fetchQuestions,
      recordSprint19JourneyEvent
} from './shared'

import { mountWizardGenerateRoutes } from './wizard-generate'
import { mountWizardQuestionRoutes } from './wizard-questions'

export function mountSessionWizardRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  mountWizardGenerateRoutes(app)
  mountWizardQuestionRoutes(app)

  app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const { deleted } = await hardDeleteSession(c.env.DB, id, user.sub)
    if (!deleted) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
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
