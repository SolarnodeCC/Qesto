/**
 * ADR-040 Phase 2: Unit + integration tests for the knowledge-base search
 * service and repository.
 *
 * The service is exercised through stubbed Vectorize + D1 + Workers AI; no
 * network calls are made. Tests cover:
 *   - Happy-path embed → query → hydrate → re-rank → slice.
 *   - Domain / type / status filters threaded into the Vectorize call.
 *   - Tag-overlap and domain-match contributions to rerank_score.
 *   - Dedup-by-doc collapse of multi-chunk hits.
 *   - Validation of query length (1..500 chars).
 *   - Graceful degradation: Vectorize failure → [], embedding timeout → 503-able error.
 *   - Repository: WHERE chunk_id IN(...) batch hydration without N+1.
 */

import { describe, expect, it, vi } from 'vitest'
import { KbVectorRepository } from '../../functions/api/repositories/kbVectorRepository'
import {
  KB_DEFAULT_LIMIT,
  KB_EMBED_DIM,
  KB_EMBED_MODEL,
  KB_RERANK_WEIGHTS,
  KbSearchError,
  KbSearchService,
  __internal,
} from '../../functions/api/services/kbSearchService'
import type {
  KbHydratedChunk,
  KbSearchRequest,
} from '../../functions/api/types/knowledge-base'

// ─── Helpers ──────────────────────────────────────────────────────────────

const ZERO_VECTOR = Array.from({ length: KB_EMBED_DIM }, (_, i) => (i % 7) / 100)

function makeAi(vector: number[] = ZERO_VECTOR, throws?: Error | 'timeout') {
  return {
    run: vi.fn(async (model: string) => {
      if (throws === 'timeout') {
        await new Promise((resolve) => setTimeout(resolve, 5_000))
        return { data: [vector] }
      }
      if (throws) throw throws
      expect(model).toBe(KB_EMBED_MODEL)
      return { data: [vector] }
    }),
  } as unknown as Ai
}

interface FakeMatch {
  id: string
  score: number
  metadata: {
    doc_id: string
    chunk_id: string
    type: string
    domain: string
    status: string
    tags: string[]
    heading_path: string
  }
}

function makeRepo(
  matches: FakeMatch[],
  hydrated: Record<string, KbHydratedChunk> = {},
  overrides: { vectorizeThrows?: Error } = {},
): KbVectorRepository {
  const repo = new KbVectorRepository(
    // D1 stub — only used by hydrateChunks, which we override below.
    {} as unknown as D1Database,
    // Vectorize stub
    {
      query: vi.fn(async (vector: number[], opts: { topK?: number; filter?: unknown }) => {
        if (overrides.vectorizeThrows) throw overrides.vectorizeThrows
        expect(vector.length).toBe(KB_EMBED_DIM)
        const limit = opts.topK ?? matches.length
        return { matches: matches.slice(0, limit) }
      }),
    } as unknown as VectorizeIndex,
  )

  // Override hydrateChunks so we don't need to mock D1 SQL.
  repo.hydrateChunks = vi.fn(async (ids: string[]) => {
    const map = new Map<string, KbHydratedChunk>()
    for (const id of ids) {
      const chunk = hydrated[id]
      if (chunk) map.set(id, chunk)
    }
    return map
  })

  return repo
}

function hydrated(id: string, overrides: Partial<KbHydratedChunk> = {}): KbHydratedChunk {
  return {
    chunk_id: id,
    doc_id: overrides.doc_id ?? id.split('#')[0],
    text: overrides.text ?? `Content of ${id}`,
    heading_path: overrides.heading_path ?? 'Section',
    file_path: overrides.file_path ?? `/knowledge-base/adr/${id}.md`,
    title: overrides.title ?? `Doc ${id}`,
    type: overrides.type ?? 'adr',
    domain: overrides.domain ?? 'backend',
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'accepted',
  }
}

