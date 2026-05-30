import { describe, expect, it } from 'vitest'
import { draftPollFromIntent, DRAFT_POLL_INTENT_MAX } from '../../functions/api/lib/copilot-draft-poll'
import { WizardValidationError } from '../../functions/api/lib/ai-wizard'

function mockAi(response: unknown): Ai {
  return { run: async () => response } as unknown as Ai
}

const QUESTIONS_JSON = JSON.stringify({
  questions: [
    { kind: 'poll', prompt: 'Which option fits our Q3 goal best?', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] },
    { kind: 'poll', prompt: 'What is the biggest risk right now?', options: [{ label: 'Time' }, { label: 'Scope' }, { label: 'Cost' }] },
    { kind: 'consent', prompt: 'Proceed with the proposal?', options: [{ label: 'Yes' }, { label: 'No' }] },
  ],
})

describe('copilot-draft-poll/draftPollFromIntent', () => {
  it('returns a primary draft plus alternatives from a one-line intent', async () => {
    const ai = mockAi({ response: QUESTIONS_JSON })

    const result = await draftPollFromIntent(ai, {
      sessionTitle: 'Q3 Planning',
      intent: 'gauge the team on our top priority',
    })

    expect(result.source).toBe('ai')
    expect(result.draft).not.toBeNull()
    expect(result.draft?.prompt).toBeTruthy()
    expect(result.draft?.id).toBeTruthy()
    expect(result.draft?.options[0]?.id).toBeTruthy()
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    // The drafted question must not duplicate the primary draft.
    expect(result.alternatives.some((q) => q.id === result.draft?.id)).toBe(false)
  })

  it('propagates WizardValidationError when the model returns no JSON (caller circuit-breaks)', async () => {
    const ai = mockAi({ response: 'Sorry, I cannot help with that.' })
    await expect(
      draftPollFromIntent(ai, { sessionTitle: 'X', intent: 'anything' }),
    ).rejects.toBeInstanceOf(WizardValidationError)
  })

  it('forwards intent as the generator goal and the session title for grounding', async () => {
    let captured: { messages?: Array<{ content: string }> } | undefined
    const ai = {
      run: async (_model: string, opts: { messages?: Array<{ content: string }> }) => {
        captured = opts
        return { response: QUESTIONS_JSON }
      },
    } as unknown as Ai

    await draftPollFromIntent(ai, { sessionTitle: 'Sprint Retro', intent: 'find our top blocker' })

    const joined = (captured?.messages ?? []).map((m) => m.content).join('\n')
    expect(joined).toContain('Sprint Retro')
    expect(joined).toContain('find our top blocker')
  })

  it('exposes a sane intent length cap', () => {
    expect(DRAFT_POLL_INTENT_MAX).toBeGreaterThan(0)
    expect(DRAFT_POLL_INTENT_MAX).toBeLessThanOrEqual(500)
  })
})
