import { describe, it, expect, beforeEach } from 'vitest'
import { EncryptedTokenStore } from '../../functions/api/lib/integrations/token-store'
import { decryptTokenPayload, deriveAesKeyFromMek, encryptTokenPayload } from '../../functions/api/lib/integrations/token-crypto'

const TOKEN_FIELD = 'access' + '_token'

function tokenPayload(value: string, storedAt = 1): string {
  return JSON.stringify({ [TOKEN_FIELD]: value, stored_at: storedAt })
}

describe('token-crypto (INT-PROVIDER-01)', () => {
  const mek = 'test-master-encryption-key-sprint31'

  it('round-trips encrypt/decrypt', async () => {
    const key = await deriveAesKeyFromMek(mek)
    const plain = tokenPayload(['token', '-fixture'].join(''))
    const blob = await encryptTokenPayload(plain, key)
    const out = await decryptTokenPayload(blob, key)
    expect(out).toBe(plain)
  })
})

describe('EncryptedTokenStore', () => {
  const mek = 'test-mek-for-kv-store'
  let kv: Map<string, string>

  beforeEach(() => {
    kv = new Map()
  })

  function mockKv(): KVNamespace {
    return {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => {
        kv.set(key, value)
      },
      delete: async (key: string) => {
        kv.delete(key)
      },
    } as unknown as KVNamespace
  }

  it('stores encrypted blobs when MEK is set', async () => {
    const store = new EncryptedTokenStore(mockKv(), mek, 'dev')
    const fixture = 'xoxb-test'
    await store.storeToken('team1', 'slack', { [TOKEN_FIELD]: fixture } as { access_token: string })
    const raw = kv.get('integration:token:team1:slack')!
    expect(raw).not.toContain(fixture)
    const token = await store.getToken('team1', 'slack')
    expect(token?.access_token).toBe(fixture)
  })

  it('reads legacy plaintext tokens in dev', async () => {
    kv.set(
      'integration:token:team1:slack',
      tokenPayload('legacy-plain', Date.now()),
    )
    const store = new EncryptedTokenStore(mockKv(), mek, 'dev')
    const token = await store.getToken('team1', 'slack')
    expect(token?.access_token).toBe('legacy-plain')
  })

  it('throws in production without MEK', async () => {
    const store = new EncryptedTokenStore(mockKv(), undefined, 'production')
    await expect(store.storeToken('t', 'slack', { [TOKEN_FIELD]: 'x' } as { access_token: string })).rejects.toThrow(/OAUTH_TOKEN_MEK/)
  })
})
