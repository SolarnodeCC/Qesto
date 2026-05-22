import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  aiOverride,
  aiPipeline,
  modelForPlan,
  DEFAULT_AI_MODEL,
  type SessionAIContext,
} from '../../functions/api/lib/ai/session-context'
import { CircuitBreakers } from '../../functions/api/lib/resilience/circuit-breaker'

describe('session-context (AI-CONTEXT-01)', () => {
  const baseCtx: SessionAIContext = {
    sessionId: 'sess_1',
    teamId: 'team_1',
    plan: 'team',
    anonymity: 'full',
    locale: 'en',
    model: DEFAULT_AI_MODEL,
    promptVersion: 'v1',
  }

  it('modelForPlan returns default Workers AI model', () => {
    expect(modelForPlan('free')).toBe(DEFAULT_AI_MODEL)
    expect(modelForPlan('team')).toBe(DEFAULT_AI_MODEL)
  })

  it('aiOverride merges overrides shallowly', () => {
    const next = aiOverride(baseCtx, { model: '@cf/meta/distilbert-sst-2-int8', locale: 'nl' })
    expect(next.model).toBe('@cf/meta/distilbert-sst-2-int8')
    expect(next.locale).toBe('nl')
    expect(next.sessionId).toBe('sess_1')
  })

  describe('aiPipeline', () => {
    beforeEach(() => {
      vi.spyOn(CircuitBreakers.ai, 'getStatus').mockReturnValue('closed')
    })

    it('returns ai_unavailable when circuit is open', async () => {
      vi.spyOn(CircuitBreakers.ai, 'execute').mockImplementation(async (_fn, onOpen) => onOpen())
      const result = await aiPipeline(baseCtx, { METRICS_AE: undefined }, async () => 'ok')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ai_unavailable')
    })

    it('returns data on successful run', async () => {
      vi.spyOn(CircuitBreakers.ai, 'execute').mockImplementation(async (fn) => fn(new AbortController().signal))
      const result = await aiPipeline(baseCtx, { METRICS_AE: undefined }, async () => ({ themes: [] }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual({ themes: [] })
        expect(result.model).toBe(DEFAULT_AI_MODEL)
      }
    })
  })
})
