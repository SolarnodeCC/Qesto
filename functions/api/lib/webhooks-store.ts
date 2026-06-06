// WEBHOOK-01 — KV persistence and team-scoped webhook index.

import { absent } from './absent'
import { validateData, WebhookConfigSchema } from './protocol-schemas'
import { z } from 'zod'
import type { WebhookConfig } from './webhooks-types'
import { webhookConfigKey, webhookTeamIndexKey } from './webhooks-types'

const WebhookTeamIndexSchema = z.array(z.string())

export async function loadTeamWebhookIds(kv: KVNamespace, teamId: string): Promise<string[]> {
  try {
    const raw = await kv.get(webhookTeamIndexKey(teamId))
    if (!raw) return []
    return validateData(JSON.parse(raw), WebhookTeamIndexSchema) ?? []
  } catch {
    return []
  }
}

export async function loadWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<WebhookConfig | null> {
  try {
    const raw = await kv.get(webhookConfigKey(teamId, webhookId))
    if (!raw) return absent()
    const parsed = JSON.parse(raw)
    return validateData(parsed, WebhookConfigSchema)
  } catch {
    return absent()
  }
}

export async function saveWebhookConfig(kv: KVNamespace, config: WebhookConfig): Promise<void> {
  await kv.put(webhookConfigKey(config.teamId, config.id), JSON.stringify(config))
}

export async function deleteWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  await kv.delete(webhookConfigKey(teamId, webhookId))
}

export async function loadTeamWebhooks(
  kv: KVNamespace,
  teamId: string,
): Promise<WebhookConfig[]> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  const out: WebhookConfig[] = []
  for (const id of ids) {
    const cfg = await loadWebhookConfig(kv, teamId, id)
    if (cfg) out.push(cfg)
  }
  return out
}

export async function getWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<WebhookConfig | null> {
  return loadWebhookConfig(kv, teamId, webhookId)
}

export async function addToTeamIndex(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  if (!ids.includes(webhookId)) {
    ids.push(webhookId)
    await kv.put(webhookTeamIndexKey(teamId), JSON.stringify(ids))
  }
}

export async function removeFromTeamIndex(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  const next = ids.filter((id) => id !== webhookId)
  if (next.length !== ids.length) {
    await kv.put(webhookTeamIndexKey(teamId), JSON.stringify(next))
  }
}

export async function countTeamWebhooks(kv: KVNamespace, teamId: string): Promise<number> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  return ids.length
}

/** Strip the HMAC secret so configs are safe to return in GET/LIST responses. */
export function redactWebhookSecret(
  config: WebhookConfig,
): Omit<WebhookConfig, 'secret'> & { secret: string } {
  return { ...config, secret: '***' }
}
