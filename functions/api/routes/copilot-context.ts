/**
 * AI-401–AI-404 — copilot context bundle API (S71).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import {
  CopilotContextSchema,
  buildCopilotContext,
  copilotContextKvKey,
} from '../lib/copilot-context'
import { readKvJson, writeKvJson } from '../lib/kv'
import {
  appendTurn,
  copilotThreadKvKey,
  CopilotThreadSchema,
  type CopilotThread,
  type CopilotTurn,
} from '../lib/copilot-multturn'
import {
  draftPollFromIntent,
  DRAFT_POLL_INTENT_MAX,
  DRAFT_POLL_FOCUS_MAX,
} from '../lib/copilot-draft-poll'
import {
  buildLiveContext,
  emptyLiveContext,
  parseSnapshotResponse,
  notifyEmbedOfCopilotChange,
  type CopilotLiveContext,
} from '../lib/copilot-live-context'
import {
  buildSuggestMessages,
  parseSuggestions,
  fallbackSuggestions,
  buildSuggestionResponse,
  COPILOT_MODEL,
} from '../lib/copilot-suggest'
import { auditAgentAction } from '../lib/agent-audit'
import {
  approvePlanStep,
  buildCopilotPlan,
  copilotPlanKvKey,
  CopilotPlanSchema,
  type CopilotPlan,
} from '../lib/copilot-plan'
import { validateL2PlanShape } from '../lib/agent-safety'
import { enforceCopilotSandbox } from '../lib/copilot-sandbox'
import { buildCheckpointBroadcast } from '../lib/copilot-checkpoint'
import { getSessionRoomStub, postDO } from './sessions/shared'
import { WizardAIError, WizardValidationError } from '../lib/ai-wizard'
import { CircuitBreakers } from '../lib/resilience/circuit-breaker'
import { featureAllowed } from '../lib/entitlements'
import { sanitizeError } from '../lib/error-handler'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'
import { sanitizeAIGatewayRequest, assertSanitizedAIGatewayRequest } from '../lib/ai/prompt-sanitize'
import { COPILOT_CONTEXT_TTL_SECONDS, COPILOT_THREAD_TTL_SECONDS, COPILOT_PLAN_TTL_SECONDS } from '../lib/constants'
import type { ParentApp } from './parent-app'

type LiveContextResult =
  | { ok: true; context: CopilotLiveContext }
  | { ok: false; status: 404 | 403; code: string; message: string }

/**
 * Resolve the aggregate live context for a session: owner-checks it, returns an
 * empty context for non-live sessions, otherwise reads the DO snapshot (COPILOT-01).
 * Shared by the live-context and suggest endpoints (ADR-0046).
 */
async function loadLiveContext(env: Env, sessionId: string, userId: string): Promise<LiveContextResult> {
  const session = await env.DB.prepare(`SELECT id, status, owner_id FROM sessions WHERE id = ?1`)
    .bind(sessionId)
    .first<{ id: string; status: string; owner_id: string }>()

  if (!session) return { ok: false, status: 404, code: 'not_found', message: 'Session not found' }
  if (session.owner_id !== userId) return { ok: false, status: 403, code: 'forbidden', message: 'Not session owner' }

  if (session.status !== 'live' && session.status !== 'energizing') {
    return { ok: true, context: emptyLiveContext(sessionId) }
  }

  let snapshot = null
  try {
    const room = await getSessionRoomStub(env, sessionId)
    const res = await room.fetch('https://do.internal/copilot/snapshot')
    snapshot = parseSnapshotResponse(await res.json().catch(() => null))
  } catch {
    snapshot = null
  }
  return { ok: true, context: snapshot ? buildLiveContext(sessionId, snapshot) : emptyLiveContext(sessionId) }
}

const TurnBodySchema = z.object({
  message: z.string().min(1).max(2000),
})

const DraftPollBodySchema = z.object({
  intent: z.string().min(1).max(DRAFT_POLL_INTENT_MAX),
  focusArea: z.string().max(DRAFT_POLL_FOCUS_MAX).optional(),
  language: z.string().min(2).max(10).optional(),
})

