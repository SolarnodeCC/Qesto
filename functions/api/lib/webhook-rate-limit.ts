/**
 * INT-WEBHOOK-RATE-LIMIT-01 / ADR-0073 — 100 deliveries / minute / team.
 * Uses atomic facade (Tier A `webhook` profile) on ACTIONS_KV.
 */
import type { Env } from '../types'
import { atomicRateLimit } from './atomic-rate-limit'

export type WebhookRateLimitEnv = Pick<
  Env,
  'ACTIONS_KV' | 'ATOMIC_RATE_LIMIT_ENABLED' | 'RL_WEBHOOK' | 'METRICS_AE' | 'RATE_LIMIT_FAIL_CLOSED'
>

/** @deprecated Legacy key helper — runtime uses atomic KV prefix `rl:atomic-webhook:…`. */
export function webhookRateLimitKey(teamId: string, windowStart: number): string {
  return `webhook:rate:${teamId}:${windowStart}`
}

export async function checkWebhookRateLimit(
  env: WebhookRateLimitEnv,
  teamId: string,
): Promise<boolean> {
  const rl = await atomicRateLimit(env as Env, 'webhook', teamId)
  return rl.allowed
}
