import { describe, expect, it } from 'vitest'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../functions/api/lib/tokens'

describe('magic-link tokens', () => {
  it('generates 64-char hex tokens', () => {
    for (let i = 0; i < 5; i++) {
      const t = generateMagicLinkToken()
      expect(t).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('generates unique tokens per call', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(generateMagicLinkToken())
    expect(seen.size).toBe(50)
  })

  it('hashes deterministically', async () => {
    const a = await hashMagicLinkToken('some-raw-token')
    const b = await hashMagicLinkToken('some-raw-token')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes distinct inputs distinctly', async () => {
    const a = await hashMagicLinkToken('a')
    const b = await hashMagicLinkToken('b')
    expect(a).not.toBe(b)
  })
})
