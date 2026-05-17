export const INSIGHTS_MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'

export const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600, prefix: 'ai-insights' }

/** KV TTL for cached insights payload after analyze. */
export const INSIGHTS_CACHE_TTL_SECONDS = 3600

export const insightsCacheKey = (sessionId: string) => `insights:${sessionId}`

/**
 * Token budget for the optional RAG context block injected into the
 * insights prompt. Kept modest so the response payload (themes + examples)
 * still fits comfortably within the model's 4K window.
 *
 * ADR-040 §2.6: default 1500; we use 800 here because the insights prompt
 * already carries up to 100 free-text responses + poll breakdown — leaving
 * more room for the KB section starves the actual signal.
 */
export const RAG_INSIGHTS_MAX_TOKENS = 800
