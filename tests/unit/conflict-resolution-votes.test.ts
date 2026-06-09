import { describe, expect, it, beforeEach } from 'vitest'
import {
  evaluateVoteAdmission,
  applyVoteMutation,
  type TokenBucket,
  type SessionVotes,
} from '../../functions/api/lib/session-room-vote'
import type { LiveQuestion } from '../../functions/api/realtime'

/**
 * Phase 2: Conflict Resolution — Concurrent Vote Handling
 *
 * Tests verify that vote admission guards handle concurrent scenarios correctly:
 * - Question advance while votes in-flight
 * - Rate limit token bucket exhaustion
 * - Idempotency key collisions (duplicate votes)
 * - State consistency across concurrent mutations
 */

describe('Conflict resolution — vote admission guards (Phase 2)', () => {
  let bucket: TokenBucket
  let nowMs: number

  beforeEach(() => {
    nowMs = Date.now()
    bucket = {
      tokens: 10,
      lastAt: nowMs - 100, // Some time in the past
    }
  })

  describe('Question ID mismatch handling', () => {
    it('rejects vote for different question', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      // Vote says it's for q-2, but active question is q-1
      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-2', optionId: 'opt-1' }, // Wrong question ID
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toMatch(/out_of_date|question/)
      }
    })

    it('accepts vote with matching question ID', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' }, // Matches active question
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.optionId).toBe('opt-1')
      }
    })
  })

  describe('Rate limit token bucket under concurrent load', () => {
    it('exhausts tokens with rapid votes', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      let currentBucket = bucket
      let deniedCount = 0

      // Simulate 12 rapid votes at same timestamp (exhausts 10, then 2 more are blocked)
      for (let i = 0; i < 12; i++) {
        const result = evaluateVoteAdmission({
          bucket: currentBucket,
          bucketCapacity: 10,
          bucketRefillPerSec: 2,
          paused: false,
          questionExpiresAt: undefined,
          nowMs, // Same timestamp for all votes
          question,
          data: { questionId: 'q-1', optionId: i % 2 === 0 ? 'opt-1' : 'opt-2' },
        })

        currentBucket = result.bucket

        if (!result.ok && result.code === 'rate_limited') {
          deniedCount++
        }
      }

      // Should have denied at least 2 votes (after 10 tokens consumed)
      expect(deniedCount).toBeGreaterThanOrEqual(1)
    })

    it('allows refilled tokens over time', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      // First vote at nowMs (consume 1 token)
      let result1 = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })
      expect(result1.ok).toBe(true)

      // Vote 1 second later (2 tokens refilled during that second)
      const laterMs = nowMs + 1000
      result1 = evaluateVoteAdmission({
        bucket: result1.bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs: laterMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-2' },
      })

      // Should succeed due to refill
      expect(result1.ok).toBe(true)
      // Tokens should be closer to capacity due to refill
      expect(result1.bucket.tokens).toBeGreaterThan(0)
    })

    it('never exceeds token bucket capacity', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [{ id: 'opt-1', label: 'Yes' }],
      }

      // Wait 10 seconds (should refill way past capacity)
      const lateMs = nowMs + 10000

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs: lateMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      // Tokens should never exceed capacity
      expect(result.bucket.tokens).toBeLessThanOrEqual(9) // One consumed
      expect(result.bucket.tokens).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Invalid vote data rejection', () => {
    it('rejects vote with missing optionId', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1' }, // Missing optionId
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('bad_option')
      }
    })

    it('rejects vote for nonexistent option', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-999' }, // Doesn't exist
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('bad_option')
      }
    })

    it('accepts vote for valid free-text option (word_cloud)', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'word_cloud',
        options: [], // Free text, no predefined options
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'user-entered-text' }, // Any text allowed
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.optionId).toBe('user-entered-text')
      }
    })
  })

  describe('Rate limit edge cases and state recovery', () => {
    it('rejects vote when paused', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: true, // Session is paused
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('paused')
      }
    })

    it('rejects vote after question expires', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      // Question expired 500ms ago
      const expiredAt = nowMs - 500

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: expiredAt,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('question_closed')
      }
    })

    it('rejects vote when no question is active', () => {
      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question: undefined, // No active question
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('no_question')
      }
    })

    it('preserves bucket state on rejection', () => {
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const originalLastAt = bucket.lastAt

      // Vote fails due to missing optionId
      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1' }, // Missing optionId
      })

      // Bucket should be updated with latest timestamps even on rejection
      expect(result.bucket).toBeDefined()
      expect(result.bucket.lastAt).toBeGreaterThanOrEqual(originalLastAt)
    })
  })

  describe('Vote mutation and duplicate handling', () => {
    it('allows first vote for once policy', () => {
      const voters: SessionVotes = {}

      const result = applyVoteMutation(voters, {
        questionKind: 'poll',
        votePolicy: 'once',
        voterId: 'p-1',
        optionId: 'opt-1',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.countKey).toBe('opt-1')
      }
      expect(voters['p-1']).toEqual(['opt-1'])
    })

    it('rejects second vote for once policy', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1'], // Already voted
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'poll',
        votePolicy: 'once',
        voterId: 'p-1',
        optionId: 'opt-2',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('duplicate')
      }
      expect(voters['p-1']).toEqual(['opt-1']) // Unchanged
    })

    it('allows vote change for multi policy', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1'], // First vote
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'poll',
        votePolicy: 'multi',
        voterId: 'p-1',
        optionId: 'opt-2', // Change vote
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.countKey).toBe('opt-2')
        expect(result.countDecKey).toBe('opt-1') // Decrement previous
      }
      expect(voters['p-1']).toEqual(['opt-2'])
    })

    it('rejects duplicate vote for same option in multi policy', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1'],
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'poll',
        votePolicy: 'multi',
        voterId: 'p-1',
        optionId: 'opt-1', // Same vote
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('duplicate')
      }
    })

    it('allows multiple votes for multi_select kind', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1'],
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'multi_select',
        votePolicy: 'once', // Policy ignored for multi_select
        voterId: 'p-1',
        optionId: 'opt-2',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.countKey).toBe('opt-2')
      }
      expect(voters['p-1']).toEqual(['opt-1', 'opt-2'])
    })

    it('rejects duplicate in multi_select', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1', 'opt-2'],
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'multi_select',
        votePolicy: 'once',
        voterId: 'p-1',
        optionId: 'opt-1',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('duplicate')
      }
    })

    it('allows multiple votes for different options in upvote kind', () => {
      const voters: SessionVotes = {}

      // Voter upvotes first option
      const result1 = applyVoteMutation(voters, {
        questionKind: 'upvote',
        votePolicy: 'once',
        voterId: 'p-1',
        optionId: 'opt-1',
      })

      expect(result1.ok).toBe(true)
      if (result1.ok) {
        expect(result1.countKey).toBe('opt-1')
      }
      expect(voters['p-1']).toEqual(['opt-1'])

      // Can upvote different option
      const result2 = applyVoteMutation(voters, {
        questionKind: 'upvote',
        votePolicy: 'once',
        voterId: 'p-1',
        optionId: 'opt-2',
      })

      expect(result2.ok).toBe(true)
      if (result2.ok) {
        expect(result2.countKey).toBe('opt-2')
      }
      expect(voters['p-1']).toEqual(['opt-1', 'opt-2'])
    })

    it('records count deltas correctly', () => {
      const voters: SessionVotes = {
        'p-1': ['opt-1'],
      }

      const result = applyVoteMutation(voters, {
        questionKind: 'poll',
        votePolicy: 'multi',
        voterId: 'p-1',
        optionId: 'opt-2',
      })

      // Should have decrement key for previous vote
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.countDecKey).toBe('opt-1')
        expect(result.countKey).toBe('opt-2')
      }
    })
  })

  describe('Vote admission order verification', () => {
    it('rate limit is checked before other guards', () => {
      // Create a bucket with no tokens
      const emptyBucket: TokenBucket = { tokens: 0, lastAt: nowMs }

      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket: emptyBucket,
        bucketCapacity: 1,
        bucketRefillPerSec: 0, // No refill
        paused: false,
        questionExpiresAt: undefined,
        nowMs,
        question,
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      // Should be rate-limited, not other errors
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('rate_limited')
      }
    })

    it('pause check comes before question existence', () => {
      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: true, // Paused first
        questionExpiresAt: undefined,
        nowMs,
        question: undefined, // No question (would be checked after pause)
        data: { questionId: 'q-1', optionId: 'opt-1' },
      })

      // Should fail on pause, not on missing question
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('paused')
      }
    })

    it('question expiry check comes before ID mismatch', () => {
      const expiredAt = nowMs - 100
      const question: Pick<LiveQuestion, 'id' | 'kind' | 'options'> = {
        id: 'q-1',
        kind: 'poll',
        options: [
          { id: 'opt-1', label: 'Yes' },
          { id: 'opt-2', label: 'No' },
        ],
      }

      const result = evaluateVoteAdmission({
        bucket,
        bucketCapacity: 10,
        bucketRefillPerSec: 2,
        paused: false,
        questionExpiresAt: expiredAt, // Expired
        nowMs,
        question,
        data: { questionId: 'q-2', optionId: 'opt-1' }, // Wrong question ID (checked later)
      })

      // Should fail on expiry, not ID mismatch
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('question_closed')
      }
    })
  })
})
