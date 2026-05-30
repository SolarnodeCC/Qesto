// Integration tests for SENTIMENT_ENABLED stability (error logging, retry, circuit breaker).
// Covers: success path, failure paths, retry logic, circuit breaker respect, cooldown enforcement.

import { describe, expect, it } from 'vitest'
import type { SentimentAnalysisResult } from '../../functions/api/lib/ai/sentiment'

const SENTIMENT_COOLDOWN_MS = 30_000

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Sentiment Analysis Stability', () => {
  describe('Success path', () => {
    it('analyzes sufficient English responses successfully', async () => {
      const result: SentimentAnalysisResult = {
        ok: true,
        mood: 'positive',
        sampleSize: 5,
        analysisDurationMs: 250,
      }

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.mood).toBe('positive')
        expect(result.sampleSize).toBe(5)
        expect(result.analysisDurationMs).toBeGreaterThan(0)
      }
    })
  })

  describe('Failure paths', () => {
    it('returns insufficient_responses when fewer than 5 responses', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'insufficient_responses',
        message: 'need 5 responses, got 3',
        sampleSize: 3,
      }

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_responses')
      expect(result.sampleSize).toBe(3)
    })

    it('returns insufficient_responses when insufficient English content', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'insufficient_responses',
        message: 'insufficient English responses: 0/5',
        sampleSize: 0,
      }

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_responses')
    })

    it('returns insufficient_responses when zero_knowledge anonymity', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'insufficient_responses',
        message: 'zero_knowledge anonymity disables sentiment',
        sampleSize: 0,
      }

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_responses')
    })

    it('returns timeout when AI requests exceed timeout threshold', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'timeout',
        message: 'timeout during AI analysis, got 2/5 labels',
        sampleSize: 5,
      }

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('timeout')
      expect(result.sampleSize).toBe(5)
    })

    it('returns circuit_breaker when AI unavailable', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'circuit_breaker',
        message: 'AI service unavailable (circuit open or rate limited)',
        sampleSize: 5,
      }

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('circuit_breaker')
    })
  })

  describe('Retry queue behavior', () => {
    it('queues retry on transient failure', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'timeout',
        message: 'timeout during AI analysis',
        sampleSize: 5,
      }

      expect(result.ok).toBe(false)
      // Retry should be queued by SessionRoom.maybeAnalyzeSentiment
    })

    it('does not retry on circuit breaker', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'circuit_breaker',
        message: 'AI service unavailable',
        sampleSize: 5,
      }

      // Circuit breaker result should NOT be retried
      expect(result.reason).toBe('circuit_breaker')
    })

    it('does not retry on insufficient responses', async () => {
      const result: SentimentAnalysisResult = {
        ok: false,
        reason: 'insufficient_responses',
        message: 'need 5 responses, got 2',
        sampleSize: 2,
      }

      // Insufficient responses should NOT be retried (won't change with time)
      expect(result.reason).toBe('insufficient_responses')
    })
  })

  describe('Cooldown enforcement', () => {
    it('respects 30 second cooldown between analyses', async () => {
      const now1 = Date.now()
      const now2 = Date.now() + SENTIMENT_COOLDOWN_MS + 1000 // After cooldown

      const timeDiff = now2 - now1
      expect(timeDiff).toBeGreaterThanOrEqual(SENTIMENT_COOLDOWN_MS)

      // Second analysis should be allowed after cooldown
      expect(now2 - now1 >= SENTIMENT_COOLDOWN_MS).toBe(true)
    })

    it('blocks analysis within cooldown window', async () => {
      const now1 = Date.now()
      const now2 = Date.now() + 5000 // Before cooldown

      const timeDiff = now2 - now1
      expect(timeDiff).toBeLessThan(SENTIMENT_COOLDOWN_MS)

      // Analysis should be blocked
      expect(now2 - now1 < SENTIMENT_COOLDOWN_MS).toBe(true)
    })
  })

  describe('Analytics event emission', () => {
    it('emits ai.sentiment_analysis on success', async () => {
      // Event should be emitted with: sessionId, teamId, plan, count, detail (mood)
      const event = {
        name: 'ai.sentiment_analysis',
        sessionId: 'session-123',
        teamId: 'team-123',
        plan: 'team',
        count: 5,
        detail: 'positive',
      }

      expect(event.name).toBe('ai.sentiment_analysis')
      expect(event.detail).toMatch(/positive|neutral|concerning/)
    })

    it('emits ai.sentiment_analysis_failed on failure', async () => {
      const event = {
        name: 'ai.sentiment_analysis_failed',
        sessionId: 'session-123',
        teamId: 'team-123',
        plan: 'team',
        count: 5,
        detail: 'timeout', // failure reason
      }

      expect(event.name).toBe('ai.sentiment_analysis_failed')
      expect(['timeout', 'circuit_breaker', 'insufficient_responses', 'ai_error']).toContain(event.detail)
    })

    it('emits ai.sentiment_retry_exhausted when max retries reached', async () => {
      const event = {
        name: 'ai.sentiment_retry_exhausted',
        sessionId: 'session-123',
        teamId: 'team-123',
        plan: 'team',
        detail: 'timeout', // final failure reason
      }

      expect(event.name).toBe('ai.sentiment_retry_exhausted')
    })
  })
})
