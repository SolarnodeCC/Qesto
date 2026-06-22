import { describe, expect, it } from 'vitest'
import { deriveVoterIdentity } from '../../functions/api/lib/voter'

// #583 — vote dedupe must NOT be bypassable via the client-controlled
// x-qesto-fingerprint header. The dedupe identity is anchored on the
// server-trusted cf-connecting-ip.

function req(headers: Record<string, string>): Request {
  return new Request('https://qesto.app/join', { headers })
}

describe('deriveVoterIdentity (#583)', () => {
  it('does not change voterId when x-qesto-fingerprint changes', async () => {
    const base = {
      'cf-connecting-ip': '203.0.113.7',
      'user-agent': 'Mozilla/5.0',
      'accept-language': 'en-US',
      'accept-encoding': 'gzip',
    }
    const a = await deriveVoterIdentity(req({ ...base, 'x-qesto-fingerprint': 'aaaa' }))
    const b = await deriveVoterIdentity(req({ ...base, 'x-qesto-fingerprint': 'zzzz-different' }))
    const c = await deriveVoterIdentity(req(base)) // header absent entirely

    expect(a.voterId).toBe(b.voterId)
    expect(a.voterId).toBe(c.voterId)
  })

  it('still distinguishes voters by server-trusted IP', async () => {
    const ua = { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US' }
    const a = await deriveVoterIdentity(req({ ...ua, 'cf-connecting-ip': '203.0.113.7' }))
    const b = await deriveVoterIdentity(req({ ...ua, 'cf-connecting-ip': '198.51.100.4' }))

    expect(a.voterId).not.toBe(b.voterId)
    expect(a.ipHash).not.toBe(b.ipHash)
  })
})
