/**
 * Shared metering gate for user-triggered Workers AI calls.
 *
 * Before this helper only the insights routes were metered: copilot, studio
 * authoring, coaching and the wizard (mostly the 70B model) had no rate limit
 * and no monthly ceiling, so a single free-access account could loop them
 * indefinitely. Every user-triggered AI route calls `enforceAiBudget` AFTER its
 * ownership/governance checks (so a rejected request never costs quota) and
 * BEFORE the model call.
 *
 * Layers:
 *   1. `ai_burst` Workers RL profile (10/min per user) when bound, then
 *   2. a per-feature sustained KV window, then
 *   3. the ADR-0074 promo monthly AI ceiling (no-op outside the free window).
 */
import type { Context } from 'hono'
import { atomicRateLimitDual } from '../atomic-rate-limit'
import { consumePromoAiRun } from '../promo-ai-quota'
import { errorResponse } from '../error-handler'
import type { Env } from '../../types'

export type AiBudgetFeature =
  | 'copilot_turn'
  | 'copilot_suggest'
  | 'copilot_draft_poll'
  | 'studio_generate'
  | 'coaching'
  | 'coaching_similar'
  | 'wizard'

/** Sustained per-user windows. Generous for real use, tight against loops. */
export const AI_BUDGET_WINDOWS: Record<AiBudgetFeature, { max: number; windowSeconds: number }> = {
  copilot_turn: { max: 60, windowSeconds: 3600 },
  copilot_suggest: { max: 60, windowSeconds: 3600 },
  copilot_draft_poll: { max: 30, windowSeconds: 3600 },
  studio_generate: { max: 30, windowSeconds: 3600 },
  coaching: { max: 20, windowSeconds: 3600 },
  coaching_similar: { max: 60, windowSeconds: 3600 },
  wizard: { max: 20, windowSeconds: 3600 },
}

/** Features that count against the monthly promo AI ceiling (LLM generations). */
const PROMO_METERED: ReadonlySet<AiBudgetFeature> = new Set([
  'copilot_turn',
  'copilot_draft_poll',
  'studio_generate',
  'coaching',
  'wizard',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared across apps with different Variables
type AnyCtx = Context<{ Bindings: Env; Variables: any }>

/**
 * Returns a 429 Response when the caller is over budget, otherwise null.
 */
export async function enforceAiBudget(c: AnyCtx, userId: string, feature: AiBudgetFeature): Promise<Response | null> {
  const window = AI_BUDGET_WINDOWS[feature]
  const rl = await atomicRateLimitDual(c.env, {
    key: userId,
    burst: 'ai_burst',
    sustained: { ...window, prefix: `ai-budget:${feature}` },
    profileLabel: `ai_${feature}`,
  })
  if (!rl.allowed) {
    return errorResponse(c, 429, 'rate_limited', 'Too many AI requests; try again shortly')
  }

  if (PROMO_METERED.has(feature) && c.env.SESSIONS_KV) {
    const quota = await consumePromoAiRun(c.env, c.env.SESSIONS_KV, userId)
    if (!quota.allowed) {
      return errorResponse(
        c,
        429,
        'limit_exceeded',
        `Free-access AI limit reached (${quota.limit} AI runs this month). Resets on the 1st.`,
      )
    }
  }
  return null
}
