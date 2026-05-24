/**
 * API-PUBLIC-V1 — team-scoped API keys (hashed at rest in INTEGRATIONS_KV).
 */
import { z } from 'zod'

export const ApiKeyRecordSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(['read', 'write'])),
  createdAt: z.number(),
  createdBy: z.string(),
  prefix: z.string(),
})

export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>

export function apiKeyKvKey(keyId: string): string {
  return `apikey:record:${keyId}`
}

export function apiKeyHashIndexKey(hashHex: string): string {
  return `apikey:hash:${hashHex}`
}

export function teamApiKeyIndexKey(teamId: string): string {
  return `apikey:team-index:${teamId}`
}

export async function hashApiKey(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateApiKey(): { raw: string; prefix: string } {
  const id = crypto.randomUUID().replace(/-/g, '')
  const raw = `qesto_${id}`
  return { raw, prefix: raw.slice(0, 12) }
}