function fakeMatch(
  id: string,
  score: number,
  meta: Partial<FakeMatch['metadata']> = {},
): FakeMatch {
  return {
    id,
    score,
    metadata: {
      doc_id: meta.doc_id ?? id.split('#')[0],
      chunk_id: id,
      type: meta.type ?? 'adr',
      domain: meta.domain ?? 'backend',
      status: meta.status ?? 'accepted',
      tags: meta.tags ?? [],
      heading_path: meta.heading_path ?? 'Section',
    },
  }
}

// ─── Re-rank math (pure) ──────────────────────────────────────────────────

describe('kb rerank math', () => {
  it('weights sum to 1.0', () => {
    const total = KB_RERANK_WEIGHTS.cosine + KB_RERANK_WEIGHTS.tagOverlap + KB_RERANK_WEIGHTS.domainMatch
    expect(total).toBeCloseTo(1.0, 5)
  })

  it('tagOverlapRatio is Jaccard, case-insensitive', () => {
    expect(__internal.tagOverlapRatio(['Auth', 'D1'], ['auth', 'd1', 'kv'])).toBeCloseTo(2 / 3, 5)
    expect(__internal.tagOverlapRatio([], ['auth'])).toBe(0)
    expect(__internal.tagOverlapRatio(['x'], [])).toBe(0)
    expect(__internal.tagOverlapRatio(undefined, ['x'])).toBe(0)
  })

  it('domainMatch returns 1 on exact match, 0 otherwise', () => {
    expect(__internal.domainMatch('backend', 'backend')).toBe(1)
    expect(__internal.domainMatch('backend', 'frontend')).toBe(0)
    expect(__internal.domainMatch(undefined, 'backend')).toBe(0)
  })

  it('composes rerank_score within [0,1]', () => {
    expect(__internal.computeRerankScore(1, 1, 1)).toBe(1)
    expect(__internal.computeRerankScore(0, 0, 0)).toBe(0)
    expect(__internal.computeRerankScore(0.9, 0.5, 1)).toBeCloseTo(
      0.7 * 0.9 + 0.15 * 0.5 + 0.15 * 1,
      5,
    )
  })

  it('dedupByDoc keeps highest-scoring chunk per doc (matches arrive sorted)', () => {
    const out = __internal.dedupByDoc([
      fakeMatch('adr-040#1', 0.95) as unknown as Parameters<typeof __internal.dedupByDoc>[0][number],
      fakeMatch('adr-040#3', 0.92) as unknown as Parameters<typeof __internal.dedupByDoc>[0][number],
      fakeMatch('adr-041#0', 0.88) as unknown as Parameters<typeof __internal.dedupByDoc>[0][number],
      fakeMatch('adr-040#2', 0.85) as unknown as Parameters<typeof __internal.dedupByDoc>[0][number],
    ])
    expect(out.map((m) => m.id)).toEqual(['adr-040#1', 'adr-041#0'])
  })

  it('chunkPreview truncates to 240 chars and appends ellipsis', () => {
    const long = 'x'.repeat(500)
    const preview = __internal.chunkPreview(long)
    expect(preview.length).toBeLessThanOrEqual(241)
    expect(preview.endsWith('…')).toBe(true)
    expect(__internal.chunkPreview('short')).toBe('short')
  })
})

// ─── Validation ───────────────────────────────────────────────────────────

describe('KbSearchService.validateRequest', () => {
  it('rejects missing query', () => {
    expect(() => __internal.validateRequest({} as KbSearchRequest)).toThrow(KbSearchError)
  })

  it('rejects empty / whitespace-only query', () => {
    expect(() => __internal.validateRequest({ query: '' })).toThrow(/at least 1/)
    expect(() => __internal.validateRequest({ query: '   ' })).toThrow(/at least 1/)
  })

  it('rejects query > 500 chars', () => {
    expect(() => __internal.validateRequest({ query: 'x'.repeat(501) })).toThrow(/<= 500/)
  })

  it('defaults limit to 5 and clamps to [1, 20]', () => {
    expect(__internal.validateRequest({ query: 'hi' }).limit).toBe(KB_DEFAULT_LIMIT)
    expect(__internal.validateRequest({ query: 'hi', limit: 0 }).limit).toBe(1)
    expect(__internal.validateRequest({ query: 'hi', limit: 100 }).limit).toBe(20)
  })

  it('defaults status to accepted', () => {
    expect(__internal.validateRequest({ query: 'hi' }).filter.status).toBe('accepted')
  })
})

