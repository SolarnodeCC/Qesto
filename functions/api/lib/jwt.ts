// HS256 JWT sign/verify via WebCrypto. No third-party dependency —
// runs on Cloudflare Workers and in Vitest (Node 20+).
//
// Claim shape is intentionally small for v1:
//   { sub: userId, email, iat, exp }
// Extend in Phase 2+ only when routes actually need new claims.

import { validateData, AuthClaimsSchema } from './validators'

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
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sig] = parts
  if (headerB64 !== HEADER_B64) return null
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
  if (!signatureOk) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
  } catch {
    return null
  }
  const claims = validateData(parsed, AuthClaimsSchema)
  if (!claims) return null
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp < now) return null
  return claims
}

export function jwtVerificationSecrets(env: { JWT_SECRET: string; JWT_SECRET_PREV?: string }): string[] {
  const out: string[] = []
  if (env.JWT_SECRET) out.push(env.JWT_SECRET)
  if (env.JWT_SECRET_PREV && env.JWT_SECRET_PREV !== env.JWT_SECRET) out.push(env.JWT_SECRET_PREV)
  return out
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(mac))
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
