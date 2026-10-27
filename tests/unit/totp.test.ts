/**
 * Requirement: issue #877 (DD-04) — TOTP must interoperate with standard
 * authenticator apps: RFC 4226 / RFC 6238 test vectors, ±1 step drift, and
 * the matched step returned for replay protection.
 */
import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, hotp, otpauthUri, verifyTotp } from '../../functions/api/lib/totp'

const RFC_SECRET = new TextEncoder().encode('12345678901234567890')
const RFC_SECRET_B32 = base32Encode(RFC_SECRET)

describe('TOTP (RFC 4226 / 6238)', () => {
  it('matches the RFC 4226 HOTP test vectors', async () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    for (let i = 0; i < expected.length; i++) expect(await hotp(RFC_SECRET, i)).toBe(expected[i])
  })

  it('matches the RFC 6238 SHA-1 vectors (8 digits)', async () => {
    expect(await hotp(RFC_SECRET, Math.floor(59 / 30), 8)).toBe('94287082')
    expect(await hotp(RFC_SECRET, Math.floor(1111111109 / 30), 8)).toBe('07081804')
    expect(await hotp(RFC_SECRET, Math.floor(20000000000 / 30), 8)).toBe('65353130')
  })

  it('round-trips base32', () => {
    expect(base32Decode(RFC_SECRET_B32)).toEqual(RFC_SECRET)
    expect(RFC_SECRET_B32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  it('accepts ±1 step and returns the matched step; rejects further drift and junk', async () => {
    const now = 1111111109 * 1000
    const step = Math.floor(1111111109 / 30)
    const code = await hotp(RFC_SECRET, step)
    expect(await verifyTotp(RFC_SECRET_B32, code, now)).toBe(step)
    expect(await verifyTotp(RFC_SECRET_B32, code, now + 30_000)).toBe(step)
    expect(await verifyTotp(RFC_SECRET_B32, code, now + 90_000)).toBeNull()
    expect(await verifyTotp(RFC_SECRET_B32, 'abcdef', now)).toBeNull()
    expect(await verifyTotp('not base32!', code, now)).toBeNull()
  })

  it('builds a Key Uri Format otpauth URI', () => {
    const uri = otpauthUri(RFC_SECRET_B32, 'a@b.test')
    expect(uri.startsWith('otpauth://totp/Qesto%3Aa%40b.test?')).toBe(true)
    expect(uri).toContain(`secret=${RFC_SECRET_B32}`)
    expect(uri).toContain('issuer=Qesto')
  })
})
