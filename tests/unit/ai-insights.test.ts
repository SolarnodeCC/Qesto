import { describe, expect, it } from 'vitest'
import {
  InsightsAIError,
  InsightsValidationError,
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
    expect(result.themes).toEqual([])
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
})
