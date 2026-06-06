import { describe, expect, it } from 'vitest'
import {
  buildSuggestMessages,
  parseSuggestions,
  heuristicSuggestions,
  detectDisengagement,
  CopilotActionSchema,
  COPILOT_ACTION_KINDS,
  MAX_SUGGESTIONS,
} from '../../functions/api/lib/copilot-suggest'
import type { CopilotLiveContext } from '../../functions/api/lib/copilot-live-context'

const liveCtx = (over: Partial<CopilotLiveContext> = {}): CopilotLiveContext => ({
  schemaVersion: 1,
  sessionId: 's1',
  isLive: true,
  currentQuestion: { id: 'q1', kind: 'open', prompt: 'How are we doing?', optionCount: 0 },
  responseCount: 8,
  participantCount: 20,
  participationRate: 0.4,
  mood: 'neutral',
  moodSampleSize: 8,
  generatedAt: 0,
  ...over,
})

describe('copilot-suggest', () => {
  describe('buildSuggestMessages', () => {
    it('grounds the prompt in the live snapshot, aggregate-only', () => {
      const messages = buildSuggestMessages(liveCtx({ mood: 'concerning', participationRate: 0.25 }))
      expect(messages[0].role).toBe('system')
      const user = messages[1].content
      expect(user).toContain('How are we doing?')
      expect(user).toContain('25%')
      expect(user).toContain('concerning')
      // No per-voter identifiers in the prompt.
      expect(user).not.toMatch(/voter-|voterId|email/i)
    })
  })

  describe('parseSuggestions', () => {
    it('parses a {suggestions:[...]} object and validates items', () => {
      const raw = JSON.stringify({
        suggestions: [
          { kind: 'followup_question', title: 'Ask why', body: 'Probe the reason behind the mood.' },
          { kind: 'pacing', title: 'Slow down', body: 'Give the room more time to respond.' },
        ],
      })
      const actions = parseSuggestions(raw)
      expect(actions).toHaveLength(2)
      expect(actions?.[0].kind).toBe('followup_question')
    })

    it('parses a bare array wrapped in markdown fences', () => {
      const raw = '```json\n' + JSON.stringify([
        { kind: 'disengagement_alert', title: 'Mood dip', body: 'Negativity is rising.' },
      ]) + '\n```'
      const actions = parseSuggestions(raw)
      expect(actions).toHaveLength(1)
      expect(actions?.[0].kind).toBe('disengagement_alert')
    })

    it('drops invalid items and synthesises a poll_draft intent from the title', () => {
      const raw = JSON.stringify({
        suggestions: [
          { kind: 'not_a_kind', title: 'x', body: 'y' },
          { kind: 'poll_draft', title: 'Poll the blockers', body: 'Run a quick poll.' },
        ],
      })
      const actions = parseSuggestions(raw)
      expect(actions).toHaveLength(1)
      expect(actions?.[0].kind).toBe('poll_draft')
      expect(actions?.[0].intent).toBe('Poll the blockers')
    })

    it('caps the number of suggestions', () => {
      const many = Array.from({ length: 10 }, (_, i) => ({ kind: 'pacing', title: `t${i}`, body: 'b' }))
      const actions = parseSuggestions(JSON.stringify({ suggestions: many }))
      expect(actions?.length).toBe(MAX_SUGGESTIONS)
    })

    it('returns null when no usable JSON is present', () => {
      expect(parseSuggestions('I cannot help with that.')).toBeNull()
      expect(parseSuggestions(JSON.stringify({ suggestions: [{ kind: 'bad' }] }))).toBeNull()
    })
  })

  describe('heuristicSuggestions', () => {
    it('emits a disengagement alert when mood is concerning', () => {
      const actions = heuristicSuggestions(liveCtx({ mood: 'concerning' }))
      expect(actions.some((a) => a.kind === 'disengagement_alert')).toBe(true)
      expect(actions.every((a) => CopilotActionSchema.safeParse(a).success)).toBe(true)
    })

    it('emits a pacing nudge on low participation', () => {
      const actions = heuristicSuggestions(liveCtx({ participationRate: 0.1, mood: 'positive' }))
      expect(actions.some((a) => a.kind === 'pacing')).toBe(true)
    })

    it('emits a followup and poll_draft (with intent) when a question is active', () => {
      const actions = heuristicSuggestions(liveCtx({ mood: 'positive', participationRate: 0.8 }))
      expect(actions.some((a) => a.kind === 'followup_question')).toBe(true)
      const draft = actions.find((a) => a.kind === 'poll_draft')
      expect(draft?.intent).toBeTruthy()
      expect(actions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
    })

    it('returns nothing actionable when no question is active and mood is fine', () => {
      const actions = heuristicSuggestions(liveCtx({ currentQuestion: null, mood: 'positive', participationRate: 0.8 }))
      expect(actions).toHaveLength(0)
    })
  })

  describe('detectDisengagement (COPILOT-04)', () => {
    it('flags concerning sentiment only at k≥5 responses', () => {
      expect(detectDisengagement(liveCtx({ mood: 'concerning', moodSampleSize: 4 }))).toBeNull()
      const alert = detectDisengagement(liveCtx({ mood: 'concerning', moodSampleSize: 5 }))
      expect(alert?.kind).toBe('disengagement_alert')
      expect(alert?.title).toContain('mood')
    })

    it('flags a participation drop-off when enough participants are connected', () => {
      const alert = detectDisengagement(
        liveCtx({ mood: 'positive', participantCount: 20, participationRate: 0.1 }),
      )
      expect(alert?.kind).toBe('disengagement_alert')
      expect(alert?.title).toContain('Participation')
    })

    it('falls back to participation signal for zero-knowledge sessions (no mood)', () => {
      const alert = detectDisengagement(
        liveCtx({ mood: null, moodSampleSize: 0, participantCount: 10, participationRate: 0.2 }),
      )
      expect(alert?.kind).toBe('disengagement_alert')
    })

    it('returns null for a healthy room', () => {
      expect(
        detectDisengagement(liveCtx({ mood: 'positive', participantCount: 20, participationRate: 0.7 })),
      ).toBeNull()
    })

    it('does not flag a low rate when too few participants are connected', () => {
      expect(
        detectDisengagement(liveCtx({ mood: 'neutral', participantCount: 3, participationRate: 0.1 })),
      ).toBeNull()
    })

    it('produces a schema-valid action', () => {
      const alert = detectDisengagement(liveCtx({ mood: 'concerning', moodSampleSize: 6 }))
      expect(alert && CopilotActionSchema.safeParse(alert).success).toBe(true)
    })
  })

  it('action kinds are stable', () => {
    expect(COPILOT_ACTION_KINDS).toEqual(['followup_question', 'poll_draft', 'disengagement_alert', 'pacing'])
  })
})
