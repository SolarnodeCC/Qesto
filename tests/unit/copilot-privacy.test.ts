import { describe, expect, it } from 'vitest'
import {
  buildSuggestMessages,
  detectDisengagement,
  heuristicSuggestions,
} from '../../functions/api/lib/copilot-suggest'
import { buildLiveContext, emptyLiveContext } from '../../functions/api/lib/copilot-live-context'
import type { CopilotSnapshot } from '../../functions/api/lib/copilot-live-context'

describe('copilot-privacy (COPILOT-08)', () => {
  const zkSnapshot: CopilotSnapshot = {
    status: 'live',
    currentQuestion: { id: 'q1', kind: 'open', prompt: 'How is morale?', optionCount: 0 },
    responseCount: 12,
    voterCount: 20,
    participationRate: 0.2,
    connections: 18,
    mood: null,
  }

  it('buildSuggestMessages never includes voter identifiers or PII fields', () => {
    const ctx = buildLiveContext('sess-zk', zkSnapshot)
    const messages = buildSuggestMessages(ctx)
    const combined = messages.map((m) => m.content).join('\n')
    expect(combined).not.toMatch(/voter-|voterId|email|@/i)
    expect(combined).toContain('20%')
  })

  it('ZK disengagement fallback uses participation drop-off when mood is null', () => {
    const ctx = buildLiveContext('sess-zk', zkSnapshot)
    const alert = detectDisengagement(ctx)
    expect(alert?.kind).toBe('disengagement_alert')
    expect(alert?.title).toMatch(/participation/i)
  })

  it('heuristicSuggestions stay aggregate-only for zero-knowledge context', () => {
    const ctx = emptyLiveContext('sess-draft')
    const suggestions = heuristicSuggestions(ctx)
    for (const s of suggestions) {
      expect(s.body).not.toMatch(/voter-|email/i)
    }
  })

  it('does not alert on concerning mood below k-anonymity sample floor', () => {
    const snapshot: CopilotSnapshot = {
      ...zkSnapshot,
      participationRate: 0.5,
      mood: { mood: 'concerning', sampleSize: 3 },
    }
    const ctx = buildLiveContext('sess-1', snapshot)
    expect(detectDisengagement(ctx)).toBeNull()
  })
})
