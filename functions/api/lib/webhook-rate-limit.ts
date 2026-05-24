/**
 * INT-WEBHOOK-RATE-LIMIT-01 — 100 deliveries / minute / team.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 100

export function webhookRateLimitKey(teamId: string, windowStart: number): string {
  return `webhook:rate:${teamId}:${windowStart}`
}

export async function checkWebhookRateLimit(kv: KVNamespace, teamId: string): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS
  const key = webhookRateLimitKey(teamId, windowStart)
  const raw = await kv.get(key)
  const count = raw ? Number.parseInt(raw, 10) : 0
  if (count >= MAX_PER_WINDOW) return false
  await kv.put(key, String(count + 1), { expirationTtl: 120 })
  return true
}
