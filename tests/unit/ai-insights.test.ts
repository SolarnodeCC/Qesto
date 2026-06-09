import { describe, expect, it } from 'vitest'
import {
  InsightsAIError,
  InsightsValidationError,
  __internal,
  extractThemes,
} from '../../functions/api/lib/ai-insights'

function mockAi(response: unknown): Ai {
  return {
    run: async () => response,
  } as unknown as Ai
}

describe('ai-insights/extractThemes', () => {
  it('parses a clean themes response', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        themes: [
          { theme: 'Team velocity', count: 7, examples: ['We ship weekly.'] },
          { theme: 'Communication', count: 4, examples: ['Standups help a lot.'] },
          { theme: 'Tooling', count: 3, examples: ['CI is slow.'] },
        ],
      }),
    })
    const result = await extractThemes(ai, {
      sessionTitle: 'Retro',
      openResponses: ['We ship weekly.', 'Standups help', 'CI is slow'],
    })
    expect(result.themes).toHaveLength(3)
    expect(result.themes[0].theme).toBe('Team velocity')
    expect(result.themes[0].count).toBe(7)
  })

  it('returns empty themes when there are no inputs at all', async () => {
    const ai = mockAi({ response: '{ "themes": [] }' }) // should not be called
    const result = await extractThemes(ai, {
      sessionTitle: 'Empty',
      openResponses: [],
    })
    expect(result.themes).toHaveLength(0)
  })

  it('throws InsightsValidationError when JSON absent', async () => {
    const ai = mockAi({ response: 'Sorry, I cannot.' })
    await expect(
      extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['a', 'b'],
      }),
    ).rejects.toBeInstanceOf(InsightsValidationError)
  })

  it('throws InsightsValidationError when schema fails', async () => {
    const ai = mockAi({
      response: JSON.stringify({ themes: [{ theme: 'x', count: -1, examples: [] }] }),
    })
    await expect(
      extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['a', 'b'],
      }),
    ).rejects.toBeInstanceOf(InsightsValidationError)
  })

  it('throws InsightsAIError when AI.run throws', async () => {
    const ai = {
      run: async () => {
        throw new Error('model down')
      },
    } as unknown as Ai
    await expect(
      extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['a', 'b'],
      }),
    ).rejects.toBeInstanceOf(InsightsAIError)
  })

  // ADR-040 Phase 3: RAG grounding pass-through.
  it('injects kbContext into the user prompt when provided', () => {
    const prompt = __internal.buildUserPrompt({
      sessionTitle: 'Retro',
      openResponses: ['Tooling is slow'],
      kbContext: '## Knowledge Base Context\n\n### Doc › Section\nGrounding body.',
    })
    expect(prompt).toContain('Background knowledge')
    expect(prompt).toContain('### Doc › Section')
    expect(prompt).toContain('Grounding body.')
    // Background block must appear before the responses so the model reads it first.
    const bgIdx = prompt.indexOf('Background knowledge')
    const responsesIdx = prompt.indexOf('Free-text responses')
    expect(bgIdx).toBeGreaterThanOrEqual(0)
    expect(bgIdx).toBeLessThan(responsesIdx)
  })

  it('omits the background block when kbContext is empty/whitespace', () => {
    const prompt = __internal.buildUserPrompt({
      sessionTitle: 'Retro',
      openResponses: ['x'],
      kbContext: '   ',
    })
    expect(prompt).not.toContain('Background knowledge')
  })

  it('omits the background block when kbContext is absent', () => {
    const prompt = __internal.buildUserPrompt({
      sessionTitle: 'Retro',
      openResponses: ['x'],
    })
    expect(prompt).not.toContain('Background knowledge')
  })

  it('retries transient AI failures before returning themes', async () => {
    let calls = 0
    const ai = {
      run: async () => {
        calls += 1
        if (calls === 1) {
          throw new Error('temporary model error')
        }
        return {
          response: JSON.stringify({
            themes: [
              { theme: 'Team velocity', count: 7, examples: ['We ship weekly.'] },
              { theme: 'Communication', count: 4, examples: ['Standups help a lot.'] },
              { theme: 'Tooling', count: 3, examples: ['CI is slow.'] },
            ],
          }),
        }
      },
    } as unknown as Ai

    const result = await extractThemes(ai, {
      sessionTitle: 'Retro',
      openResponses: ['We ship weekly.', 'Standups help', 'CI is slow'],
    })

    expect(result.themes[0].theme).toBe('Team velocity')
    expect(calls).toBe(2)
  })
})
