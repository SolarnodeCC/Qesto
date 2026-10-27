/**
 * Requirement: issue #907 (DD-35) — CMK is not implemented, so nothing may
 * report an encryption algorithm for it. Legacy envelope rows that carried
 * `algorithm: 'AES-256-GCM'` must decode without echoing that claim.
 */
import { describe, expect, it } from 'vitest'
import { CMK_IMPLEMENTATION_STATUS, parseCmkIntent } from '../../functions/api/lib/cmk'

describe('CMK intent (DD-35)', () => {
  it('reports not_implemented', () => {
    expect(CMK_IMPLEMENTATION_STATUS).toBe('not_implemented')
  })

  it('drops the algorithm claim from legacy envelope rows', () => {
    const legacy = JSON.stringify({
      teamId: 't1',
      keyId: 'k1',
      algorithm: 'AES-256-GCM',
      rotatedAt: 123,
      status: 'active',
    })
    const intent = parseCmkIntent(legacy)
    expect(intent).toEqual({ teamId: 't1', keyId: 'k1', requestedAt: 123 })
    expect(JSON.stringify(intent)).not.toContain('AES')
  })

  it('returns null for missing or malformed rows', () => {
    expect(parseCmkIntent(null)).toBeNull()
    expect(parseCmkIntent('{')).toBeNull()
    expect(parseCmkIntent('{"teamId":1}')).toBeNull()
  })
})
