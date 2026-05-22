/**
 * AI-CONTEXT-01 — typed Workers AI context for all inference paths.
 * @see knowledge-base/architecture/AI_CONTEXT_SPEC.md
 */
import type { Context } from 'hono'
import type { Env, Anonymity, PlanTier } from '../../types'
import { CircuitBreakers } from '../resilience/circuit-breaker'
import { writeEvent } from '../observability'

export type SessionAIContext = {
  sessionId: string
  teamId: string | null
  plan: PlanTier
  anonymity: Anonymity
  locale: string
  model: string
  promptVersion: string
}

export type AIOverride = Partial<Pick<SessionAIContext, 'model' | 'promptVersion' | 'locale'>>

export type AIPipelineResult<T> =
  | { ok: true; data: T; model: string; durationMs: number }
  | { ok: false; code: 'ai_unavailable' | 'ai_timeout' | 'ai_rate_limited'; message: string }

export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
export const SENTIMENT_MODEL = '@cf/meta/distilbert-sst-2-int8'
export const PROMPT_VERSION = 'v1'

export function modelForPlan(_plan: PlanTier): string {
  return DEFAULT_AI_MODEL
}

export function aiOverride(ctx: SessionAIContext, override: AIOverride): SessionAIContext {
  return { ...ctx, ...override }
}

export async function buildSessionAIContext(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
): Promise<SessionAIContext | null> {
  const row = await c.env.DB.prepare(
    `SELECT team_id, anonymity, owner_id FROM sessions WHERE id = ?1`,
  )
    .bind(sessionId)
    .first<{ team_id: string | null; anonymity: Anonymity; owner_id: string }>()
  if (!row) return null

  const user = await c.env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
    .bind(row.owner_id)
    .first<{ plan: PlanTier }>()
  const plan: PlanTier = user?.plan ?? 'free'
  const locale = c.req.header('Accept-Language')?.split(',')[0]?.trim() || 'en'

  return {
    sessionId,
    teamId: row.team_id,
    plan,
    anonymity: row.anonymity,
    locale,
    model: modelForPlan(plan),
    promptVersion: PROMPT_VERSION,
  }
}

export async function aiPipeline<T>(
  ctx: SessionAIContext,
  env: Env,
  run: (model: string, signal: AbortSignal) => Promise<T>,
): Promise<AIPipelineResult<T>> {
  const started = Date.now()
  try {
    const data = await CircuitBreakers.ai.execute(
      (signal) => run(ctx.model, signal),
      () => {
        throw new Error('circuit_open')
      },
    )
    const durationMs = Date.now() - started
    writeEvent(env.METRICS_AE, {
      name: 'ai.inference',
      sessionId: ctx.sessionId,
      teamId: ctx.teamId ?? undefined,
      plan: ctx.plan,
      durationMs,
      detail: ctx.model,
    })
    return { ok: true, data, model: ctx.model, durationMs }
  } catch (err) {
    const durationMs = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'circuit_open') {
      return { ok: false, code: 'ai_unavailable', message: 'Workers AI unavailable (circuit open)' }
    }
    if (err instanceof Error && err.name === 'AbortError') {
      writeEvent(env.METRICS_AE, {
        name: 'error.ai_timeout',
        sessionId: ctx.sessionId,
        teamId: ctx.teamId ?? undefined,
        plan: ctx.plan,
        durationMs,
        detail: ctx.model,
      })
      return { ok: false, code: 'ai_timeout', message: 'Workers AI request timed out' }
    }
    return { ok: false, code: 'ai_unavailable', message: 'Workers AI request failed' }
  }
}
