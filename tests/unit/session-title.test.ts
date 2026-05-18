import { describe, expect, it } from 'vitest'
import { suggestDuplicateTitle } from '../../functions/api/lib/session-title'

describe('suggestDuplicateTitle', () => {
  it('returns "Copy of {title}" when no collision', () => {
    expect(suggestDuplicateTitle('Retro Q2', [])).toBe('Copy of Retro Q2')
  })

  it('appends (2) when base copy already exists', () => {
    expect(suggestDuplicateTitle('Retro Q2', ['Copy of Retro Q2'])).toBe('Copy of Retro Q2 (2)')
  })

  it('is case-insensitive for collisions', () => {
    expect(suggestDuplicateTitle('Retro', ['copy of retro'])).toBe('Copy of Retro (2)')
  })

  it('truncates to 120 characters', () => {
    const long = 'A'.repeat(130)
    const result = suggestDuplicateTitle(long, [])
    expect(result.length).toBeLessThanOrEqual(120)
    expect(result.startsWith('Copy of ')).toBe(true)
  })
})
