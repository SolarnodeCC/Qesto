/**
 * API key records -- hashed at rest in INTEGRATIONS_KV (SEC-APIKEY-LIFECYCLE-01).
 *
 * Scope model (ENTERPRISE-POLISH s12b):
 *
 * Legacy broad scopes (still accepted for backward compat):
 *   read   -- equivalent to all read:* scopes
 *   write  -- equivalent to all write:* scopes
 *   admin  -- supersedes all scopes
 *
 * Fine-grained resource scopes (preferred for new keys):
 *   read:sessions   -- list / get sessions and their questions
 *   read:results    -- read session results and decisions
 *   read:insights   -- read AI insights and themes
 *   read:team       -- read team members and settings
 *   write:sessions  -- create / update / delete sessions and questions
 *   write:votes     -- submit votes (embedded / kiosk integrations)
 *   write:webhooks  -- create / update / delete webhook endpoints
 *   write:exports   -- trigger CSV / XLSX / PDF exports
 *
 * apiKeyHasScope resolves both legacy and fine-grained scopes so existing
 * keys continue to work without migration.
 */
import { z } from 'zod'

export const LEGACY_SCOPES = ['read', 'write', 'admin'] as const
export const FINE_GRAINED_SCOPES = [
  'read:sessions',
  'read:results',
  'read:insights',
  'read:team',
  'write:sessions',
  'write:votes',
  'write:webhooks',
  'write:exports',
] as const

// z.enum requires a non-empty tuple literal; spread produces a plain array so
// we cast via `as` to satisfy the overload without losing type safety.
const ALL_SCOPES = [...LEGACY_SCOPES, ...FINE_GRAINED_SCOPES] as [string, ...string[]]
export const ApiKeyScopeSchema = z.enum(ALL_SCOPES)
export type ApiKeyScope = (typeof LEGACY_SCOPES)[number] | (typeof FINE_GRAINED_SCOPES)[number]

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

/**
 * Resolve whether record grants scope, honouring both legacy broad scopes
 * and the new fine-grained resource scopes.
 *
 * Resolution order:
 *   1. admin        -> grants everything
 *   2. exact match  -> granted
 *   3. legacy read  -> grants all read:* fine-grained scopes
 *   4. legacy write -> grants all write:* fine-grained scopes
 */
export function apiKeyHasScope(record: ApiKeyRecord, scope: ApiKeyScope): boolean {
  const { scopes } = record
  if (scopes.includes('admin')) return true
  if ((scopes as string[]).includes(scope)) return true
  if (scope.startsWith('read:') && scopes.includes('read')) return true
  if (scope.startsWith('write:') && scopes.includes('write')) return true
  return false
}

/** Convenience: return all effective scopes (useful for UI display). */
export function expandScopes(scopes: ApiKeyScope[]): ApiKeyScope[] {
  if (scopes.includes('admin')) return [...LEGACY_SCOPES, ...FINE_GRAINED_SCOPES]
  const expanded = new Set<ApiKeyScope>(scopes)
  if (scopes.includes('read')) {
    for (const s of FINE_GRAINED_SCOPES) {
      if (s.startsWith('read:')) expanded.add(s)
    }
  }
  if (scopes.includes('write')) {
    for (const s of FINE_GRAINED_SCOPES) {
      if (s.startsWith('write:')) expanded.add(s)
    }
  }
  return [...expanded]
}