// ─── Service integration ──────────────────────────────────────────────────

describe('KbSearchService.search', () => {
  it('embeds query, queries Vectorize, hydrates and returns ranked hits', async () => {
    const matches = [
      fakeMatch('adr-040#0', 0.95, { doc_id: 'adr-040', domain: 'backend' }),
      fakeMatch('adr-041#0', 0.85, { doc_id: 'adr-041', domain: 'frontend' }),
    ]
    const repo = makeRepo(matches, {
      'adr-040#0': hydrated('adr-040#0', { doc_id: 'adr-040', title: 'KB Vectors', domain: 'backend' }),
      'adr-041#0': hydrated('adr-041#0', { doc_id: 'adr-041', title: 'UI search', domain: 'frontend' }),
    })
    const ai = makeAi()
    const service = new KbSearchService(repo, ai)

    const hits = await service.search({ query: 'how do i embed knowledge base?', limit: 5 })

    expect(ai.run).toHaveBeenCalledOnce()
    expect(hits.length).toBe(2)
    expect(hits[0].doc_id).toBe('adr-040') // higher cosine wins on a no-tag query
    expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity)
    // Cosine 0.95 in [-1,1] → (0.95+1)/2 = 0.975 → rerank = 0.7*0.975 = 0.6825
    expect(hits[0].rerank_score).toBeCloseTo(0.7 * 0.975, 3)
    expect(hits[0].chunk_preview).toContain('adr-040#0')
  })

  it('filters propagate to Vectorize.query', async () => {
    const matches = [fakeMatch('a#0', 0.9, { domain: 'security', type: 'spec' })]
    const repo = makeRepo(matches, { 'a#0': hydrated('a#0', { domain: 'security', type: 'spec' }) })
    const queryMock = repo['vectorize'].query as unknown as ReturnType<typeof vi.fn>
    const ai = makeAi()
    const service = new KbSearchService(repo, ai)

    await service.search({ query: 'auth tokens', domain: 'security', type: 'spec' })
    const callArgs = queryMock.mock.calls[0][1] as { filter?: Record<string, unknown> }
    expect(callArgs.filter).toMatchObject({ domain: 'security', type: 'spec', status: 'accepted' })
  })

  it('boosts rerank_score when tags overlap', async () => {
    const matches = [
      fakeMatch('a#0', 0.8, { doc_id: 'a', domain: 'backend' }),
      fakeMatch('b#0', 0.8, { doc_id: 'b', domain: 'backend' }),
    ]
    const repo = makeRepo(matches, {
      'a#0': hydrated('a#0', { doc_id: 'a', tags: ['vectorize', 'workers-ai'] }),
      'b#0': hydrated('b#0', { doc_id: 'b', tags: ['stripe'] }),
    })
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'search', tags: ['vectorize'], limit: 5 })
    expect(hits[0].doc_id).toBe('a')
    expect(hits[0].rerank_score).toBeGreaterThan(hits[1].rerank_score)
  })

  it('boosts rerank_score when domain matches', async () => {
    const matches = [
      fakeMatch('a#0', 0.7, { doc_id: 'a', domain: 'frontend' }),
      fakeMatch('b#0', 0.7, { doc_id: 'b', domain: 'backend' }),
    ]
    const repo = makeRepo(matches, {
      'a#0': hydrated('a#0', { doc_id: 'a', domain: 'frontend' }),
      'b#0': hydrated('b#0', { doc_id: 'b', domain: 'backend' }),
    })
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'q', domain: 'backend' })
    expect(hits[0].doc_id).toBe('b')
  })

  it('deduplicates by doc_id, keeping highest-scoring chunk', async () => {
    const matches = [
      fakeMatch('adr-040#0', 0.95, { doc_id: 'adr-040' }),
      fakeMatch('adr-040#5', 0.92, { doc_id: 'adr-040' }), // dup
      fakeMatch('adr-041#0', 0.88, { doc_id: 'adr-041' }),
      fakeMatch('adr-040#9', 0.85, { doc_id: 'adr-040' }), // dup
    ]
    const repo = makeRepo(matches, {
      'adr-040#0': hydrated('adr-040#0', { doc_id: 'adr-040' }),
      'adr-041#0': hydrated('adr-041#0', { doc_id: 'adr-041' }),
    })
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'q', limit: 5 })
    expect(hits.map((h) => h.doc_id)).toEqual(['adr-040', 'adr-041'])
    expect(hits[0].chunk_id).toBe('adr-040#0') // highest-scoring chunk for the doc
  })

  it('slices to the requested limit', async () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      fakeMatch(`d${i}#0`, 0.9 - i * 0.05, { doc_id: `d${i}` }),
    )
    const hydratedMap: Record<string, KbHydratedChunk> = {}
    for (let i = 0; i < 6; i++) hydratedMap[`d${i}#0`] = hydrated(`d${i}#0`, { doc_id: `d${i}` })
    const repo = makeRepo(matches, hydratedMap)
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'q', limit: 3 })
    expect(hits.length).toBe(3)
  })

  it('rejects empty query (validation propagates as KbSearchError)', async () => {
    const service = new KbSearchService(makeRepo([]), makeAi())
    await expect(service.search({ query: '' })).rejects.toMatchObject({
      code: 'invalid_query',
    })
  })

  it('rejects oversized query', async () => {
    const service = new KbSearchService(makeRepo([]), makeAi())
    await expect(service.search({ query: 'x'.repeat(1000) })).rejects.toMatchObject({
      code: 'invalid_query',
    })
  })

  it('throws embedding_failed when AI returns no vector', async () => {
    const ai = {
      run: vi.fn(async () => ({ data: [] })),
    } as unknown as Ai
    const service = new KbSearchService(makeRepo([]), ai)
    await expect(service.search({ query: 'hello' })).rejects.toMatchObject({
      code: 'embedding_failed',
    })
  })

  it('throws embedding_failed when AI throws', async () => {
    const service = new KbSearchService(makeRepo([]), makeAi(ZERO_VECTOR, new Error('AI down')))
    await expect(service.search({ query: 'hello' })).rejects.toBeInstanceOf(KbSearchError)
  })

  it('returns [] when Vectorize query fails (graceful degradation)', async () => {
    const repo = makeRepo([], {}, { vectorizeThrows: new Error('Vectorize down') })
    const service = new KbSearchService(repo, makeAi())
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hits = await service.search({ query: 'hello' })
    expect(hits).toEqual([])
    consoleSpy.mockRestore()
  })

  it('skips chunks missing from D1 (eventual consistency gap)', async () => {
    const matches = [
      fakeMatch('a#0', 0.9, { doc_id: 'a' }),
      fakeMatch('b#0', 0.8, { doc_id: 'b' }),
    ]
    // Only hydrate 'a' — 'b' was deleted between Vectorize index and this query.
    const repo = makeRepo(matches, { 'a#0': hydrated('a#0') })
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'q' })
    expect(hits.length).toBe(1)
    expect(hits[0].doc_id).toBe('a')
  })

  it('returns [] on empty match set without hitting D1', async () => {
    const repo = makeRepo([])
    const hydrateSpy = repo.hydrateChunks as unknown as ReturnType<typeof vi.fn>
    const service = new KbSearchService(repo, makeAi())

    const hits = await service.search({ query: 'q' })
    expect(hits).toEqual([])
    expect(hydrateSpy).not.toHaveBeenCalled()
  })

  it('over-fetches topK = limit * 3 for dedup headroom', async () => {
    const repo = makeRepo([])
    const queryMock = repo['vectorize'].query as unknown as ReturnType<typeof vi.fn>
    const service = new KbSearchService(repo, makeAi())

    await service.search({ query: 'q', limit: 5 })
    const callOpts = queryMock.mock.calls[0][1] as { topK?: number }
    expect(callOpts.topK).toBe(15)
  })
})

