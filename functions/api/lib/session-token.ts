import { readKvText } from './kv'

export async function hashSessionToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return toHex(new Uint8Array(digest))
}

export function revokedSessionTokenKey(tokenHash: string): string {
  return `session:revoked:${tokenHash}`
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
