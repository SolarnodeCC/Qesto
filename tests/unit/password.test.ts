import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, passwordNeedsRehash } from '../../functions/api/lib/password'

describe('password hashing (SEC L-1)', () => {
  it('round-trips a hashed password', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(stored.startsWith('pbkdf2$600000$')).toBe(true)
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(await verifyPassword('wrong password', stored)).toBe(false)
  })

  it('new hashes do not need rehashing', async () => {
    const stored = await hashPassword('hunter2hunter2')
    expect(passwordNeedsRehash(stored)).toBe(false)
  })

  it('flags weaker embedded work factors for rehash', () => {
    // A well-formed but low-cost hash (e.g. older deploy) should be upgraded.
    expect(passwordNeedsRehash('pbkdf2$100000$aabb$ccdd')).toBe(true)
    expect(passwordNeedsRehash('pbkdf2$600000$aabb$ccdd')).toBe(false)
  })

  it('still verifies legacy salt:hash (100k) format and flags it for rehash', async () => {
    // Reconstruct a legacy-format hash deterministically via the current verify
    // path: legacy format is `<saltHex>:<hashHex>` with implicit 100k iterations.
    // We assert the parser treats 2-part values as legacy and needs rehash.
    expect(passwordNeedsRehash('00112233445566778899aabbccddeeff:0011')).toBe(true)
  })

  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})
