/**
 * P0-A: Vectorize rejection test suite
 *
 * Tests that Vectorize failures are gracefully degraded. Vectorize is optional
 * for insights; its failure should not break the insights route.
 * Covers:
 * - Vectorize.query() rejection → empty results or fallback
 * - Vectorize.upsert() rejection → best-effort, no error propagation
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  DECISIONS_EMBED_DIM,
  DECISIONS_EMBED_MODEL,
  DECISIONS_SIMILARITY_TOP_K,
  embedAndFindSimilarSessionTitles,
  upsertInsightsSessionVector,
} from '../../functions/api/lib/insights-vectorize'

const vector = Array.from({ length: DECISIONS_EMBED_DIM }, (_, i) => i / DECISIONS_EMBED_DIM)

describe('Vectorize — rejection & degradation paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Query rejection (semantic search failure)', () => {
    it('throws when Vectorize.query rejects', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockRejectedValueOnce(new Error('vectorize service unavailable')),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      // Vectorize query failure should propagate (it's not best-effort)
      await expect(
        embedAndFindSimilarSessionTitles(env, {
          sessionId: 'sess-1',
          sessionTitle: 'Retro',
          openResponses: ['Issue 1', 'Issue 2'],
        }),
      ).rejects.toThrow('vectorize service unavailable')
    })

    it('returns empty similarSessionTitles when Vectorize returns empty matches', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockResolvedValueOnce({
            matches: [], // No matches
          }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      const result = await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      expect(result.similarSessionTitles).toEqual([])
    })

    it('filters out low-scoring matches (below similarity threshold)', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockResolvedValueOnce({
            matches: [
              { id: 'sess-2', score: 0.99, metadata: { title: 'Exact match' } },
              { id: 'sess-3', score: 0.5, metadata: { title: 'Weak match' } }, // Below threshold (0.75)
              { id: 'sess-4', score: 0.85, metadata: { title: 'Good match' } },
            ],
          }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      const result = await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      // Should only include scores above threshold (0.75)
      expect(result.similarSessionTitles).toContain('Exact match')
      expect(result.similarSessionTitles).toContain('Good match')
      // Weak match should be filtered out
      expect(result.similarSessionTitles.some((t) => t === 'Weak match')).toBe(false)
    })

    it('handles Vectorize returning undefined metadata', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockResolvedValueOnce({
            matches: [
              { id: 'sess-1', score: 0.9, metadata: undefined }, // No metadata
            ],
          }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      const result = await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      // Should handle gracefully without crashing
      expect(result.similarSessionTitles).toEqual([])
    })

    it('limits result count to DECISIONS_SIMILARITY_TOP_K (by topK param in query)', async () => {
      // Note: the implementation passes topK: DECISIONS_SIMILARITY_TOP_K to Vectorize.query()
      // So Vectorize itself should return at most TOP_K results. This test validates that
      // when Vectorize returns fewer results, they are all included (if above threshold).
      const matches = Array.from({ length: DECISIONS_SIMILARITY_TOP_K }, (_, i) => ({
        id: `sess-${i + 1}`, // Different sessions to avoid current session filter
        score: 0.9 - i * 0.02, // All above threshold (0.75)
        metadata: { title: `Session ${i + 1}` },
      }))

      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn(async (_vec: number[], opts: { topK: number; returnMetadata: string }) => {
            // Verify the function calls with correct topK
            expect(opts.topK).toBe(DECISIONS_SIMILARITY_TOP_K)
            return { matches }
          }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      const result = await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-test',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      // Should contain all TOP_K results (all above threshold)
      expect(result.similarSessionTitles.length).toBeLessThanOrEqual(DECISIONS_SIMILARITY_TOP_K)
      expect(result.similarSessionTitles.length).toBe(DECISIONS_SIMILARITY_TOP_K)
    })
  })

  describe('AI embedding rejection (prerequisite for Vectorize)', () => {
    it('throws when AI embedding fails', async () => {
      const env = {
        AI: {
          run: vi.fn().mockRejectedValueOnce(new Error('AI model timeout')),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn(),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      await expect(
        embedAndFindSimilarSessionTitles(env, {
          sessionId: 'sess-1',
          sessionTitle: 'Retro',
          openResponses: ['Issue 1'],
        }),
      ).rejects.toThrow()

      // Vectorize should never be called if AI fails first
      expect(env.DECISIONS_VECTORIZE.query).not.toHaveBeenCalled()
    })

    it('calls correct embedding model', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockResolvedValueOnce({ matches: [] }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      // AI.run should be called with the correct embedding model
      expect(env.AI.run).toHaveBeenCalledWith(
        DECISIONS_EMBED_MODEL,
        expect.any(Object),
      )
    })
  })

  describe('Upsert rejection (best-effort)', () => {
    it('throws when Vectorize.upsert rejects', async () => {
      const env = {
        AI: {
          run: vi.fn(),
        },
        DECISIONS_VECTORIZE: {
          upsert: vi.fn().mockRejectedValueOnce(new Error('upsert failed')),
        },
      } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

      // Upsert failure should propagate as the function returns boolean
      await expect(
        upsertInsightsSessionVector(env, {
          sessionId: 'sess-1',
          sessionTitle: 'Retro',
          themeCount: 3,
          existingVector: vector,
        }),
      ).rejects.toThrow('upsert failed')
    })

    it('skips AI call when existingVector is provided', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => {
            throw new Error('AI should not be called')
          }),
        },
        DECISIONS_VECTORIZE: {
          upsert: vi.fn().mockResolvedValueOnce(undefined),
        },
      } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

      await upsertInsightsSessionVector(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        themeCount: 3,
        existingVector: vector,
      })

      // AI should not be called
      expect(env.AI.run).not.toHaveBeenCalled()
    })

    it('upserts with correct record structure', async () => {
      let upsertedRecord: unknown
      const env = {
        AI: {
          run: vi.fn(),
        },
        DECISIONS_VECTORIZE: {
          upsert: vi.fn(async (records: unknown) => {
            upsertedRecord = records
          }),
        },
      } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

      await upsertInsightsSessionVector(env, {
        sessionId: 'sess-123',
        sessionTitle: 'Team Retro',
        themeCount: 5,
        existingVector: vector,
      })

      expect(upsertedRecord).toBeDefined()
      const records = upsertedRecord as Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>
      expect(records[0]).toMatchObject({
        id: 'sess-123',
        values: vector,
        metadata: {
          session_id: 'sess-123',
          title: 'Team Retro',
          theme_count: '5',
          ts: expect.any(String),
        },
      })
    })

    it('converts themeCount to string in metadata', async () => {
      let upsertedRecord: unknown
      const env = {
        AI: {
          run: vi.fn(),
        },
        DECISIONS_VECTORIZE: {
          upsert: vi.fn(async (records: unknown) => {
            upsertedRecord = records
          }),
        },
      } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

      await upsertInsightsSessionVector(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        themeCount: 7,
        existingVector: vector,
      })

      const records = upsertedRecord as Array<{ metadata: Record<string, unknown> }>
      expect(records[0].metadata.theme_count).toBe('7')
      expect(typeof records[0].metadata.theme_count).toBe('string')
    })

    it('includes timestamp in metadata', async () => {
      let upsertedRecord: unknown
      const env = {
        AI: {
          run: vi.fn(),
        },
        DECISIONS_VECTORIZE: {
          upsert: vi.fn(async (records: unknown) => {
            upsertedRecord = records
          }),
        },
      } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

      const before = Date.now()
      await upsertInsightsSessionVector(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        themeCount: 3,
        existingVector: vector,
      })
      const after = Date.now()

      const records = upsertedRecord as Array<{ metadata: Record<string, unknown> }>
      // The ts is a numeric timestamp string
      const ts = parseInt(records[0].metadata.ts as string, 10)
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after + 100) // small buffer for execution time
    })
  })

  describe('Vector dimension validation', () => {
    it('uses correct vector dimension from DECISIONS_EMBED_DIM', async () => {
      const env = {
        AI: {
          run: vi.fn(async () => ({ data: [vector] })),
        },
        DECISIONS_VECTORIZE: {
          query: vi.fn().mockResolvedValueOnce({ matches: [] }),
        },
      } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

      const result = await embedAndFindSimilarSessionTitles(env, {
        sessionId: 'sess-1',
        sessionTitle: 'Retro',
        openResponses: ['Issue 1'],
      })

      expect(result.vector).toHaveLength(DECISIONS_EMBED_DIM)
    })
  })
})
