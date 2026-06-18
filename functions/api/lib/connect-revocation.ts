/**
 * CONNECT-AUDIT-01 (ADR-0062 §1 follow-up) — jti-keyed invite revocation.
 *
 * S95 shipped TTL-bound invites only; ADR-0062 flagged revocation as the one gap to
 * close before CONNECT GA. A host may revoke an outstanding invite by its `jti`; the
 * join path (CONNECT-JOIN-01) checks the revocation list before admitting a tenant.
 *
 * Backed by KV. The key helper + the (un)revoke/lookup are kept thin and pure so the
 * join decision stays a single, testable verdict. Revocations carry the invite TTL
 * so the entry can expire with the invite it guards (no unbounded growth).
 */

import { readKvJson, writeKvJson } from './kv'

/** KV key for a revoked invite jti. Namespaced so it can't collide with other records. */
export function revokedInviteKey(jti: string): string {
  return `connect:invite:revoked:${jti}`
}

export type RevokedInvite = {
  jti: string
  sessionId: string
  revokedBy: string
  revokedAt: number
}

/**
 * Revoke an invite by jti. `expirationTtl` should be the invite's remaining
 * lifetime (seconds) so the tombstone self-expires with the invite. Idempotent.
 */
export async function revokeInvite(
  kv: KVNamespace,
  entry: RevokedInvite,
  expirationTtl?: number,
): Promise<void> {
  // KV requires a minimum TTL; below that, store without expiry (it's short-lived anyway).
  const opts = typeof expirationTtl === 'number' && expirationTtl >= 60 ? { expirationTtl } : undefined
  await writeKvJson(kv, revokedInviteKey(entry.jti), entry, opts)
}

/** True iff the invite jti has been revoked. */
export async function isInviteRevoked(kv: KVNamespace, jti: string): Promise<boolean> {
  const entry = await readKvJson<RevokedInvite>(kv, revokedInviteKey(jti))
  return entry !== null
}