// ─── Repository: batch hydration (no N+1) ─────────────────────────────────

describe('KbVectorRepository.hydrateChunks', () => {
  it('issues a single SELECT … WHERE chunk_id IN(...) for many ids', async () => {
    let lastSql = ''
    let lastBinds: unknown[] = []
    const db = {
      prepare(sql: string) {
        lastSql = sql
        return {
          bind(...args: unknown[]) {
            lastBinds = args
            return {
              all: async () => ({
                results: [
                  {
                    chunk_id: 'a#0',
                    doc_id: 'a',
                    text: 'A',
                    heading_path: 'H',
                    file_path: '/a.md',
                    title: 'A doc',
                    type: 'adr',
                    domain: 'backend',
                    tags_json: '["x","y"]',
                    status: 'accepted',
                  },
                  {
                    chunk_id: 'b#1',
                    doc_id: 'b',
                    text: 'B',
                    heading_path: '',
                    file_path: '/b.md',
                    title: 'B doc',
                    type: 'spec',
                    domain: 'frontend',
                    tags_json: '[]',
                    status: 'draft',
                  },
                ],
              }),
            }
          },
        }
      },
    } as unknown as D1Database

    const repo = new KbVectorRepository(db, {} as VectorizeIndex)
    const map = await repo.hydrateChunks(['a#0', 'b#1', 'a#0'])

    expect(lastSql).toMatch(/WHERE c\.chunk_id IN \(\?1,\?2\)/)
    expect(lastBinds).toEqual(['a#0', 'b#1']) // dedup'd
    expect(map.size).toBe(2)
    expect(map.get('a#0')?.tags).toEqual(['x', 'y'])
    expect(map.get('b#1')?.type).toBe('spec')
  })

  it('returns empty map for empty input without querying D1', async () => {
    const db = {
      prepare: vi.fn(() => {
        throw new Error('should not be called')
      }),
    } as unknown as D1Database
    const repo = new KbVectorRepository(db, {} as VectorizeIndex)
    const map = await repo.hydrateChunks([])
    expect(map.size).toBe(0)
  })

  it('coerces unknown type/status to safe defaults', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [
              {
                chunk_id: 'x#0',
                doc_id: 'x',
                text: 'x',
                heading_path: null,
                file_path: '/x.md',
                title: 'X',
                type: 'rogue-type',
                domain: 'mystery',
                tags_json: 'not-json',
                status: 'mysterious',
              },
            ],
          }),
        }),
      }),
    } as unknown as D1Database
    const repo = new KbVectorRepository(db, {} as VectorizeIndex)
    const map = await repo.hydrateChunks(['x#0'])
    const chunk = map.get('x#0')!
    expect(chunk.type).toBe('unknown')
    expect(chunk.status).toBe('draft')
    expect(chunk.tags).toEqual([])
    expect(chunk.heading_path).toBe('')
  })
})

describe('KbVectorRepository.queryVector', () => {
  it('passes through topK + filter to Vectorize', async () => {
    const queryMock = vi.fn(
      async (_vector: number[], _opts?: Record<string, unknown>) => ({ matches: [] }),
    )
    const repo = new KbVectorRepository(
      {} as D1Database,
      { query: queryMock } as unknown as VectorizeIndex,
    )
    await repo.queryVector(ZERO_VECTOR, {
      topK: 12,
      filter: { domain: 'backend', type: 'adr', status: 'accepted' },
    })
    const opts = queryMock.mock.calls[0]?.[1]
    expect(opts).toMatchObject({
      topK: 12,
      returnMetadata: 'all',
      filter: { domain: 'backend', type: 'adr', status: 'accepted' },
    })
  })

  it('omits filter key when no filter values present', async () => {
    const queryMock = vi.fn(
      async (_vector: number[], _opts?: Record<string, unknown>) => ({ matches: [] }),
    )
    const repo = new KbVectorRepository(
      {} as D1Database,
      { query: queryMock } as unknown as VectorizeIndex,
    )
    await repo.queryVector(ZERO_VECTOR, { topK: 5 })
    const opts = queryMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined
    expect(opts?.filter).toBeUndefined()
  })
})
