/**
 * AI-GATEWAY-01: Semantic caching + rate limiting for all Workers AI inference.
 * Routes all AI.run() calls through Cloudflare AI Gateway for:
 * - Response caching (semantic + exact-match)
 * - Per-account rate limiting
 * - Cost analytics (no charge for cache hits)
 * - Provider-side observability
 *
 * ADR-042 Phase 1.1: Cache hits target −40–70% latency, −30–50% cost reduction.
 * Falls back to direct env.AI.run() if Gateway is unavailable.
 *
 * @see knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md
 */
import { z } from 'zod'
import type { Anonymity, Env, PlanTier } from '../../types'
import {
  assertSanitizedAIGatewayRequest,
  sanitizeAIGatewayRequest,
} from './prompt-sanitize'
import type { SessionAIContext } from './session-context'

/**
 * Shape of the raw AI Gateway HTTP response. Validated at the boundary
 * (HLT-031, issue #686) instead of `(await response.json()) as {...}` — a
 * malformed gateway body falls back to direct env.AI rather than propagating
 * an unchecked shape downstream.
 */
export const AIGatewayRawResponseSchema = z.object({
  result: z.unknown().optional(),
  cached: z.boolean().optional(),
  cache_age: z.number().optional(),
})

export type AIGatewayRequest = {
  /** Optional when using {@link runAI} (model is passed separately). */
  model?: string
  messages?: Array<{ role: string; content: string }>
  text?: string // for sentiment model (distilbert)
  [key: string]: unknown
}

export type AIGatewayResponse = {
  result: unknown
  cached: boolean
  cacheAge?: number // seconds
  gatewayLatencyMs?: number
}

type AIGatewayCacheMode = 'semantic' | 'exact'

/**
 * Static AI Gateway tuning. Deployment identity (gateway id, token, account)
 * comes from env via `resolveGatewayConfig` — set with:
 *   wrangler secret put CLOUDFLARE_AI_GATEWAY_ID
 *   wrangler secret put CLOUDFLARE_AI_GATEWAY_TOKEN
 * When either secret is absent, every call bypasses to direct env.AI.run().
 */
export const AI_GATEWAY_CONFIG = {
  cacheMode: 'semantic' as AIGatewayCacheMode,
  cacheTtlSeconds: 3600, // 1h for semantic matches
  requestTimeoutMs: 30_000, // 30s including network latency
}

// wrangler.toml `account_id` — overridable via env for staging/alt accounts.
const DEFAULT_ACCOUNT_ID = '5546763229b35df670e33d9316d7f2e0'

/**
 * The only Env surface the gateway needs. Narrowed so standalone workers
 * (worker/, workers/) with their own env interfaces can use {@link runAI}
 * without depending on the full functions Env.
 */
export type AIGatewayEnv = Pick<
  Env,
  'AI' | 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_AI_GATEWAY_ID' | 'CLOUDFLARE_AI_GATEWAY_TOKEN'
>

export type AIGatewayResolvedConfig = {
  gatewayId: string | null
  token: string | null
  accountId: string
}

function resolveGatewayConfig(env: AIGatewayEnv): AIGatewayResolvedConfig {
  return {
    gatewayId: env.CLOUDFLARE_AI_GATEWAY_ID ?? null,
    token: env.CLOUDFLARE_AI_GATEWAY_TOKEN ?? null,
    accountId: env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID,
  }
}

/**
 * Call an AI model via Cloudflare AI Gateway with optional caching.
 * Falls back to direct env.AI.run() if Gateway is not configured or unavailable.
 *
 * @param env Cloudflare Env
 * @param ctx Session AI context (for logging + plan-based limits)
 * @param model Model ID (e.g., @cf/meta/llama-3.3-70b-instruct-fp8-fast)
 * @param input Request body (messages[], text, etc.)
 * @returns { result, cached, cacheAge, gatewayLatencyMs }
 *
 * @example
 * const response = await runThroughAIGateway(env, ctx, '@cf/meta/distilbert-sst-2-int8', { text: 'hello' });
 * if (response.cached) console.log('cache hit, saved latency');
 */
