/**
 * promo-ai-quota.ts — ADR-0074 cost ceiling for the free-access window.
 *
 * Granting `team` to every account turns `insightsAI` on for everyone, and
 * nothing else bounds what a single account can spend across a month:
 * `countInsightsThisMonth` is reported by /api/plans/:userId/usage but never
 * enforced, and the per-request limiters in the insights routes only shape
 * burst. This module is the monthly ceiling.
 *
 * Scope: enforced ONLY while the promo window is open. Outside it the tiers
 * behave exactly as they did before — free/starter cannot reach AI insights at
 * all, and `team` is sold as unlimited.
 *
 * Consistency: read-then-write on KV, the same pattern as lib/quota.ts. Two
 * concurrent runs can both observe the same count and slip one over the line.
 * That is acceptable for a cost ceiling measured in tens per month; the atomic
 * limiter (ADR-0073) shapes the burst that would be needed to exploit it.
 */

import { readKvJson, writeKvJson } from './kv'
import { promoAiRunsKey } from './kv-keys'
import { freeAccessActive } from './free-access'
import type { Env } from '../types'

export const DEFAULT_PROMO_AI_MONTHLY_CAP = 25

export type PromoAiQuotaEnv = Pick<
  Env,
  'FREE_ACCESS_ALL' | 'FREE_ACCESS_UNTIL' | 'PROMO_AI_MONTHLY_CAP'
>

export type PromoAiRunRecord = {
  user_id: string
  month: string // YYYY-MM
  runs: number
  last_updated: number
}

export type PromoAiQuotaResult = {
  /** False only when the promo is live and the user is at or over the cap. */
  allowed: boolean
  used: number
  /** null when no cap applies (promo closed, or explicitly disabled with '0'). */
  limit: number | null
}

/**
 * Monthly AI-run ceiling in force right now, or null when none applies.
 * `PROMO_AI_MONTHLY_CAP = '0'` disables the cap without closing the promo.
 */
export function promoInsightsCap(env: PromoAiQuotaEnv, now = Date.now()): number | null {
  if (!freeAccessActive(env, now)) return null
  const raw = env.PROMO_AI_MONTHLY_CAP
  if (raw === undefined || raw === '') return DEFAULT_PROMO_AI_MONTHLY_CAP
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PROMO_AI_MONTHLY_CAP
  return parsed === 0 ? null : Math.floor(parsed)
}

/** Current month's AI-run count for a user, without consuming one. */
export async function getPromoAiRuns(kv: KVNamespace, userId: string, now = new Date()): Promise<number> {
  const record = await readKvJson<PromoAiRunRecord>(kv, promoAiRunsKey(userId, monthKey(now)))
  return record?.runs ?? 0
}

/**
 * Consume one AI run against the promo ceiling.
 *
 * Returns `allowed: true` with `limit: null` when no cap is in force, so callers
 * can call this unconditionally and let the module decide whether the window is
 * open. Never throws: a KV fault must not take AI insights down, so it fails
 * OPEN — the ceiling is a cost control, not a security boundary.
 */
export async function consumePromoAiRun(
  env: PromoAiQuotaEnv,
  kv: KVNamespace,
  userId: string,
  now = new Date(),
): Promise<PromoAiQuotaResult> {
  const limit = promoInsightsCap(env, now.getTime())
  if (limit === null) return { allowed: true, used: 0, limit: null }

  const key = promoAiRunsKey(userId, monthKey(now))
  let record: PromoAiRunRecord | null = null
  try {
    record = await readKvJson<PromoAiRunRecord>(kv, key)
  } catch {
    return { allowed: true, used: 0, limit }
  }

  const used = record?.runs ?? 0
  if (used >= limit) return { allowed: false, used, limit }

  try {
    await writeKvJson(
      kv,
      key,
      { user_id: userId, month: monthKey(now), runs: used + 1, last_updated: now.getTime() },
      { expirationTtl: secondsRemainingInMonth(now) },
    )
  } catch {
    // Counted-but-unwritten is preferable to blocking the run.
  }

  return { allowed: true, used: used + 1, limit }
}

function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** TTL to the end of the current month, so the counter rolls over on its own. */
function secondsRemainingInMonth(now: Date): number {
  const firstOfNext = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return Math.max(3600, Math.ceil((firstOfNext - now.getTime()) / 1000))
}

export const __internal = { monthKey, secondsRemainingInMonth }
