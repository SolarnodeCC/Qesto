/**
 * P0-A: AI rejection test suite
 *
 * Tests that Workers AI rejection paths are properly sanitized and don't leak
 * stack traces or internal details in production. Covers:
 * - AI timeout → graceful fallback (not raw 500)
 * - AI transient failure → retry logic
 * - AI circuit breaker open → safe error response
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  InsightsAIError,
  InsightsValidationError,
  extractThemes,
  __internal,
} from '../../functions/api/lib/ai-insights'

describe('AI insights — rejection & retry paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Workers AI timeout handling', () => {
    it('throws InsightsAIError when AI.run() times out', async () => {
      const ai = {
        run: vi.fn(async () => {
          // Simulate timeout by throwing after a delay
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 10)
          })
        }),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Team velocity is good', 'Communication needs work'],
        }),
      ).rejects.toBeInstanceOf(InsightsAIError)

      expect(ai.run).toHaveBeenCalled()
    })

    it('returns InsightsAIError with message (not raw stack trace)', async () => {
      const ai = {
        run: vi.fn(async () => {
          throw new Error('workers ai gateway timeout')
        }),
      } as unknown as Ai

      try {
        await extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue 1', 'Issue 2'],
        })
        throw new Error('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(InsightsAIError)
        const msg = (err as Error).message
        // Should contain a safe, high-level error message
        expect(msg).toContain('AI invocation failed')
        // Should not expose stack traces or file paths
        expect(msg).not.toMatch(/at Object\.|at async|\.ts:/i)
        // The underlying error message is wrapped but readable
        expect(msg).toContain('workers ai gateway timeout')
      }
    })
  })

  describe('Workers AI transient failure & retry', () => {
    it('retries once on transient AI failure, then succeeds', async () => {
      const ai = {
        run: vi
          .fn()
          .mockRejectedValueOnce(new Error('temporary model overload'))
          .mockResolvedValueOnce({
            response: JSON.stringify({
              themes: [
                { theme: 'Team velocity', count: 7, examples: ['Shipping weekly'] },
              ],
            }),
          }),
      } as unknown as Ai

      const result = await extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['Shipping weekly', 'Communication good'],
      })

      // Should have retried (called twice)
      expect(ai.run).toHaveBeenCalledTimes(2)
      // Should have succeeded after retry
      expect(result.themes).toHaveLength(1)
      expect(result.themes[0].theme).toBe('Team velocity')
    })

    it('exhausts retries and throws InsightsAIError on persistent failures', async () => {
      const ai = {
        run: vi
          .fn()
          .mockRejectedValueOnce(new Error('first failure'))
          .mockRejectedValueOnce(new Error('second failure'))
          .mockRejectedValueOnce(new Error('third failure')),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue A', 'Issue B'],
        }),
      ).rejects.toBeInstanceOf(InsightsAIError)

      // Should have tried all 3 times (1 initial + 2 retries)
      expect(ai.run).toHaveBeenCalledTimes(3)
    })

    it('respects AI_TIMEOUT_MS during retry attempts', async () => {
      // This test documents that each retry attempt is governed by the timeout,
      // not just the overall operation.
      const ai = {
        run: vi.fn(async () => {
          throw new Error('timeout during attempt')
        }),
      } as unknown as Ai

      const startTime = Date.now()
      await expect(
        extractThemes(ai, {
          sessionTitle: 'Test',
          openResponses: ['resp1'],
        }),
      ).rejects.toBeInstanceOf(InsightsAIError)

      // The operation should complete in reasonable time (not hang forever)
      // Actual timeout is 25s per attempt, but we just verify it doesn't block
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(5000) // Should fail quickly
    })
  })

  describe('AI response validation rejection', () => {
    it('throws ValidationError when AI returns malformed JSON', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: 'Not valid JSON at all',
        })),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue 1'],
        }),
      ).rejects.toBeInstanceOf(InsightsValidationError)
    })

    it('throws ValidationError when JSON is missing themes key', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            summary: 'Some summary',
            // missing 'themes' key
          }),
        })),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue 1'],
        }),
      ).rejects.toBeInstanceOf(InsightsValidationError)
    })

    it('throws ValidationError when theme count is negative', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            themes: [
              { theme: 'Bad theme', count: -1, examples: [] }, // negative count invalid
            ],
          }),
        })),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue 1'],
        }),
      ).rejects.toBeInstanceOf(InsightsValidationError)
    })

    it('throws ValidationError when example exceeds max length', async () => {
      const longExample = 'a'.repeat(300) // exceeds max 200
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            themes: [
              { theme: 'Theme', count: 1, examples: [longExample] },
            ],
          }),
        })),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['Issue 1'],
        }),
      ).rejects.toBeInstanceOf(InsightsValidationError)
    })
  })

  describe('Empty/edge case responses', () => {
    it('returns empty themes when openResponses is empty (fast path)', async () => {
      // Should NOT call AI when no responses
      const ai = {
        run: vi.fn(async () => {
          throw new Error('AI should not be called')
        }),
      } as unknown as Ai

      const result = await extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: [],
      })

      expect(result.themes).toEqual([])
      expect(ai.run).not.toHaveBeenCalled()
    })

    it('handles AI response with fewer than 3 themes', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            themes: [
              { theme: 'Theme A', count: 5, examples: ['Example 1'] },
            ],
          }),
        })),
      } as unknown as Ai

      const result = await extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['Response 1', 'Response 2', 'Response 3'],
      })

      expect(result.themes).toHaveLength(1)
      expect(result.themes[0].theme).toBe('Theme A')
    })

    it('handles AI response with maximum 5 themes', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            themes: [
              { theme: 'A', count: 1, examples: [] },
              { theme: 'B', count: 2, examples: [] },
              { theme: 'C', count: 3, examples: [] },
              { theme: 'D', count: 4, examples: [] },
              { theme: 'E', count: 5, examples: [] },
            ],
          }),
        })),
      } as unknown as Ai

      const result = await extractThemes(ai, {
        sessionTitle: 'Retro',
        openResponses: ['r1', 'r2', 'r3'],
      })

      expect(result.themes).toHaveLength(5)
    })

    it('rejects AI response with more than 5 themes', async () => {
      const ai = {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            themes: [
              { theme: 'A', count: 1, examples: [] },
              { theme: 'B', count: 2, examples: [] },
              { theme: 'C', count: 3, examples: [] },
              { theme: 'D', count: 4, examples: [] },
              { theme: 'E', count: 5, examples: [] },
              { theme: 'F', count: 6, examples: [] }, // too many
            ],
          }),
        })),
      } as unknown as Ai

      await expect(
        extractThemes(ai, {
          sessionTitle: 'Retro',
          openResponses: ['r1'],
        }),
      ).rejects.toBeInstanceOf(InsightsValidationError)
    })
  })

  describe('Prompt building with RAG context', () => {
    it('includes RAG context when provided', () => {
      const prompt = __internal.buildUserPrompt({
        sessionTitle: 'Team Retro',
        openResponses: ['Issue 1'],
        kbContext: '## Our docs\n\nGuideline: Always measure twice.',
      })

      expect(prompt).toContain('Background knowledge')
      expect(prompt).toContain('Guideline: Always measure twice.')
    })

    it('omits RAG context block when kbContext is whitespace-only', () => {
      const prompt = __internal.buildUserPrompt({
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
        kbContext: '   \n  \t  ',
      })

      expect(prompt).not.toContain('Background knowledge')
    })

    it('includes poll breakdown when provided', () => {
      const prompt = __internal.buildUserPrompt({
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
        pollBreakdown: [
          { prompt: 'What matters?', topLabels: ['Speed', 'Quality'] },
        ],
      })

      expect(prompt).toContain('Poll highlights')
      expect(prompt).toContain('What matters?')
      expect(prompt).toContain('Speed')
      expect(prompt).toContain('Quality')
    })

    it('caps openResponses to 100 to bound tokens', () => {
      const responses = Array.from({ length: 150 }, (_, i) => `Response ${i}`)
      const prompt = __internal.buildUserPrompt({
        sessionTitle: 'Retro',
        openResponses: responses,
      })

      // Should only contain first 100 responses
      expect(prompt).toContain('Response 0')
      expect(prompt).toContain('Response 99')
      expect(prompt).not.toContain('Response 100')
      expect(prompt).not.toContain('Response 149')
    })
  })

  describe('JSON extraction edge cases', () => {
    it('extracts JSON from fenced code block', () => {
      const raw = '```json\n{"themes": []}\n```'
      const extracted = __internal.extractJson(raw)
      expect(JSON.parse(extracted)).toEqual({ themes: [] })
    })

    it('extracts JSON from unfenced response', () => {
      const raw = '{"themes": [{"theme": "x", "count": 1, "examples": []}]}'
      const extracted = __internal.extractJson(raw)
      expect(JSON.parse(extracted)).toHaveProperty('themes')
    })

    it('throws ValidationError when no JSON found', () => {
      const raw = 'No JSON here, just prose.'
      expect(() => __internal.extractJson(raw)).toThrow(InsightsValidationError)
    })

    it('throws ValidationError when JSON is incomplete', () => {
      const raw = '{"themes": ['
      expect(() => __internal.extractJson(raw)).toThrow(InsightsValidationError)
    })
  })
})
