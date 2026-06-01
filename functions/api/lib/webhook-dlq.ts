/**
 * WEBHOOK-DLQ-FOUNDATION-01 -- dead-letter queue for failed webhook deliveries.
 *
 * ENTERPRISE-POLISH s7b additions:
 *   - retryWebhookDlqEntry: re-attempt delivery of a single DLQ item, removing
 *     it on success or re-enqueuing with incremented attempts on failure.
 *   - DLQ_MAX_RETRY_ATTEMPTS: hard ceiling to prevent infinite re-queuing.
 *   - WebhookDlqRetryResult: typed result so callers can surface outcome in UI.
 */
import { readKvJson, writeKvJson } from './kv'
import { ulid } from './ulid'
import { WEBHOOK_DLQ_TTL_SECONDS } from './constants'

export const DLQ_MAX_RETRY_ATTEMPTS = 10

export type WebhookDlqEntry = {
  id: string
  webhookId: string
  teamId: string
  event: string
  url: string
  payload: Record<string, unknown>
  error: string
  attempts: number
  enqueuedAt: number
}

export function webhookDlqKey(teamId: string): string {
  return `webhook:dlq:${teamId}`
}

export async function enqueueWebhookDlq(
  kv: KVNamespace,
  entry: Omit<WebhookDlqEntry, 'id' | 'enqueuedAt'>,
): Promise<WebhookDlqEntry> {
  const full: WebhookDlqEntry = { ...entry, id: ulid(), enqueuedAt: Date.now() }
  const key = webhookDlqKey(entry.teamId)
  const list = (await readKvJson<WebhookDlqEntry[]>(kv, key)) ?? []
  list.unshift(full)
  await writeKvJson(kv, key, list.slice(0, 100), { expirationTtl: WEBHOOK_DLQ_TTL_SECONDS })
  return full
}

export async function listWebhookDlq(kv: KVNamespace, teamId: string): Promise<WebhookDlqEntry[]> {
  return (await readKvJson<WebhookDlqEntry[]>(kv, webhookDlqKey(teamId))) ?? []
}

export async function removeWebhookDlqEntry(kv: KVNamespace, teamId: string, entryId: string): Promise<boolean> {
  const key = webhookDlqKey(teamId)
  const list = (await readKvJson<WebhookDlqEntry[]>(kv, key)) ?? []
  const next = list.filter((e) => e.id !== entryId)
  if (next.length === list.length) return false
  await writeKvJson(kv, key, next, { expirationTtl: WEBHOOK_DLQ_TTL_SECONDS })
  return true
}

// ---- Retry ------------------------------------------------------------------

export type WebhookDlqRetryResult =
  | { ok: true; delivered: true }
  | { ok: false; reason: 'max_attempts_exceeded' | 'delivery_failed' | 'entry_not_found'; error?: string }

/**
 * Re-attempt delivery of a single DLQ entry.
 *
 * On HTTP 2xx: removes the entry from the DLQ and returns { ok: true }.
 * On failure below DLQ_MAX_RETRY_ATTEMPTS: re-enqueues with attempts+1.
 * On failure at or above DLQ_MAX_RETRY_ATTEMPTS: removes the entry and
 * returns { ok: false, reason: 'max_attempts_exceeded' }.
 *
 * The deliver callback must not throw.
 */
export async function retryWebhookDlqEntry(
  kv: KVNamespace,
  teamId: string,
  entryId: string,
  deliver: (entry: WebhookDlqEntry) => Promise<{ success: boolean; error?: string }>,
): Promise<WebhookDlqRetryResult> {
  const key = webhookDlqKey(teamId)
  const list = (await readKvJson<WebhookDlqEntry[]>(kv, key)) ?? []
  const entry = list.find((e) => e.id === entryId)
  if (!entry) return { ok: false, reason: 'entry_not_found' }

  if (entry.attempts >= DLQ_MAX_RETRY_ATTEMPTS) {
    await removeWebhookDlqEntry(kv, teamId, entryId)
    return { ok: false, reason: 'max_attempts_exceeded' }
  }

  const result = await deliver(entry)

  if (result.success) {
    await removeWebhookDlqEntry(kv, teamId, entryId)
    return { ok: true, delivered: true }
  }

  // Re-enqueue with incremented attempt count.
  const updated: WebhookDlqEntry = {
    ...entry,
    attempts: entry.attempts + 1,
    error: result.error ?? entry.error,
  }
  const next = list.map((e) => (e.id === entryId ? updated : e))
  await writeKvJson(kv, key, next, { expirationTtl: WEBHOOK_DLQ_TTL_SECONDS })
  return { ok: false, reason: 'delivery_failed', ...(result.error !== undefined ? { error: result.error } : {}) }
}

/**
 * Build a deliver callback for retryWebhookDlqEntry that makes a single HTTP
 * attempt with HMAC signature. Pass hmacFn from webhooks.ts to avoid circular imports.
 */
export async function buildDlqDeliveryFn(
  config: { url: string; secret: string },
  hmacFn: (secret: string, body: string) => Promise<string>,
): Promise<(entry: WebhookDlqEntry) => Promise<{ success: boolean; error?: string }>> {
  return async (entry: WebhookDlqEntry) => {
    const body = JSON.stringify({ event: entry.event, timestamp: Date.now(), data: entry.payload })
    let signature: string
    try {
      signature = await hmacFn(config.secret, body)
    } catch (err) {
      return { success: false, error: `HMAC: ${(err as Error).message}` }
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch(entry.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Qesto-Event': entry.event,
          'X-Qesto-Timestamp': String(Date.now()),
          'X-Qesto-Signature-256': `sha256=${signature}`,
          'User-Agent': 'Qesto-Webhook-Retry/1.0',
        },
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)
      const success = res.status >= 200 && res.status < 300
      return { success, ...(success ? {} : { error: `HTTP ${res.status}` }) }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
}
