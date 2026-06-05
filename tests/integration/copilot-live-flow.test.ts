/**
 * COPILOT-10 — integration: vote context → suggestion → accept → add_question path.
 * DO is mocked; exercises lib + protocol validators end-to-end.
 */
import { describe, expect, it } from 'vitest'
import {
  buildLiveContext,
  parseSnapshotResponse,
} from '../../functions/api/lib/copilot-live-context'
import {
  fallbackSuggestions,
  parseSuggestions,
} from '../../functions/api/lib/copilot-suggest'
import { parseClientMessage } from '../../functions/api/lib/protocol-schemas'

describe('copilot live flow (COPILOT-10)', () => {
  it('parses DO snapshot → suggestions → add_question inject message', () => {
    const doBody = {
      ok: true,
      data: {
        status: 'live',
        currentQuestion: { id: 'q1', kind: 'poll', prompt: 'Next step?', optionCount: 3 },
        responseCount: 15,
        voterCount: 25,
        participationRate: 0.6,
        connections: 20,
        mood: { mood: 'positive' as const, sampleSize: 12 },
      },
    }
    const snapshot = parseSnapshotResponse(doBody)
    expect(snapshot).not.toBeNull()

    const context = buildLiveContext('sess-live', snapshot!)
    const aiRaw = JSON.stringify({
      suggestions: [
        {
          kind: 'poll_draft',
          title: 'Quick check-in',
          body: 'Gauge alignment with a single poll.',
          intent: 'quick alignment poll on next steps',
        },
      ],
    })
    const parsed = parseSuggestions(aiRaw) ?? fallbackSuggestions(context)
    expect(parsed.length).toBeGreaterThan(0)

    const pollDraft = parsed.find((s) => s.kind === 'poll_draft')
    expect(pollDraft?.intent).toBeTruthy()

    const inject = parseClientMessage(
      JSON.stringify({
        type: 'add_question',
        data: {
          question: {
            kind: 'poll',
            prompt: pollDraft?.intent ?? 'Follow-up poll',
            options: [{ label: 'Yes' }, { label: 'No' }],
          },
        },
        timestamp: Date.now(),
      }),
    )
    expect(inject?.type).toBe('add_question')
    if (inject?.type === 'add_question') {
      expect(inject.data.question.prompt).toContain('alignment')
    }
  })

  it('degrades gracefully when DO snapshot is invalid', () => {
    const snapshot = parseSnapshotResponse({ ok: false })
    expect(snapshot).toBeNull()
    const context = buildLiveContext('sess-live', {
      status: 'live',
      currentQuestion: { id: 'q1', kind: 'open', prompt: 'Thoughts?', optionCount: 0 },
      responseCount: 2,
      voterCount: 10,
      participationRate: 0.2,
      connections: 5,
      mood: null,
    })
    const suggestions = fallbackSuggestions(context)
    expect(suggestions.length).toBeGreaterThan(0)
  })
})
