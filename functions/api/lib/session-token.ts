import { readKvText, writeKvText } from './kv'

export async function hashSessionToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return toHex(new Uint8Array(digest))
}

export function revokedSessionTokenKey(tokenHash: string): string {
  return `session:revoked:${tokenHash}`
}

/**
 * DD-09 — per-user session epoch.
 *
 * Password reset previously issued a fresh cookie and left every existing
 * session alive for the remainder of the 14-day JWT lifetime, so the primary
 * self-service account-recovery control did not actually recover the account:
 * an attacker holding a stolen cookie kept access, and the victim had no way to
 * terminate it (ASVS V3.3.3).
 *
 * Per-token revocation cannot fix that, because the reset path has no way to
 * enumerate a user's outstanding tokens. An epoch does: bump it once, and every
 * JWT issued before that instant stops verifying.
 *
 * Kept in KV rather than a `users` column deliberately — `authMiddleware`
 * already performs a KV read here, so this adds no D1 query to the hot path
 * (cf. DD-16, which is about removing per-request database work, not adding it).
 */
export function sessionEpochKey(userId: string): string {
  return `session:epoch:${userId}`
}

/**
 * Invalidate every session issued before now for `userId`.
 *
 * Call on password reset, password change, and email change. Stored with a TTL
 * matching the maximum JWT lifetime: once no token that old can still verify,
 * the record has no work left to do.
 */
export async function bumpSessionEpoch(
  env: { ACTIONS_KV?: KVNamespace },
  userId: string,
  jwtTtlSeconds: number,
  now = Date.now(),
): Promise<void> {
  if (!env.ACTIONS_KV) return
  await writeKvText(env.ACTIONS_KV, sessionEpochKey(userId), String(now), {
    expirationTtl: jwtTtlSeconds,
  })
}

/**
 * True when `claims` predate the user's session epoch — i.e. the token was
 * issued before a password reset or credential change.
 *
 * `iat` is in seconds (JWT convention); the epoch is stored in milliseconds.
 * One second of slack absorbs the truncation when a token is minted in the same
 * second as the bump, so a legitimate post-reset login is never rejected.
 */
export async function isSessionSuperseded(
  env: { ACTIONS_KV?: KVNamespace },
  claims: { sub: string; iat: number },
): Promise<boolean> {
  if (!env.ACTIONS_KV) return false
  const raw = await readKvText(env.ACTIONS_KV, sessionEpochKey(claims.sub))
  if (!raw) return false
  const epochMs = Number(raw)
  if (!Number.isFinite(epochMs)) return false
  return claims.iat * 1000 + 1000 < epochMs
}

/**
 * True when `token` has been explicitly revoked (logout / refresh rotation).
 *
 * Every path that accepts a session JWT must consult this — a valid signature
 * proves only that we issued the token, never that it is still live. Shared so
 * routes that verify the JWT themselves (e.g. the WebSocket upgrade, which also
 * serves anonymous voters and therefore cannot sit behind `authMiddleware`)
 * cannot drift from the middleware's behaviour.
 *
 * Fails open when ACTIONS_KV is unbound, matching `authMiddleware`: the
 * revocation list is a supplementary control and the binding is absent only in
 * tests / pre-bootstrap.
 */
export async function isSessionTokenRevoked(
  env: { ACTIONS_KV?: KVNamespace },
  token: string,
): Promise<boolean> {
  if (!env.ACTIONS_KV) return false
  const tokenHash = await hashSessionToken(token)
  return (await readKvText(env.ACTIONS_KV, revokedSessionTokenKey(tokenHash))) !== null
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}
