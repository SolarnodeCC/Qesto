// WEBHOOK-01 — HMAC signing helpers for outbound webhook delivery.

/**
 * Compute hex HMAC-SHA256 of `body` using `secret`. Returns lower-case hex.
 */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const bytes = new Uint8Array(mac)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** Generate a 32-byte random hex secret for HMAC signing (64 chars). */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}
