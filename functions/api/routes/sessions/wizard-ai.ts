/**
 * Shared guard/telemetry/error plumbing for the wizard's three AI handlers
 * (questions/generate, ai/generate SSE, ai/refine). Extracted from wizard.ts
 * (audit 2026-07-08: god route) so each handler reads as
 * parse → authorize → service (lib/ai-wizard) → respond. The AI core itself
 * (prompts, model, schema validation) stays in lib/ai-wizard.ts — REV-10
 * surface unchanged.
 */
import type { Context } from 'hono'
import type { Env, Session } from '../../types'
import type { SessionVars } from './shared'
import { rateLimit } from '../../lib/rate-limit'
import { WizardAIError, WizardValidationError } from '../../lib/ai-wizard'
import { sanitizeError } from '../../lib/error-handler'
import { requireFound, requireDraft, type DraftGateReason } from '../../lib/session-lifecycle'
import { writeEvent } from '../../lib/observability'
import { fetchSession } from './shared'

type WizardContext = Context<{ Bindings: Env; Variables: SessionVars }>

/**
 * Per-user AI rate limit + `ai.rate_limited` metric + canonical 429 envelope.
 * Returns null when the request is allowed.
 */
export async function enforceWizardAiRateLimit(
  c: WizardContext,
  sessionId: string,
  opts: { max: number; prefix: string; message: string },
): Promise<Response | null> {
  const user = c.get('user')
  const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
    max: opts.max,
    windowSeconds: 3600,
    prefix: opts.prefix,
  })
  if (rl.allowed) return null
  writeEvent(c.env.METRICS_AE, {
    name: 'ai.rate_limited',
    userId: user.sub,
    sessionId,
    plan: c.get('plan'),
    count: opts.max,
    traceId: c.get('trace_id'),
  })
  return c.json(
    {
      ok: false,
      error: {
        code: 'rate_limited',
        message: opts.message,
        details: { reset_at: rl.resetAt, limit: opts.max },
      },
      trace_id: c.get('trace_id'),
    },
    429,
  )
}

/**
 * Load the caller's session and require DRAFT state, with the canonical error
 * envelopes for both failure modes.
 */
export async function loadDraftSessionForAi(
  c: WizardContext,
  sessionId: string,
  action: DraftGateReason,
): Promise<{ ok: true; session: Session } | { ok: false; res: Response }> {
  const loaded = requireFound(await fetchSession(c.env.DB, sessionId, c.get('user').sub))
  if (!loaded.ok) {
    return {
      ok: false,
      res: c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: c.get('trace_id') },
        loaded.error.status,
      ),
    }
  }
  const draft = requireDraft(loaded.session, action)
  if (!draft.ok) {
    return {
      ok: false,
      res: c.json(
        { ok: false, error: { code: draft.error.code, message: draft.error.message }, trace_id: c.get('trace_id') },
        draft.error.status,
      ),
    }
  }
  return { ok: true, session: draft.session }
}

/** `ai.inference` metric for a completed wizard generation. */
export function recordWizardAiInference(
  c: WizardContext,
  sessionId: string,
  questionCount: number,
  inferenceStart: number,
): void {
  writeEvent(c.env.METRICS_AE, {
    name: 'ai.inference',
    userId: c.get('user').sub,
    sessionId,
    plan: c.get('plan'),
    durationMs: Date.now() - inferenceStart,
    count: questionCount,
    traceId: c.get('trace_id'),
  })
}

export type WizardAiErrorPayload = {
  status: 502 | 500
  code: 'ai_output_invalid' | 'ai_failed'
  message: string
  details?: unknown
}

/**
 * Canonical mapping of the ai-wizard error types: WizardValidationError →
 * 502 ai_output_invalid (with details), WizardAIError → sanitized 500
 * ai_failed. Returns null for anything else (caller decides: rethrow for
 * JSON handlers, internal_error event for the SSE stream).
 */
export function wizardAiErrorPayload(err: unknown, envName: Env['ENV']): WizardAiErrorPayload | null {
  if (err instanceof WizardValidationError) {
    return {
      status: 502,
      code: 'ai_output_invalid',
      message: 'AI returned an output that failed validation',
      details: err.details,
    }
  }
  if (err instanceof WizardAIError) {
    const sanitized = sanitizeError(err, envName, 500)
    return { status: 500, ...sanitized, code: 'ai_failed' }
  }
  return null
}
