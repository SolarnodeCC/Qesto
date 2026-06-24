// EMBED-WIDGET-API-01 (ADR-0050) — origin-bound, read-scoped, short-lived widget token.
//
// The token is a compact HMAC-SHA-256 envelope (NOT a JWT-with-secrets-in-payload,
// NOT an API key) safe to embed in a public third-party page: it grants only
// aggregate-read against one session, pinned to the customer's origin(s) and a short
// TTL. Sign/verify reuse the single shared HMAC primitive (lib/shared/crypto.ts) —
// no route mints its own MAC inline (ADR-0049 single-sourced-primitive discipline).
//
//   token = base64url(payloadJson) + '.' + hmacSign(EMBED_WIDGET_SECRET, base64url(payloadJson))
//
// Verification re-signs the payload and compares with a timing-safe equality.

import { hmacSign, base64UrlEncode, base64UrlDecode, timingSafeEqual } from './shared/crypto'
import type { EmbedWidgetTokenClaims } from '../types'

/** Token lifetime, default value in seconds. */
export const EMBED_TOKEN_DEFAULT_TTL = 3600
/** Maximum token lifetime the mint endpoint may grant (seconds). */
export const EMBED_TOKEN_MAX_TTL = 86400

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Lowercase, strip a trailing slash, and reduce to a bare origin string. */
export function normaliseOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    // `new URL(...).origin` yields scheme://host[:port] with no trailing slash.
    return new URL(raw).origin.toLowerCase()
  } catch {
    return null
  }
}

/** Clamp a requested TTL into [1, EMBED_TOKEN_MAX_TTL], defaulting when unset. */
export function clampTtl(ttl: number | undefined): number {
  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) return EMBED_TOKEN_DEFAULT_TTL
  return Math.min(Math.floor(ttl), EMBED_TOKEN_MAX_TTL)
}

export interface MintTokenInput {
  wid: string
  sid: string
  code: string
  /**
   * Tenant key — the session-owner's user id (ADR-0050 §Amendment 1, PEN5-E2).
   * Intentionally the same value bound to `embed_widgets.team_id`; isolation is
   * enforced fail-safe on it at both planes, so claim and column never diverge.
   */
  tid: string
  /** Allowed origins (will be normalised; duplicates collapsed). */
  ao: string[]
  /** Lifetime in seconds; clamped to [1, EMBED_TOKEN_MAX_TTL]. */
  ttl?: number
  /** Override issued-at (epoch seconds) — test seam. */
  now?: number
}

/** Sign a widget token. Returns the compact `payload.mac` string and the exp claim. */
export async function signEmbedToken(
  secret: string,
  input: MintTokenInput,
): Promise<{ token: string; exp: number; claims: EmbedWidgetTokenClaims }> {
  const iat = input.now ?? Math.floor(Date.now() / 1000)
  const exp = iat + clampTtl(input.ttl)
  const ao = Array.from(
    new Set(input.ao.map((o) => normaliseOrigin(o)).filter((o): o is string => !!o)),
  )
  const claims: EmbedWidgetTokenClaims = {
    v: 1,
    wid: input.wid,
    sid: input.sid,
    code: input.code,
    tid: input.tid,
    ao,
    scp: 'read',
    iat,
    exp,
  }
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify(claims)))
  const mac = await hmacSign(secret, payload)
  return { token: `${payload}.${mac}`, exp, claims }
}

export type VerifyFailureReason =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'wrong_version'
  | 'wrong_scope'

export type VerifyResult =
  | { ok: true; claims: EmbedWidgetTokenClaims }
  | { ok: false; reason: VerifyFailureReason }

/**
 * Verify a widget token's signature, version, scope, and expiry. Does NOT check
 * origin — call `originAllowed` separately so the caller controls the 403 shape.
 */
export async function verifyEmbedToken(
  secret: string,
  token: string,
  opts: { now?: number } = {},
): Promise<VerifyResult> {
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'malformed' }
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' }
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  // Re-sign and timing-safe compare. A tampered payload or MAC fails here.
  const expectedMac = await hmacSign(secret, payload)
  if (!timingSafeEqual(mac, expectedMac)) return { ok: false, reason: 'bad_signature' }

  let claims: EmbedWidgetTokenClaims
  try {
    const json = textDecoder.decode(base64UrlDecode(payload))
    claims = JSON.parse(json) as EmbedWidgetTokenClaims
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (claims.v !== 1) return { ok: false, reason: 'wrong_version' }
  if (claims.scp !== 'read') return { ok: false, reason: 'wrong_scope' }
  if (!Array.isArray(claims.ao) || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
    return { ok: false, reason: 'malformed' }
  }
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  if (now >= claims.exp) return { ok: false, reason: 'expired' }

  return { ok: true, claims }
}

/**
 * True iff `origin` (after normalisation) is present in the token's `ao` allowlist.
 * A token is useless from any origin not in its allowlist — this is what makes a
 * stolen token non-replayable cross-origin (ADR-0050 §3a).
 */
export function originAllowed(claims: EmbedWidgetTokenClaims, origin: string | null | undefined): boolean {
  const o = normaliseOrigin(origin)
  if (!o) return false
  return claims.ao.includes(o)
}
