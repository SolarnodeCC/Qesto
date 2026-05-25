/**
 * API key records — hashed at rest in INTEGRATIONS_KV (SEC-APIKEY-LIFECYCLE-01).
 */
import { z } from 'zod'

export const ApiKeyScopeSchema = z.enum(['read', 'write', 'admin'])
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>

export const ApiKeyRecordSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  scopes: z.array(ApiKeyScopeSchema),
  createdAt: z.number(),
  createdBy: z.string(),
  prefix: z.string(),
  revokedAt: z.number().optional(),
  expiresAt: z.number().optional(),
  rotatedAt: z.number().optional(),
  lastUsedAt: z.number().optional(),
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

export function apiKeyRateLimitKey(keyId: string, windowStart: number): string {
  return `apikey:rl:${keyId}:${windowStart}`
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

export function isApiKeyActive(record: ApiKeyRecord, now = Date.now()): boolean {
  if (record.revokedAt) return false
  if (record.expiresAt && record.expiresAt < now) return false
  return true
}

export function apiKeyHasScope(record: ApiKeyRecord, scope: ApiKeyScope): boolean {
  return record.scopes.includes(scope) || record.scopes.includes('admin')
}
