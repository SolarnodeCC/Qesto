import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'
import type { Sprint19Baseline } from './types'

let schemaPatched = false
async function patchSprint19SchemaIfNeeded(db: D1Database): Promise<void> {
  if (schemaPatched) return
  schemaPatched = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sprint19_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT,
      team_id TEXT,
      plan TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      value REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      trace_id TEXT NOT NULL
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at)`).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id)`).run().catch(() => {})
}

export function mountSprint19Routes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/sprint19-baseline', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    await patchSprint19SchemaIfNeeded(c.env.DB)
    const startParam = c.req.query('start')
    const endParam = c.req.query('end')
    const startMs = startParam ? Date.parse(startParam) : null
    const endMs = endParam ? Date.parse(endParam) : Date.now()

    if ((startMs !== null && Number.isNaN(startMs)) || Number.isNaN(endMs) || (startMs !== null && startMs >= endMs)) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid baseline date range' }, trace_id }, 400)
    }

    const bindRange = (stmt: D1PreparedStatement) => (startMs === null ? stmt : stmt.bind(startMs, endMs))

    try {
      const [
        totalRes,
        aiGeneratedRes,
        aiConsentRes,
        aiGroundingRes,
        startedRes,
        draftRes,
        aiSuggestionRes,
        journeyRes,
      ] = await Promise.all([
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions')
            : c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2'),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE ai_generated = 1')
            : c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND ai_generated = 1'),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE ai_consent_at IS NOT NULL')
            : c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND ai_consent_at IS NOT NULL'),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE ai_grounding_hash IS NOT NULL')
            : c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND ai_grounding_hash IS NOT NULL'),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare("SELECT COUNT(*) as n FROM sessions WHERE status IN ('live','closed','archived')")
            : c.env.DB.prepare("SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND status IN ('live','closed','archived')"),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare("SELECT COUNT(*) as n FROM sessions WHERE status = 'draft'")
            : c.env.DB.prepare("SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND status = 'draft'"),
        ).first<{ n: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT COALESCE(SUM(ai_accepted_count), 0) as accepted, COALESCE(SUM(ai_dismissed_count), 0) as dismissed FROM sessions WHERE ai_generated = 1')
            : c.env.DB.prepare('SELECT COALESCE(SUM(ai_accepted_count), 0) as accepted, COALESCE(SUM(ai_dismissed_count), 0) as dismissed FROM sessions WHERE created_at >= ?1 AND created_at <= ?2 AND ai_generated = 1'),
        ).first<{ accepted: number; dismissed: number }>(),
        bindRange(
          startMs === null
            ? c.env.DB.prepare('SELECT event_name, COUNT(*) as n FROM sprint19_events GROUP BY event_name')
            : c.env.DB.prepare('SELECT event_name, COUNT(*) as n FROM sprint19_events WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY event_name'),
        ).all<{ event_name: string; n: number }>(),
      ])

      const total = totalRes?.n ?? 0
      const started = startedRes?.n ?? 0
      const journeyCounts = new Map((journeyRes.results ?? []).map((row) => [row.event_name, row.n]))
      const wizardOpened = journeyCounts.get('wizard.opened') ?? 0
      const wizardCompleted = journeyCounts.get('wizard.completed') ?? 0
      const launchAttempts = journeyCounts.get('launchpad.launch_attempt') ?? 0
      const launchSuccesses = journeyCounts.get('launchpad.launch_success') ?? 0
      const launchFailures = journeyCounts.get('launchpad.launch_failed') ?? 0
      const preflightChecks = journeyCounts.get('preflight.checked') ?? 0
      const preflightFailures = journeyCounts.get('preflight.failed') ?? 0
      const accepted = aiSuggestionRes?.accepted ?? 0
      const dismissed = aiSuggestionRes?.dismissed ?? 0
      const totalSuggestions = accepted + dismissed

      const baseline: Sprint19Baseline = {
        generated_at: Date.now(),
        window: { start: startMs, end: endMs },
        ai_usage_rate: total > 0 ? (aiGeneratedRes?.n ?? 0) / total : null,
        wizard_completion_rate: wizardOpened > 0 ? wizardCompleted / wizardOpened : total > 0 ? started / total : null,
        launchpad_success_rate: launchAttempts > 0 ? launchSuccesses / launchAttempts : total > 0 ? started / total : null,
        inline_suggestion_acceptance_rate: totalSuggestions > 0 ? accepted / totalSuggestions : null,
        invalid_live_attempts: launchFailures,
        preflight_failure_rate: preflightChecks > 0 ? preflightFailures / preflightChecks : null,
        counts: {
          total_sessions: total,
          ai_generated_sessions: aiGeneratedRes?.n ?? 0,
          ai_consent_sessions: aiConsentRes?.n ?? 0,
          ai_grounding_sessions: aiGroundingRes?.n ?? 0,
          started_or_closed_sessions: started,
          draft_sessions: draftRes?.n ?? 0,
          wizard_opened: wizardOpened,
          wizard_completed: wizardCompleted,
          ai_suggestions_accepted: accepted,
          ai_suggestions_dismissed: dismissed,
          launchpad_opened: journeyCounts.get('launchpad.opened') ?? 0,
          launch_attempts: launchAttempts,
          launch_successes: launchSuccesses,
          launch_failures: launchFailures,
          preflight_checks: preflightChecks,
          preflight_failures: preflightFailures,
        },
        measurement_gaps: [
          ...(wizardOpened > 0 ? [] : ['Wizard completion rate uses a D1 created-session proxy until wizard.opened events exist.']),
          ...(launchAttempts > 0 ? [] : ['Launchpad success rate uses a D1 started-session proxy until launch_attempt events exist.']),
          ...(preflightChecks > 0 ? [] : ['Preflight failure rate requires preflight.checked journey events in the selected window.']),
          ...(totalSuggestions > 0 ? [] : ['Inline AI suggestion acceptance requires at least one completed AI-generated wizard session in the selected window.']),
        ],
      }
      return c.json({ ok: true, data: baseline, trace_id }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute Sprint 19 baseline'
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}

