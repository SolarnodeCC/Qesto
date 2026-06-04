/**
 * AI-CONTEXT-01 — typed Workers AI context for all inference paths.
 * All Workers AI.run() calls are routed through the AI Gateway wrapper (ai-gateway.ts)
 * for semantic caching, rate limiting, and cost analytics.
 * @see knowledge-base/architecture/AI_CONTEXT_SPEC.md
 * @see ai-gateway.ts — AI Gateway + fallback logic
 * @see knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md (Phase 1.1)
 */
import type { Context } from 'hono'
import type { Env, Anonymity, PlanTier } from '../../types'
import { CircuitBreakers } from '../resilience/circuit-breaker'
import { writeEvent } from '../observability'
import { runThroughAIGateway, type AIGatewayRequest } from './ai-gateway'

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

export function sentimentContextFromMeta(meta: {
  sessionId: string
  teamId?: string | undefined
  plan?: PlanTier | undefined
  anonymity?: Anonymity | undefined
}): SessionAIContext {
  return {
    sessionId: meta.sessionId,
    teamId: meta.teamId ?? null,
    plan: meta.plan ?? 'free',
    anonymity: meta.anonymity ?? 'partial',
    locale: 'en',
    model: modelForPlan(meta.plan ?? 'free'),
    promptVersion: PROMPT_VERSION,
  }
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

/**
 * Unified entry point for AI inference via Cloudflare AI Gateway.
 * Routes through the Gateway for semantic caching + rate limiting, with fallback to direct env.AI.
 * Wraps with circuit breaker + observability logging.
 *
 * Usage (replaces inline env.AI.run() calls):
 * ```
 * const result = await runAI(ctx, env, '@cf/meta/distilbert-sst-2-int8', { text: 'hello' });
 * ```
 *
 * @param ctx Session AI context (plan, sessionId, model preference, etc.)
 * @param env Cloudflare Env
 * @param model Model ID (e.g., @cf/meta/llama-3.3-70b-instruct-fp8-fast)
 * @param input Request body (messages[], text, etc.)
 * @returns AIPipelineResult with result, model, durationMs
 */
export async function runAI<T extends Record<string, unknown>>(
  ctx: SessionAIContext,
  env: Env,
  model: string,
  input: AIGatewayRequest,
): Promise<AIPipelineResult<T>> {
  const started = Date.now()
  try {
    const data = await CircuitBreakers.ai.execute(
      () => runThroughAIGateway(env, ctx, model, input),
      () => {
        throw new Error('circuit_open')
      },
    )
    const durationMs = Date.now() - started
    writeEvent(env.METRICS_AE, {
      name: data.cached ? 'ai.cache_hit' : 'ai.cache_miss',
      sessionId: ctx.sessionId,
      teamId: ctx.teamId ?? undefined,
      plan: ctx.plan,
      durationMs,
      detail: model,
      cacheAge: data.cacheAge,
      gatewayMs: data.gatewayLatencyMs,
    })
    return { ok: true, data: data.result as T, model, durationMs }
  } catch (err) {
    const durationMs = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'circuit_open') {
      return { ok: false, code: 'ai_unavailable', message: 'Workers AI unavailable (circuit open)' }
    }
    writeEvent(env.METRICS_AE, {
      name: 'error.api',
      sessionId: ctx.sessionId,
      teamId: ctx.teamId ?? undefined,
      plan: ctx.plan,
      durationMs,
      detail: model,
    })
    return { ok: false, code: 'ai_unavailable', message: 'AI inference failed' }
  }
}
