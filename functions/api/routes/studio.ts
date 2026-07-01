/**
 * STUDIO (ADR-0060, S96) — privacy-native AI session-authoring co-pilot.
 *
 * POST /api/studio/authoring/generate — operator types a topic; the co-pilot
 * drafts ready-to-run session questions, optionally pre-styled in a CANVAS
 * theme so the preview matches the live presentation. Workers AI only — no
 * external LLM API, no egress (ADR-0060 §1, CLAUDE.md hard rule 1).
 *
 * The runAI() call is the ONLY non-pure step here; prompt building and
 * output validation live in lib/studio-authoring.ts and lib/studio-theme.ts.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { recordAuditEvent } from '../lib/audit'
import { writeEvent } from '../lib/observability'
import { logEvent } from '../lib/log'
import { runAI } from '../lib/ai/ai-gateway'
import {
  buildAuthoringPrompt,
  parseAuthoringResult,
  readAIResponse,
  StudioAIError,
  StudioValidationError,
  STUDIO_MODEL,
  MIN_COUNT,
  MAX_COUNT,
} from '../lib/studio-authoring'
import {
  applyThemeToDrafts,
  resolveStudioTheme,
  STUDIO_THEME_NAMES,
} from '../lib/studio-theme'
import { suggestNextQuestions } from '../lib/studio-suggest'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import type { Team } from './teams'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

const AUTHORING_KINDS = [
  'poll',
  'ranking',
  'consent',
  'open',
  'multi_select',
  'likert',
  'upvote',
  'word_cloud',
  'slider',
] as const

const GenerateSchema = z.object({
  topic: z.string().min(1).max(2000),
  count: z.number().int().min(MIN_COUNT).max(MAX_COUNT),
  kind: z.enum(AUTHORING_KINDS).optional(),
  language: z.string().min(2).max(8).optional(),
  themeId: z.enum(STUDIO_THEME_NAMES).optional(),
})

// STUDIO-SUGGEST-01 — given a just-authored question, suggest a topically
// related next question. `teamId` is required so the cross-tenant
// DECISIONS_VECTORIZE query can be scoped to the requesting team only (REV-27).
const SuggestSchema = z.object({
  teamId: z.string().min(1).max(128),
  prompt: z.string().min(1).max(2000),
  kind: z.enum(AUTHORING_KINDS).optional(),
  excludeSessionId: z.string().min(1).max(64).optional(),
})

function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

export function mountStudioRoutes(parent: ParentApp) {
  const app = new Hono<{
    Bindings: Env
    Variables: AuthVariables & PlanVariables & { trace_id: string }
  }>()

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // STUDIO-COPILOT-01 — generate question drafts from a topic.
  app.post('/authoring/generate', async (c) => {
    const trace_id = c.get('trace_id')

    let body: z.infer<typeof GenerateSchema>
    try {
      body = GenerateSchema.parse(await c.req.json())
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Invalid authoring request' },
          trace_id,
        },
        400,
      )
    }

    // Build the prompt (pure: sanitises topic + clamps count). A topic that is
    // empty after sanitisation is a validation error, not an AI failure.
    let built: ReturnType<typeof buildAuthoringPrompt>
    try {
      built = buildAuthoringPrompt({
        topic: body.topic,
        count: body.count,
        kind: body.kind,
        language: body.language,
      })
    } catch (err) {
      const message = err instanceof StudioValidationError ? err.message : 'Invalid authoring topic'
      return c.json({ ok: false, error: { code: 'invalid_topic', message }, trace_id }, 400)
    }

    // The single non-pure step: Workers AI inference (no egress).
    let raw: string
    const t0 = Date.now()
    try {
      const res = await runAI(c.env, STUDIO_MODEL, {
        messages: built.messages,
        max_tokens: 800,
        stream: false,
      })
      raw = readAIResponse(res)
      logEvent({
        event: 'studio.authoring.ai_ok',
        model: STUDIO_MODEL,
        latencyMs: Date.now() - t0,
        approxInputChars: built.approxInputChars,
        outputChars: raw.length,
      })
    } catch (err) {
      logEvent({
        event: 'studio.authoring.ai_error',
        model: STUDIO_MODEL,
        latencyMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      })
      return c.json(
        {
          ok: false,
          error: { code: 'ai_unavailable', message: 'Authoring model is temporarily unavailable' },
          trace_id,
        },
        502,
      )
    }

    // Validate + normalise the model output. Bad output is a 400 (never raw).
    let result: ReturnType<typeof parseAuthoringResult>
    try {
      result = parseAuthoringResult(raw)
    } catch (err) {
      if (err instanceof StudioAIError) {
        return c.json(
          { ok: false, error: { code: 'ai_unavailable', message: err.message }, trace_id },
          502,
        )
      }
      const message =
        err instanceof StudioValidationError ? err.message : 'Authoring output failed validation'
      return c.json({ ok: false, error: { code: 'invalid_ai_output', message }, trace_id }, 400)
    }

    // Optionally attach CANVAS theme tokens so the preview inherits branding.
    const theme = resolveStudioTheme(body.themeId)
    const drafts = theme ? applyThemeToDrafts(result.drafts, theme) : result.drafts

    const user = c.get('user')
    const plan = c.get('plan')

    // Audit: non-PII snapshot (counts + confidence + theme), never topic/content.
    await recordAuditEvent(c, {
      action: 'studio.questions.generated',
      subject_type: 'user',
      subject_id: user.sub,
      after_snapshot: {
        count: drafts.length,
        confidence: result.confidence,
        kind: body.kind ?? 'mixed',
        themeApplied: Boolean(theme),
      },
      trace_id,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'studio.copilot_used',
      userId: user.sub,
      plan,
      count: drafts.length,
      durationMs: Date.now() - t0,
      detail: body.kind ?? 'mixed',
      traceId: trace_id,
    })
    if (theme) {
      writeEvent(c.env.METRICS_AE, {
        name: 'studio.theme_applied',
        userId: user.sub,
        plan,
        detail: theme.name,
        traceId: trace_id,
      })
    }

    return c.json({ ok: true, data: { drafts, confidence: result.confidence }, trace_id })
  })

  // STUDIO-SUGGEST-01 — suggest a topically-related next question after Q1.
  // Embedding + semantic rank over DECISIONS_VECTORIZE (no generative step).
  // Tenant safety: the query is metadata-filtered to a team the caller belongs
  // to, verified here before any Vectorize access (REV-27 / ADR-0045).
  app.post('/authoring/suggest', async (c) => {
    const trace_id = c.get('trace_id')

    let body: z.infer<typeof SuggestSchema>
    try {
      body = SuggestSchema.parse(await c.req.json())
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Invalid suggestion request' },
          trace_id,
        },
        400,
      )
    }

    const user = c.get('user')
    const plan = c.get('plan')

    // Verify the caller belongs to the team BEFORE the cross-tenant index is
    // touched — this is the gate that keeps another team's titles unreachable.
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(body.teamId))
    if (!team || !isTeamMember(team, user.sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id },
        403,
      )
    }

    // Embedding + Vectorize query. The helper degrades gracefully (empty result,
    // never throws) on AI/Vectorize faults, so this path has no 502 branch.
    const t0 = Date.now()
    const result = await suggestNextQuestions(c.env, {
      teamId: body.teamId,
      prompt: body.prompt,
      kind: body.kind,
      excludeSessionId: body.excludeSessionId,
    })

    logEvent({
      event: 'studio.authoring.suggest',
      latencyMs: Date.now() - t0,
      count: result.suggestions.length,
      source: result.source,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'studio.suggest_used',
      userId: user.sub,
      plan,
      count: result.suggestions.length,
      durationMs: Date.now() - t0,
      detail: result.source,
      traceId: trace_id,
    })

    return c.json({
      ok: true,
      data: { suggestions: result.suggestions, source: result.source },
      trace_id,
    })
  })

  parent.route('/api/studio', app)
}
