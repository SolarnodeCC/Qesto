import { describe, expect, it } from 'vitest'
import {
  BOARD_SUBMIT_BUCKET_CAPACITY,
  newSubmitBucket,
  consumeSubmitToken,
} from '../../functions/api/lib/board-submit-rate'

// Shared submit bucket for retro/ideate/townhall/deliberate boards.
// Moved here from session-room-townhall.test.ts when the townhall copy was
// deduplicated onto this module.
describe('submit token bucket', () => {
  it('starts full and drains by one per submit', () => {
    let b = newSubmitBucket(0)
    expect(b.tokens).toBe(BOARD_SUBMIT_BUCKET_CAPACITY)
    for (let i = 0; i < BOARD_SUBMIT_BUCKET_CAPACITY; i++) {
      const r = consumeSubmitToken(b, 0)
      expect(r.ok).toBe(true)
      b = r.bucket
    }
  })

  it('rejects the 4th rapid submit', () => {
    let b = newSubmitBucket(0)
    for (let i = 0; i < 3; i++) b = consumeSubmitToken(b, 0).bucket
    const r = consumeSubmitToken(b, 0)
    expect(r.ok).toBe(false)
    expect(r.bucket).toBe(b) // unchanged on failure so accrual continues
  })

  it('refills ~1 token per 20s', () => {
    let b = newSubmitBucket(0)
    for (let i = 0; i < 3; i++) b = consumeSubmitToken(b, 0).bucket
    expect(consumeSubmitToken(b, 19_000).ok).toBe(false)
    expect(consumeSubmitToken(b, 20_000).ok).toBe(true)
  })
})
