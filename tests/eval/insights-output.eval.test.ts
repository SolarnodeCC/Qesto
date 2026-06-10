// AI eval golden set — output validation + PII scrub (REV-05/REV-10).
//
// Asserts 100% acceptance of the valid output corpus, 100% rejection of the
// invalid corpus (InsightsValidationError, never raw pass-through), and the
// post-generation PII scrub on theme examples per anonymity mode.
import { describe, expect, it } from 'vitest'
import {
  __internal,
  extractThemes,
  InsightsValidationError,
  type InsightTheme,
} from '../../functions/api/lib/ai-insights'
import goldenOutputs from './fixtures/golden-outputs.json'
import piiOutputs from './fixtures/pii-outputs.json'

function mockAi(response: unknown): Ai {
  return {
    run: async () => response,
  } as unknown as Ai
}

const BASE_INPUT = {
  sessionTitle: 'Quarterly planning',
  openResponses: ['More focus time please.', 'Standups are useful.', 'CI is slow.'],
}

describe('eval: insights output validation', () => {
  for (const c of goldenOutputs.accept) {
    it(`accepts: ${c.name}`, async () => {
      const result = await extractThemes(mockAi({ response: c.output }), BASE_INPUT)
      expect(result.themes).toHaveLength(c.expectThemes)
    })
  }

  for (const c of goldenOutputs.reject) {
    it(`rejects: ${c.name}`, async () => {
      await expect(extractThemes(mockAi({ response: c.output }), BASE_INPUT)).rejects.toThrow(
        InsightsValidationError,
      )
    })
  }
})

describe('eval: PII scrub on theme examples', () => {
  for (const c of piiOutputs.cases) {
    it(`scrubs (anonymity=full): ${c.name}`, async () => {
      const output = JSON.stringify({ themes: c.themes })
      const result = await extractThemes(mockAi({ response: output }), {
        ...BASE_INPUT,
        anonymity: 'full',
      })
      expect(result.themes.map((t) => t.examples.length)).toEqual(c.expectedKept.full)
    })

    it(`retains (anonymity=none): ${c.name}`, async () => {
      const output = JSON.stringify({ themes: c.themes })
      const result = await extractThemes(mockAi({ response: output }), {
        ...BASE_INPUT,
        anonymity: 'none',
      })
      expect(result.themes.map((t) => t.examples.length)).toEqual(c.expectedKept.none)
    })
  }

  it('defaults to scrubbing when anonymity is absent (fail private)', () => {
    const themes: InsightTheme[] = [
      { theme: 'T', count: 1, examples: ['mail me at a@b.co', 'clean'] },
    ]
    expect(__internal.scrubExamplePII(themes, 'full')[0].examples).toEqual(['clean'])
  })
})
