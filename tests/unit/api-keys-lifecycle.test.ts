import { describe, expect, it } from 'vitest'
import {
  generateApiKey,
  isApiKeyActive,
  apiKeyHasScope,
  type ApiKeyRecord,
} from '../../functions/api/lib/api-keys'

const baseRecord = (): ApiKeyRecord => ({
  id: 'k1',
  teamId: 't1',
  name: 'CI',
  scopes: ['read', 'write'],
  createdAt: Date.now(),
  createdBy: 'u1',
  prefix: 'qesto_abc',
})

describe('api key lifecycle', () => {
  it('marks revoked keys inactive', () => {
    expect(isApiKeyActive({ ...baseRecord(), revokedAt: Date.now() })).toBe(false)
  })

  it('marks expired keys inactive', () => {
    expect(isApiKeyActive({ ...baseRecord(), expiresAt: Date.now() - 1 })).toBe(false)
  })

  it('admin scope grants write', () => {
    expect(apiKeyHasScope({ ...baseRecord(), scopes: ['admin'] }, 'write')).toBe(true)
  })

  it('generates unique prefixes', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.raw).not.toBe(b.raw)
  })
})
