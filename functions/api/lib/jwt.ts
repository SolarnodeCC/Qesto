import { absent } from './absent'
// HS256 JWT sign/verify via WebCrypto. No third-party dependency —
// runs on Cloudflare Workers and in Vitest (Node 20+).
//
// Claim shape is intentionally small for v1:
//   { sub: userId, email, iat, exp }
// Extend in Phase 2+ only when routes actually need new claims.

import { validateData, AuthClaimsSchema } from './protocol-schemas'
import { hmacSign, base64UrlEncode, base64UrlDecode, timingSafeEqual } from './shared/crypto'
const ALG = 'HS256'
const HEADER = { alg: ALG, typ: 'JWT' }
const HEADER_B64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(HEADER)))

export type AuthClaims = {
  sub: string
  email: string
  jti?: string | undefined
  iat: number
  exp: number
}

export async function signJwt(claims: Omit<AuthClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number): Promise<string> {
  if (!secret) throw new Error('JWT_SECRET is not configured — set it via `wrangler pages secret put JWT_SECRET`')
  const now = Math.floor(Date.now() / 1000)
  const full: AuthClaims = { ...claims, iat: now, exp: now + ttlSeconds }
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(full)))
  const data = `${HEADER_B64}.${payloadB64}`
  const sig = await hmacSign(secret, data)
  return `${data}.${sig}`
}

export async function verifyJwt(token: string, secret: string): Promise<AuthClaims | null> {
  return verifyJwtWithSecrets(token, [secret])
}

/** SEC-JWT-ROTATE-01 — accept tokens signed with current or previous secret. */
export async function verifyJwtWithSecrets(token: string, secrets: string[]): Promise<AuthClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return absent()
  const [headerB64, payloadB64, sig] = parts
  if (headerB64 !== HEADER_B64) return absent()
  const data = `${headerB64}.${payloadB64}`
  let signatureOk = false
  for (const secret of secrets) {
    if (!secret) continue
    const expected = await hmacSign(secret, data)
    if (timingSafeEqual(sig, expected)) {
      signatureOk = true
      break
    }
  }
  if (!signatureOk) return absent()
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
  } catch {
    return absent()
  }
  const claims = validateData(parsed, AuthClaimsSchema)
  if (!claims) return absent()
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp < now) return absent()
  return claims
}

export function jwtVerificationSecrets(env: { JWT_SECRET: string; JWT_SECRET_PREV?: string }): string[] {
  const out: string[] = []
  if (env.JWT_SECRET) out.push(env.JWT_SECRET)
  if (env.JWT_SECRET_PREV && env.JWT_SECRET_PREV !== env.JWT_SECRET) out.push(env.JWT_SECRET_PREV)
  return out
}

