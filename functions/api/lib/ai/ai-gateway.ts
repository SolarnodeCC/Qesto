/**
 * AI-GATEWAY-01: Semantic caching + rate limiting for all Workers AI inference.
 * Routes all AI.run() calls through Cloudflare AI Gateway for:
 * - Response caching (semantic + exact-match)
 * - Per-account rate limiting
 * - Cost analytics (no charge for cache hits)
 * - Provider-side observability
 *
 * ADR-042 Phase 1.1: Cache hits target −40–70% latency, −30–50% cost reduction.
 * Uses direct env.AI.run() when Gateway is not configured.
 *
 * @see knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md
 */
import type { Env } from '../../types'
import { AIGatewayJsonResponseSchema, parseJsonValue } from '../boundary-decode'
import {
  assertSanitizedAIGatewayRequest,
  sanitizeAIGatewayRequest,
} from './prompt-sanitize'
import type { SessionAIContext } from './session-context'

export type AIGatewayRequest = {
  model: string
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
 * Global AI Gateway configuration. Set CLOUDFLARE_AI_GATEWAY_ID via
 * `wrangler secret put CLOUDFLARE_AI_GATEWAY_ID <uuid>` in production.
 * For staging/dev, uses direct env.AI when Gateway ID is unset.
 * Phase 1.1 MVP: Gateway ID configured in Phase 1.2 via wrangler secret.
 */
export const AI_GATEWAY_CONFIG = {
  // Example: '8a6f7e9b-1234-5678-abcd-ef0123456789'
  // If not set, routes through direct env.AI.run()
  // Phase 1.2: wire via wrangler secret after Gateway provisioning
  gatewayId: null as string | null,
  cacheMode: 'semantic' as AIGatewayCacheMode,
  cacheTtlSeconds: 3600, // 1h for semantic matches
  requestTimeoutMs: 30_000, // 30s including network latency
}

/**
 * Call an AI model via Cloudflare AI Gateway with optional caching.
 * Uses direct env.AI.run() when Gateway is not configured or unavailable.
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
  env: Env,
  ctx: SessionAIContext,
  model: string,
  input: AIGatewayRequest,
): Promise<AIGatewayResponse> {
  const startMs = Date.now()
  const sanitizedInput = sanitizeAIGatewayRequest(input)
  assertSanitizedAIGatewayRequest(sanitizedInput)

  // If Gateway is not configured, bypass directly to env.AI
  if (!AI_GATEWAY_CONFIG.gatewayId) {
    const result = await env.AI.run(model, sanitizedInput)
    return {
      result,
      cached: false,
      gatewayLatencyMs: Date.now() - startMs,
    }
  }

  const gatewayUrl = buildGatewayUrl(model)
  const gatewayHeaders = buildGatewayHeaders(ctx.plan)

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: gatewayHeaders,
      body: JSON.stringify(sanitizedInput),
      signal: AbortSignal.timeout(AI_GATEWAY_CONFIG.requestTimeoutMs),
    })

    if (!response.ok) {
      if (response.status >= 500) {
        return directAiRun(env, model, sanitizedInput, startMs)
      }
      // Client error (bad request): propagate
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`)
    }

    const raw = await response.json()
    const data = parseJsonValue(AIGatewayJsonResponseSchema, raw) ?? {}

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
    if (err instanceof Error && err.name === 'AbortError') {
      return directAiRun(env, model, sanitizedInput, startMs)
    }
    return directAiRun(env, model, sanitizedInput, startMs)
  }
}

/**
 * Build the Cloudflare AI Gateway URL for the given model.
 * Pattern: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}?gateway_id={gatewayId}
 * Phase 1.2: wire account_id from wrangler.toml and gatewayId from secret after Gateway provisioning.
 */
function buildGatewayUrl(model: string): string {
  if (!AI_GATEWAY_CONFIG.gatewayId) {
    throw new Error('AI Gateway ID not configured')
  }
  // Phase 1.2: Account ID from wrangler.toml account_id field (5546763229b35df670e33d9316d7f2e0)
  const accountId = '5546763229b35df670e33d9316d7f2e0'
  const encoded = encodeURIComponent(model)
  const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encoded}`)
  url.searchParams.set('gateway_id', AI_GATEWAY_CONFIG.gatewayId)
  return url.toString()
}

/**
 * Build headers for AI Gateway requests.
 * Includes auth (bearer token) and plan-based rate-limit hints.
 */
function buildGatewayHeaders(plan: string): Record<string, string> {
  // In production, CLOUDFLARE_API_TOKEN is stored as a secret and passed via env.
  // For the MVP, we use the existing env.AI binding instead.
  // Phase 1.2: wire bearer token from wrangler secret.
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Qesto/1.0',
    // Optional: add plan-based rate-limit headers
    'X-Qesto-Plan': plan,
  }
}

/**
 * Direct env.AI.run() path when Gateway is unavailable or misconfigured.
 */
async function directAiRun(
  env: Env,
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
