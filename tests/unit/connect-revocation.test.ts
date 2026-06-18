import { describe, expect, it } from 'vitest'
import { KVMock } from '../helpers/kv-mock'
import { revokeInvite, isInviteRevoked, revokedInviteKey } from '../../functions/api/lib/connect-revocation'

const kv = () => new KVMock() as unknown as KVNamespace

describe('CONNECT-AUDIT-01 — invite revocation', () => {
  it('namespaces the revocation key by jti', () => {
    expect(revokedInviteKey('abc')).toBe('connect:invite:revoked:abc')
  })

  it('reports not-revoked for an unknown jti', async () => {
    expect(await isInviteRevoked(kv(), 'never')).toBe(false)
  })

  it('marks an invite revoked and reads it back', async () => {
    const store = kv()
    await revokeInvite(store, { jti: 'inv-1', sessionId: 's1', revokedBy: 'u1', revokedAt: 123 })
    expect(await isInviteRevoked(store, 'inv-1')).toBe(true)
    expect(await isInviteRevoked(store, 'inv-2')).toBe(false)
  })

  it('is idempotent — re-revoking keeps it revoked', async () => {
    const store = kv()
    const entry = { jti: 'inv-1', sessionId: 's1', revokedBy: 'u1', revokedAt: 1 }
    await revokeInvite(store, entry)
    await revokeInvite(store, entry, 3600)
    expect(await isInviteRevoked(store, 'inv-1')).toBe(true)
  })
})
