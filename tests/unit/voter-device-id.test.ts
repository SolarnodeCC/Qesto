/**
 * Requirement: PSM-007 voter dedupe + DD-03 salted identity — shared-NAT rooms (2026-11 go-live review).
 */
// Participants behind one public IP with identical devices must remain
// distinct voters when their browsers present different device ids, while the
// same device keeps a stable id and junk `fp` values are ignored.
import { describe, expect, it } from 'vitest'
import { deriveVoterIdentity, deviceIdFrom } from '../../functions/api/lib/voter'

const SALT = 'a'.repeat(64)
const HEADERS = {
  'cf-connecting-ip': '203.0.113.7',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  'accept-language': 'en-US',
  'accept-encoding': 'gzip',
}
const D1 = '3f1c6b2e-8a4d-4c1e-9b7a-0d2e5f6a7b8c'
const D2 = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b'

function req(fp?: string, ip = HEADERS['cf-connecting-ip']): Request {
  const url = `https://qesto.cc/api/sessions/s1/ws${fp !== undefined ? `?fp=${encodeURIComponent(fp)}` : ''}`
  return new Request(url, { headers: { ...HEADERS, 'cf-connecting-ip': ip } })
}

describe('device-aware voter identity', () => {
  it('keeps identical devices on one IP distinct when device ids differ', async () => {
    const a = await deriveVoterIdentity(req(D1), SALT)
    const b = await deriveVoterIdentity(req(D2), SALT)
    expect(a.voterId).not.toBe(b.voterId)
    // The per-IP bucket (connect cap / rate limit) is still shared.
    expect(a.ipHash).toBe(b.ipHash)
  })

  it('is stable for the same device', async () => {
    const a = await deriveVoterIdentity(req(D1), SALT)
    const b = await deriveVoterIdentity(req(D1.toUpperCase()), SALT)
    expect(a.voterId).toBe(b.voterId)
  })

  it('ignores a non-UUID fp (cannot smuggle data or bypass the bucket)', async () => {
    expect(deviceIdFrom(req('not-a-uuid'))).toBe('')
    const junk = await deriveVoterIdentity(req('anything'), SALT)
    const none = await deriveVoterIdentity(req(), SALT)
    expect(junk.voterId).toBe(none.voterId)
  })
})
