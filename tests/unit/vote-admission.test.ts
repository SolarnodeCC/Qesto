import { describe, expect, it } from 'vitest'
import { evaluateVoteAdmission, type TokenBucket } from '../../functions/api/lib/session-room-vote'

const FULL: TokenBucket = { tokens: 10, lastAt: Date.now() }
const pollQuestion = {
  id: 'q1',
  kind: 'poll' as const,
  options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
}

function base(overrides: Partial<Parameters<typeof evaluateVoteAdmission>[0]> = {}) {
  return evaluateVoteAdmission({
    bucket: FULL,
    bucketCapacity: 10,
    bucketRefillPerSec: 1,
    paused: false,
    questionExpiresAt: undefined,
    nowMs: Date.now(),
    question: pollQuestion,
    data: { questionId: 'q1', optionId: 'a' },
    ...overrides,
  })
}

describe('evaluateVoteAdmission', () => {
  it('admits a valid vote and returns the optionId', () => {
    const r = base()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.optionId).toBe('a')
  })

  it('rejects and closes when the token bucket is empty', () => {
    const r = base({ bucket: { tokens: 0, lastAt: Date.now() } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('rate_limited')
      expect(r.close).toBe(true)
    }
  })

  it('rejects when voting is paused', () => {
    const r = base({ paused: true })
    expect(r).toMatchObject({ ok: false, code: 'paused' })
  })

  it('rejects after the question timer has expired', () => {
    const r = base({ questionExpiresAt: 1000, nowMs: 2000 })
    expect(r).toMatchObject({ ok: false, code: 'question_closed' })
  })

  it('rejects when no question is active', () => {
    const r = base({ question: undefined })
    expect(r).toMatchObject({ ok: false, code: 'no_question' })
  })

  it('rejects a vote for a stale questionId', () => {
    const r = base({ data: { questionId: 'old', optionId: 'a' } })
    expect(r).toMatchObject({ ok: false, code: 'out_of_date' })
  })

  it('rejects a missing optionId', () => {
    const r = base({ data: { questionId: 'q1' } })
    expect(r).toMatchObject({ ok: false, code: 'bad_option', message: 'Missing optionId' })
  })

  it('rejects an unknown option for a non-free-text kind', () => {
    const r = base({ data: { questionId: 'q1', optionId: 'zzz' } })
    expect(r).toMatchObject({ ok: false, code: 'bad_option', message: 'Unknown option' })
  })

  it('accepts free text as the optionId for word_cloud', () => {
    const r = base({
      question: { id: 'q1', kind: 'word_cloud', options: [] },
      data: { questionId: 'q1', optionId: 'any phrase' },
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.optionId).toBe('any phrase')
  })

  it('evaluates guards in order: rate-limit before paused', () => {
    const r = base({ bucket: { tokens: 0, lastAt: Date.now() }, paused: true })
    expect(r).toMatchObject({ ok: false, code: 'rate_limited' })
  })

  // #581: free-text length defence-in-depth (independent of the WS schema bound).
  it('rejects an oversized free-text optionId for word_cloud', () => {
    const r = base({
      question: { id: 'q1', kind: 'word_cloud', options: [] },
      data: { questionId: 'q1', optionId: 'x'.repeat(281) },
    })
    expect(r).toMatchObject({ ok: false, code: 'bad_option', message: 'Answer too long' })
  })

  it('admits a free-text optionId exactly at the length cap', () => {
    const r = base({
      question: { id: 'q1', kind: 'word_cloud', options: [] },
      data: { questionId: 'q1', optionId: 'x'.repeat(280) },
    })
    expect(r.ok).toBe(true)
  })
})
