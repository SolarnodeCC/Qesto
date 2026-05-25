/**
 * WEBHOOK-DLQ-FOUNDATION-01 — dead-letter queue for failed webhook deliveries.
 */
import { readKvJson, writeKvJson } from './kv'
import { ulid } from './ulid'

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
  await writeKvJson(kv, key, list.slice(0, 100), { expirationTtl: 7 * 86400 })
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
  await writeKvJson(kv, key, next, { expirationTtl: 7 * 86400 })
  return true
}
