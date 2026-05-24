import { describe, expect, it } from 'vitest'
import { generateApiKey, hashApiKey } from '../../functions/api/lib/api-keys'

describe('api keys', () => {
  it('generates qesto-prefixed keys', () => {
    const { raw, prefix } = generateApiKey()
    expect(raw.startsWith('qesto_')).toBe(true)
    expect(prefix.length).toBeGreaterThan(8)
  })

  it('hashes deterministically', async () => {
    const a = await hashApiKey('qesto_test')
    const b = await hashApiKey('qesto_test')
    expect(a).toBe(b)
    expect(a.length).toBe(64)
  })
})