const AcceptSuggestionSchema = z.object({
  kind: z.enum(['followup_question', 'poll_draft', 'disengagement_alert', 'pacing']).optional(),
})

const PlanStepActionSchema = z.object({
  status: z.enum(['approved', 'dismissed']),
})

type Vars = AuthVariables & PlanVariables

const ValidateBodySchema = z.object({
  context: z.unknown(),
})

export function mountCopilotContextRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub

    const session = await c.env.DB.prepare(
      `SELECT id, title, status, anonymity, owner_id FROM sessions WHERE id = ?1`,
    )
      .bind(sessionId)
      .first<{ id: string; title: string; status: string; anonymity: string; owner_id: string }>()

    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const cached =
      c.env.SESSIONS_KV ? await readKvJson<ReturnType<typeof buildCopilotContext>>(c.env.SESSIONS_KV, copilotContextKvKey(sessionId)) : null
    if (cached) {
      return c.json({ ok: true, data: { context: cached, source: 'cache' }, trace_id: c.get('trace_id') })
    }

    const qCount = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM questions WHERE session_id = ?1`)
      .bind(sessionId)
      .first<{ n: number }>()

    const locale = c.req.header('accept-language')?.split(',')[0]?.slice(0, 10)
    const context = buildCopilotContext({
      sessionId,
      sessionTitle: session.title,
      status: session.status as 'draft' | 'energizing' | 'live' | 'closed' | 'archived',
      anonymity: session.anonymity as 'full' | 'partial' | 'none' | 'zero_knowledge',
      questionCount: qCount?.n ?? 0,
      ...(locale ? { locale } : {}),
    })

    if (c.env.SESSIONS_KV) {
      await writeKvJson(c.env.SESSIONS_KV, copilotContextKvKey(sessionId), context, { expirationTtl: COPILOT_CONTEXT_TTL_SECONDS })
    }

    return c.json({ ok: true, data: { context, source: 'built' }, trace_id: c.get('trace_id') })
  })

  app.post('/sessions/:sessionId/turn', async (c) => {
    const sessionId = c.req.param('sessionId')
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const parsed = await validateBody(c, TurnBodySchema)
    if ('error' in parsed) return parsed.error
    if (!c.env.SESSIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'SESSIONS_KV required')
    }
    const key = copilotThreadKvKey(sessionId)
    const existing = await readKvJson<CopilotThread>(c.env.SESSIONS_KV, key)
    let thread =
      existing ??
      CopilotThreadSchema.parse({ sessionId, turns: [], updatedAt: Date.now() })
    const userTurn: CopilotTurn = { role: 'user', content: parsed.data.message, at: Date.now() }
    thread = appendTurn(thread, userTurn)

    let assistantText =
      'Consider summarizing participant themes before closing, and ask one follow-up open question.'
    if (c.env.AI) {
      try {
        const aiInput = sanitizeAIGatewayRequest({
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          messages: [
            { role: 'system', content: 'You are a facilitation copilot. Be concise and emotion-safe.' },
            ...thread.turns.map((t) => ({ role: t.role, content: t.content })),
          ],
        })
        assertSanitizedAIGatewayRequest(aiInput)
        const result = (await c.env.AI.run(aiInput.model, {
          messages: aiInput.messages,
        })) as { response?: string }
        if (result?.response?.trim()) assistantText = result.response.trim().slice(0, 2000)
      } catch {
        /* fallback text */
      }
    }
    const assistantTurn: CopilotTurn = { role: 'assistant', content: assistantText, at: Date.now() }
    thread = appendTurn(thread, assistantTurn)
    await writeKvJson(c.env.SESSIONS_KV, key, thread, { expirationTtl: COPILOT_THREAD_TTL_SECONDS })
    return c.json({ ok: true, data: { thread, latest: assistantTurn }, trace_id: c.get('trace_id') })
  })

  // COPILOT-03 — draft a poll from a one-line intent (ADR-0046).
  app.post('/sessions/:sessionId/draft-poll', async (c) => {
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub

    // Plan gate — copilot is paid-only (liveCopilot entitlement, ADR-0046 / COPILOT-09).
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const parsed = await validateBody(c, DraftPollBodySchema)
    if ('error' in parsed) return parsed.error

    const session = await c.env.DB.prepare(`SELECT id, title, owner_id FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; title: string; owner_id: string }>()

    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const ai = c.env.AI
    if (!ai) {
      return c.json(
        { ok: false, error: { code: 'ai_unavailable', message: 'AI binding required' }, trace_id: c.get('trace_id') },
        503,
      )
    }

    const locale = c.req.header('accept-language')?.split(',')[0]?.slice(0, 10)
    const draftParams = {
      sessionTitle: session.title,
      intent: parsed.data.intent,
      ...(parsed.data.focusArea ? { focusArea: parsed.data.focusArea } : {}),
      ...(parsed.data.language ? { language: parsed.data.language } : locale ? { language: locale } : {}),
    }

    try {
      // ADR-0046: copilot AI calls run off the DO hot path, behind the AI circuit breaker.
      const result = await CircuitBreakers.ai.execute(
        () => draftPollFromIntent(ai, draftParams),
        () => null,
      )
      if (!result || !result.draft) {
        // Breaker open or empty generation — graceful "no draft right now".
        return c.json({
          ok: true,
          data: { draft: null, alternatives: [], confidence: 0, source: 'unavailable' },
          trace_id: c.get('trace_id'),
        })
      }
      if (result.draft) {
        const sessionRow = await c.env.DB.prepare(`SELECT team_id FROM sessions WHERE id = ?1`)
          .bind(sessionId)
          .first<{ team_id: string | null }>()
        writeEvent(c.env.METRICS_AE, {
          name: 'copilot.poll_drafted',
          userId,
          sessionId,
          teamId: sessionRow?.team_id ?? undefined,
          plan: c.get('plan'),
          traceId: c.get('trace_id'),
        })
      }
      return c.json({ ok: true, data: result, trace_id: c.get('trace_id') })
    } catch (err) {
      if (err instanceof WizardValidationError) {
        return c.json(
          { ok: false, error: { code: 'ai_output_invalid', message: 'AI returned an output that failed validation' }, trace_id: c.get('trace_id') },
          502,
        )
      }
      if (err instanceof WizardAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json({ ok: false, error: { ...sanitized, code: 'ai_failed' }, trace_id: c.get('trace_id') }, 500)
      }
      throw err
    }
  })

  // COPILOT-01 — live-context snapshot read from the DO (ADR-0046).
  app.get('/sessions/:sessionId/live-context', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const r = await loadLiveContext(c.env, c.req.param('sessionId'), c.get('user').sub)
    if (!r.ok) {
      return c.json({ ok: false, error: { code: r.code, message: r.message }, trace_id: c.get('trace_id') }, r.status)
    }
    return c.json({ ok: true, data: { context: r.context }, trace_id: c.get('trace_id') })
  })

  // COPILOT-RUNTIME-01 (ADR-0056) — supervised multi-step plan.
  app.post('/sessions/:sessionId/plan', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub
    const r = await loadLiveContext(c.env, sessionId, userId)
    if (!r.ok) {
      return c.json({ ok: false, error: { code: r.code, message: r.message }, trace_id: c.get('trace_id') }, r.status)
    }
    if (!c.env.SESSIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'SESSIONS_KV required')
    }

    const plan = buildCopilotPlan(sessionId, r.context)
    const shapeErrors = validateL2PlanShape(plan.steps)
    if (shapeErrors.length > 0) {
      return c.json(
        { ok: false, error: { code: 'invalid_plan', message: shapeErrors.join(';') }, trace_id: c.get('trace_id') },
        400,
      )
    }

    await writeKvJson(c.env.SESSIONS_KV, copilotPlanKvKey(sessionId), plan, {
      expirationTtl: COPILOT_PLAN_TTL_SECONDS,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'copilot.plan_created',
      userId,
      sessionId,
      plan: c.get('plan'),
      count: plan.steps.length,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { plan }, trace_id: c.get('trace_id') })
  })

  app.get('/sessions/:sessionId/plan', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub
    const session = await c.env.DB.prepare(`SELECT id, owner_id FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; owner_id: string }>()
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (!c.env.SESSIONS_KV) {
      return c.json({ ok: true, data: { plan: null }, trace_id: c.get('trace_id') })
    }
    const plan = await readKvJson<CopilotPlan>(c.env.SESSIONS_KV, copilotPlanKvKey(sessionId))
    return c.json({ ok: true, data: { plan: plan ?? null }, trace_id: c.get('trace_id') })
  })

  app.patch('/sessions/:sessionId/plan/steps/:stepId', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const sessionId = c.req.param('sessionId')
    const stepId = c.req.param('stepId')
    const userId = c.get('user').sub
    const parsed = await validateBody(c, PlanStepActionSchema)
    if ('error' in parsed) return parsed.error

    const session = await c.env.DB.prepare(`SELECT id, owner_id, team_id FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; owner_id: string; team_id: string | null }>()
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (!c.env.SESSIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'SESSIONS_KV required')
    }

    const key = copilotPlanKvKey(sessionId)
    const existing = await readKvJson<CopilotPlan>(c.env.SESSIONS_KV, key)
    if (!existing) {
      return c.json(
        { ok: false, error: { code: 'plan_not_found', message: 'No active copilot plan' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const step = existing.steps.find((s) => s.id === stepId)
    if (!step) {
      return c.json(
        { ok: false, error: { code: 'step_not_found', message: 'Plan step not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const plan = approvePlanStep(existing, stepId, parsed.data.status)
    CopilotPlanSchema.parse(plan)
    await writeKvJson(c.env.SESSIONS_KV, key, plan, { expirationTtl: COPILOT_PLAN_TTL_SECONDS })

    await auditAgentAction(c, {
      action: 'agent.action.plan_step_reviewed',
      sessionId,
      agentId: 'facilitation-copilot',
      toolName: step.tool,
      toolArgs: { stepId, status: parsed.data.status },
      outcome: 'success',
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'copilot.plan_step_reviewed',
      userId,
      sessionId,
      teamId: session.team_id ?? undefined,
      plan: c.get('plan'),
      detail: parsed.data.status,
      traceId: c.get('trace_id'),
    })

    // COPILOT-CHECKPOINT-01: broadcast to the room ONLY on explicit approval, and
    // only after the SEC-COPILOT-SANDBOX-01 gate passes (sandboxed tool, same
    // session, PII-safe output). Dismissed/pending steps never broadcast.
    let broadcast = false
    const approvedStep = plan.steps.find((s) => s.id === stepId)
    if (parsed.data.status === 'approved' && approvedStep) {
      const sandbox = enforceCopilotSandbox({
        tool: approvedStep.tool,
        sessionId,
        context: { sessionId },
        output: approvedStep.output,
      })
      const frame = sandbox.ok ? buildCheckpointBroadcast(approvedStep) : null
      if (frame) {
        try {
          await postDO(c.env, sessionId, '/copilot/checkpoint', frame.data)
          broadcast = true
          writeEvent(c.env.METRICS_AE, {
            name: 'copilot.checkpoint_broadcast',
            userId,
            sessionId,
            teamId: session.team_id ?? undefined,
            plan: c.get('plan'),
            detail: approvedStep.tool,
            traceId: c.get('trace_id'),
          })
        } catch {
          /* DO unreachable (session not live) — approval stands, no broadcast */
        }
      }
    }

    return c.json({ ok: true, data: { plan, broadcast }, trace_id: c.get('trace_id') })
  })

  // COPILOT-02 — structured suggestion engine grounded in the live snapshot (ADR-0046).
  app.post('/sessions/:sessionId/suggest', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const r = await loadLiveContext(c.env, c.req.param('sessionId'), c.get('user').sub)
    if (!r.ok) {
      return c.json({ ok: false, error: { code: r.code, message: r.message }, trace_id: c.get('trace_id') }, r.status)
    }
    const context = r.context

    // Nothing to read the room from until the session is live. The empty payload
    // still carries provenance (AI-464) + prompt version (AI-463) for trace parity.
    if (!context.isLive) {
      return c.json({
        ok: true,
        data: buildSuggestionResponse([], 'none'),
        trace_id: c.get('trace_id'),
      })
    }

    const ai = c.env.AI
    let actions = null
    if (ai) {
      try {
        // ADR-0046: copilot inference runs off the DO hot path, behind the AI circuit breaker.
        const text = await CircuitBreakers.ai.execute(
          async () => {
            const result = (await ai.run(COPILOT_MODEL, { messages: buildSuggestMessages(context) })) as { response?: string }
            return result?.response ?? ''
          },
          () => '',
        )
        actions = text ? parseSuggestions(text) : null
      } catch {
        actions = null
      }
    }

    const suggestions = actions ?? fallbackSuggestions(context)
    const sessionRow = await c.env.DB.prepare(`SELECT team_id FROM sessions WHERE id = ?1`)
      .bind(c.req.param('sessionId'))
      .first<{ team_id: string | null }>()
    writeEvent(c.env.METRICS_AE, {
      name: 'copilot.suggestion_emitted',
      userId: c.get('user').sub,
      sessionId: c.req.param('sessionId'),
      teamId: sessionRow?.team_id ?? undefined,
      plan: c.get('plan'),
      count: suggestions.length,
      detail: actions ? 'ai' : 'fallback',
      traceId: c.get('trace_id'),
    })
    // AI-463/464: stamp provenance ('ai' | 'fallback') + prompt version on the payload.
    return c.json({
      ok: true,
      data: buildSuggestionResponse(suggestions, actions ? 'ai' : 'fallback'),
      trace_id: c.get('trace_id'),
    })
  })

  // COPILOT-07 — record presenter acceptance (emitted before add_question inject).
  app.post('/sessions/:sessionId/suggest/accept', async (c) => {
    if (!featureAllowed(c.get('planQuotas'), 'liveCopilot')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Copilot requires paid plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    const sessionId = c.req.param('sessionId')
    const userId = c.get('user').sub
    const parsed = await validateBody(c, AcceptSuggestionSchema)
    if ('error' in parsed) return parsed.error

    const session = await c.env.DB.prepare(`SELECT id, owner_id, team_id FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; owner_id: string; team_id: string | null }>()
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.owner_id !== userId) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    writeEvent(c.env.METRICS_AE, {
      name: 'copilot.suggestion_accepted',
      userId,
      sessionId,
      teamId: session.team_id ?? undefined,
      plan: c.get('plan'),
      detail: parsed.data.kind,
      traceId: c.get('trace_id'),
    })

    // AI-461 — agent action transparency: record the accepted, session-mutating AI
    // action in the audit log with sanitised tool args + `[AI-Generated]` provenance.
    await auditAgentAction(c, {
      action: 'agent.action.suggestion_accepted',
      sessionId,
      agentId: 'facilitation-copilot',
      toolName: 'accept_suggestion',
      toolArgs: parsed.data.kind ? { kind: parsed.data.kind } : {},
      outcome: 'success',
    })

    // AI-462 — copilot ↔ embed handoff: an accepted suggestion changes the active
    // question / session state. If a live embed widget exists, set the short-TTL KV
    // flag so its next state poll learns immediately (no new DO / WS path).
    const copilotChangedEmbed = await notifyEmbedOfCopilotChange(c.env, sessionId)

    return c.json({
      ok: true,
      data: { accepted: true, embedNotified: copilotChangedEmbed, source: 'ai' },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/edge/status', (c) =>
    c.json({
      ok: true,
      data: {
        mode: 'workers_ai_edge',
        inference: 'on-device-colo',
        multturn: true,
        emotionSafe: true,
      },
      trace_id: c.get('trace_id'),
    }),
  )

  app.post('/validate', async (c) => {
    const parsed = await validateBody(c, ValidateBodySchema)
    if ('error' in parsed) return parsed.error
    const result = CopilotContextSchema.safeParse(parsed.data.context)
    if (!result.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_context', message: result.error.message },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    return c.json({ ok: true, data: { valid: true, context: result.data }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/agent/copilot', app)
}
