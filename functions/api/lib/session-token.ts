export async function hashSessionToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return toHex(new Uint8Array(digest))
}

export function revokedSessionTokenKey(tokenHash: string): string {
  return `session:revoked:${tokenHash}`
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}
