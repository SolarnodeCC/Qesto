import { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'

import { requireFeature } from '../../../middleware/feature-gate'
import { requireFound, requireDraft, requireClosedOrArchivedForInsights } from '../../../lib/session-lifecycle'
import { logEvent } from '../../../lib/log'
import { fetchSession, fetchQuestions, recordSprint19JourneyEvent } from '../shared'

export function mountWizardInsightsRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
