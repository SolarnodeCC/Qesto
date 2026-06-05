/** Shared submit rate limiting for retro/ideate/townhall boards. */

export const BOARD_SUBMIT_BUCKET_CAPACITY = 3
export const BOARD_SUBMIT_BUCKET_REFILL_PER_SEC = 1 / 20

export type TokenBucket = { tokens: number; lastAt: number }

export function newSubmitBucket(now: number): TokenBucket {
  return { tokens: BOARD_SUBMIT_BUCKET_CAPACITY, lastAt: now }
}

export function consumeSubmitToken(bucket: TokenBucket, now: number): { ok: boolean; bucket: TokenBucket } {
  const elapsed = Math.max(0, (now - bucket.lastAt) / 1000)
  const refilled = Math.min(
    BOARD_SUBMIT_BUCKET_CAPACITY,
    bucket.tokens + elapsed * BOARD_SUBMIT_BUCKET_REFILL_PER_SEC,
  )
  if (refilled < 1) return { ok: false, bucket }
  return { ok: true, bucket: { tokens: refilled - 1, lastAt: now } }
}
