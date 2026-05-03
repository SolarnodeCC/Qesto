export const INSIGHTS_MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'

export const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600, prefix: 'ai-insights' }

export const insightsCacheKey = (sessionId: string) => `insights:${sessionId}`
