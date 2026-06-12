// EMBED-WIDGET-API-01 (ADR-0050) — widget token sign/verify + origin pinning.
//
// The token is the credential safe to ship to a third-party page: HMAC-SHA-256,
// read-scoped, origin-bound, short-lived, no PII. These tests pin the security
// properties: round-trip, tamper rejection, expiry, version/scope guards, and
// the origin allowlist that makes a stolen token non-replayable cross-origin.

import { describe, expect, it } from 'vitest'
import {
  signEmbedToken,
  verifyEmbedToken,
  originAllowed,
  normaliseOrigin,
  clampTtl,
  EMBED_TOKEN_DEFAULT_TTL,
  EMBED_TOKEN_MAX_TTL,
} from '../../functions/api/lib/embed-token'

const SECRET = 'embed-widget-secret-at-least-32-bytes!!'

const baseInput = {
  wid: 'widget_1',
  sid: 'sess_1',
  code: 'ABC123',
  tid: 'team_1',
  ao: ['https://customer.example.com'],
}

describe('signEmbedToken → verifyEmbedToken round-trip', () => {
  it('signs a read-scoped v1 token and verifies it back to the same claims', async () => {
    const { token, exp, claims } = await signEmbedToken(SECRET, baseInput)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(claims.scp).toBe('read')
    expect(claims.v).toBe(1)
    expect(claims.exp).toBe(exp)

    const res = await verifyEmbedToken(SECRET, token)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.claims.wid).toBe('widget_1')
      expect(res.claims.sid).toBe('sess_1')
      expect(res.claims.code).toBe('ABC123')
      expect(res.claims.tid).toBe('team_1')
      expect(res.claims.ao).toEqual(['https://customer.example.com'])
    }
  })

  it('normalises and de-dupes origins into the ao claim', async () => {
    const { claims } = await signEmbedToken(SECRET, {
      ...baseInput,
      ao: ['https://Customer.Example.com/', 'https://customer.example.com', 'not a url'],
    })
    expect(claims.ao).toEqual(['https://customer.example.com'])
  })
})

describe('tamper / signature rejection', () => {
  it('rejects a token whose payload was mutated (bad signature)', async () => {
    const { token } = await signEmbedToken(SECRET, baseInput)
    const [payload, mac] = token.split('.')
    // Flip one payload char → MAC no longer matches.
    const mutated = `${payload.slice(0, -1)}${payload.slice(-1) === 'A' ? 'B' : 'A'}.${mac}`
    const res = await verifyEmbedToken(SECRET, mutated)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('bad_signature')
  })

  it('rejects a token signed with a different secret', async () => {
    const { token } = await signEmbedToken(SECRET, baseInput)
    const res = await verifyEmbedToken('a-totally-different-secret-32-bytes!!!', token)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('bad_signature')
  })

  it('rejects a malformed token (no dot separator)', async () => {
    const res = await verifyEmbedToken(SECRET, 'not-a-valid-token')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('malformed')
  })
})

describe('expiry', () => {
  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 10_000
    const { token } = await signEmbedToken(SECRET, { ...baseInput, ttl: 3600, now: past })
    const res = await verifyEmbedToken(SECRET, token)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('expired')
  })

  it('accepts a not-yet-expired token at a controlled clock', async () => {
    const iat = 1_000_000
    const { token } = await signEmbedToken(SECRET, { ...baseInput, ttl: 3600, now: iat })
    const res = await verifyEmbedToken(SECRET, token, { now: iat + 1800 })
    expect(res.ok).toBe(true)
  })
})

describe('TTL clamping (default 3600, max 86400)', () => {
  it('defaults when unset or invalid', () => {
    expect(clampTtl(undefined)).toBe(EMBED_TOKEN_DEFAULT_TTL)
    expect(clampTtl(0)).toBe(EMBED_TOKEN_DEFAULT_TTL)
    expect(clampTtl(-5)).toBe(EMBED_TOKEN_DEFAULT_TTL)
  })
  it('caps at the maximum', () => {
    expect(clampTtl(999_999)).toBe(EMBED_TOKEN_MAX_TTL)
    expect(clampTtl(7200)).toBe(7200)
  })
})

describe('origin pinning (originAllowed)', () => {
  it('allows an origin present in the allowlist (case/slash-insensitive)', async () => {
    const { claims } = await signEmbedToken(SECRET, baseInput)
    expect(originAllowed(claims, 'https://customer.example.com')).toBe(true)
    expect(originAllowed(claims, 'https://CUSTOMER.example.com/')).toBe(true)
  })

  it('rejects an origin NOT in the allowlist (stolen-token non-replay)', async () => {
    const { claims } = await signEmbedToken(SECRET, baseInput)
    expect(originAllowed(claims, 'https://attacker.example.com')).toBe(false)
    expect(originAllowed(claims, null)).toBe(false)
    expect(originAllowed(claims, undefined)).toBe(false)
  })
})

describe('normaliseOrigin', () => {
  it('lowercases host and strips trailing slash / path', () => {
    expect(normaliseOrigin('https://Foo.Example.com/path?x=1')).toBe('https://foo.example.com')
    expect(normaliseOrigin('garbage')).toBeNull()
    expect(normaliseOrigin(null)).toBeNull()
  })
})