export async function runThroughAIGateway(
  env: AIGatewayEnv,
  ctx: SessionAIContext,
  model: string,
  input: AIGatewayRequest,
): Promise<AIGatewayResponse> {
  const startMs = Date.now()
  const sanitizedInput = sanitizeAIGatewayRequest({ ...input, model })
  assertSanitizedAIGatewayRequest(sanitizedInput)

  // If Gateway is not configured (either secret missing), bypass to env.AI.
  const config = resolveGatewayConfig(env)
  if (!config.gatewayId || !config.token) {
    const result = await env.AI.run(model, sanitizedInput)
    return {
      result,
      cached: false,
      gatewayLatencyMs: Date.now() - startMs,
    }
  }

  const gatewayUrl = buildGatewayUrl(config, model)
  const gatewayHeaders = buildGatewayHeaders(config, ctx.plan)

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: gatewayHeaders,
      body: JSON.stringify(sanitizedInput),
      signal: AbortSignal.timeout(AI_GATEWAY_CONFIG.requestTimeoutMs),
    })

    if (!response.ok) {
      // Gateway error: fall back to direct env.AI
      if (response.status >= 500) {
        return fallbackToDirect(env, model, sanitizedInput, startMs)
      }
      // Client error (bad request): propagate
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`)
    }

    const parsed = AIGatewayRawResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      // Gateway returned an unexpected body shape — treat like a gateway fault.
      return fallbackToDirect(env, model, sanitizedInput, startMs)
    }
    const data = parsed.data

    const response_obj: AIGatewayResponse = {
      result: data.result,
      cached: data.cached ?? false,
      gatewayLatencyMs: Date.now() - startMs,
    }
    if (data.cache_age !== undefined) {
      response_obj.cacheAge = data.cache_age
    }
    return response_obj
  } catch (err) {
    // Network error, timeout, or Gateway down: fall back to direct env.AI
    if (err instanceof Error && err.name === 'AbortError') {
      return fallbackToDirect(env, model, sanitizedInput, startMs)
    }
    return fallbackToDirect(env, model, sanitizedInput, startMs)
  }
}

export type RunAIOptions = {
  /** Full session context, when the caller has one (preferred). */
  ctx?: SessionAIContext
  /** Plan tier for rate-limit hints when no full ctx is available. */
  plan?: PlanTier
}

/** Minimal Env shim when only the AI binding is available (tests, legacy `ai: Ai` params). */
export function envWithAI(ai: Env['AI']): AIGatewayEnv {
  return { AI: ai } as AIGatewayEnv
}

/**
 * Ergonomic facade over {@link runThroughAIGateway} (ADR-0068).
 *
 * The gateway wrapper requires a full {@link SessionAIContext}, which is why
 * almost no call site adopted it — most lib/route helpers don't have one. `runAI`
 * makes the context optional (synthesising a minimal system context) and returns
 * the bare model result, so it is a drop-in replacement for `env.AI.run(model, input)`
 * while still getting caching, rate limiting, prompt sanitisation and fallback.
 *
 * Enforced by `scripts/check-ai-gateway.mjs` (ratchet on raw `AI.run` / `ai.run(`).
 *
 * @example
 *   const result = await runAI(env, model, { messages })
 *   const result = await runAI(env, SENTIMENT_MODEL, { text }, { plan })
 */
export async function runAI(
  env: AIGatewayEnv,
  model: string,
  input: AIGatewayRequest,
  opts: RunAIOptions = {},
): Promise<unknown> {
  const ctx: SessionAIContext = opts.ctx ?? {
    sessionId: 'system',
    teamId: null,
    plan: opts.plan ?? ('free' as PlanTier),
    anonymity: 'partial' as Anonymity,
    locale: 'en',
    model,
    promptVersion: 'v1',
  }
  const response = await runThroughAIGateway(env, ctx, model, input)
  return response.result
}

/**
 * Build the canonical Cloudflare AI Gateway URL for a Workers AI model:
 * https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/{model}
 */
function buildGatewayUrl(config: AIGatewayResolvedConfig, model: string): string {
  if (!config.gatewayId) {
    throw new Error('AI Gateway ID not configured')
  }
  // Model ids contain `/` segments (@cf/meta/...) which the gateway expects
  // verbatim in the path — encode each segment, keep the separators.
  const modelPath = model.split('/').map(encodeURIComponent).join('/')
  return `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/workers-ai/${modelPath}`
}

/**
 * Build headers for AI Gateway requests.
 * Includes auth (bearer token) and plan-based rate-limit hints.
 */
function buildGatewayHeaders(config: AIGatewayResolvedConfig, plan: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Qesto/1.0',
    // Optional: add plan-based rate-limit headers
    'X-Qesto-Plan': plan,
  }
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`
  return headers
}

/**
 * Fallback to direct env.AI.run() if Gateway is unavailable or misconfigured.
 */
async function fallbackToDirect(
  env: AIGatewayEnv,
  model: string,
  input: AIGatewayRequest,
  startMs: number,
): Promise<AIGatewayResponse> {
  const result = await env.AI.run(model, input)
  return {
    result,
    cached: false,
    gatewayLatencyMs: Date.now() - startMs,
  }
}

/**
 * Utility: extract a cache key from an AI request.
 * For semantic caching, this would be a vector embedding of the prompt.
 * For exact-match caching, this is a hash of the full input.
 * Currently used for observability; actual caching is handled by Gateway.
 */
export function extractCacheKey(_model: string, input: AIGatewayRequest): string {
  if (input.text) {
    // Sentiment model: hash the text
    return `sentiment:${hashString(input.text)}`
  }
  if (input.messages) {
    // Chat model: hash the message concatenation
    const combined = input.messages.map((m) => `${m.role}:${m.content}`).join('|')
    return `chat:${hashString(combined)}`
  }
  return `unknown:${hashString(JSON.stringify(input))}`
}

/**
 * Simple string hash (not cryptographic; for cache keys only).
 */
function hashString(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

export const __internal = {
  resolveGatewayConfig,
  buildGatewayUrl,
  buildGatewayHeaders,
  DEFAULT_ACCOUNT_ID,
}
