// Magic-link tokens. The raw token is 32 random bytes, hex-encoded (64 chars).
// We only persist sha-256(raw) in D1; a leaked DB never yields login tokens.

export function generateMagicLinkToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return hex(bytes)
}

export async function hashMagicLinkToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return hex(new Uint8Array(digest))
}

function hex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}
