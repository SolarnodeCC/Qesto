/**
 * ADR-040 Phase 3: Unit tests for the RAG context injection helper.
 *
 * The helper composes `KbSearchService.search()` with a token-budgeted
 * markdown packer. Tests stub the service via `vi.spyOn(KbSearchService.prototype, 'search')`
 * so we never hit Workers AI, Vectorize, or D1.
 *
 * Coverage targets:
 *   - Greedy packing respects `maxTokens * 0.9` headroom.
 *   - Markdown formatting + citation includes rerank_score as confidence %.
 *   - Sources array stays aligned with packed chunks (no orphans).
 *   - Validation rejects empty / oversize queries with KbSearchError('invalid_query').
 *   - Filters (`domain`, `type`, `limit`) thread through to the underlying search.
 *   - No-results → empty contextBlock + empty sources (NOT an error).
 *   - KbSearchService errors bubble up unchanged.
 *   - Oversize first chunk truncates instead of starving the caller.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RAG_BUDGET_HEADROOM,
  RAG_CHARS_PER_TOKEN,
  RAG_DEFAULT_MAX_TOKENS,
  RAG_MAX_CHUNK_CHARS,
  RAG_MAX_LIMIT,
  RAG_SECTION_OVERHEAD_TOKENS,
  __internal,
  getRagContext,
} from '../../functions/api/lib/rag/getRagContext'
import {
  KbSearchError,
  KbSearchService,
} from '../../functions/api/services/kbSearchService'
import type { Env } from '../../functions/api/types'
import type { KbSearchHit } from '../../functions/api/types/knowledge-base'

// ─── Helpers ──────────────────────────────────────────────────────────────

function fakeEnv(): Env {
  // The helper instantiates KbVectorRepository(env.DB, env.KB_VECTORIZE) and
  // KbSearchService(repo, env.AI) — but we spy on `search` at the prototype
  // level, so the actual bindings are never dereferenced. Cast keeps TS happy.
  return {
    DB: {} as unknown as D1Database,
    KB_VECTORIZE: {} as unknown as VectorizeIndex,
    AI: {} as unknown as Ai,
  } as unknown as Env
}

function makeHit(overrides: Partial<KbSearchHit> = {}): KbSearchHit {
  return {
    doc_id: 'adr-040',
    chunk_id: 'adr-040#0',
    file_path: '/knowledge-base/adr/ADR-040-kb-vector-pipeline.md',
    title: 'KB Vector Pipeline',
    heading_path: 'Decision › Index Design',
    type: 'adr',
    domain: 'infrastructure',
    tags: ['vectorize', 'rag'],
    similarity: 0.9,
    rerank_score: 0.85,
    chunk_preview: 'A short preview of the chunk text.',
    ...overrides,
  }
}

function stubSearch(hits: KbSearchHit[] | Error) {
  return vi.spyOn(KbSearchService.prototype, 'search').mockImplementation(async () => {
    if (hits instanceof Error) throw hits
    return hits
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Internal helpers ─────────────────────────────────────────────────────

describe('rag context helpers', () => {
  it('estimateTokens uses chars/4 ceiling', () => {
    expect(__internal.estimateTokens('')).toBe(0)
    expect(__internal.estimateTokens('a'.repeat(4))).toBe(1)
    expect(__internal.estimateTokens('a'.repeat(5))).toBe(2)
    expect(__internal.estimateTokens('a'.repeat(400))).toBe(100)
  })

  it('bodyForHit truncates over-cap previews with ellipsis', () => {
    const hit = makeHit({ chunk_preview: 'x'.repeat(RAG_MAX_CHUNK_CHARS + 50) })
    const body = __internal.bodyForHit(hit)
    expect(body.length).toBeLessThanOrEqual(RAG_MAX_CHUNK_CHARS + 1)
    expect(body.endsWith('…')).toBe(true)
  })

  it('bodyForHit returns short previews verbatim', () => {
    const hit = makeHit({ chunk_preview: 'short' })
    expect(__internal.bodyForHit(hit)).toBe('short')
  })

  it('bodyForHit handles missing preview gracefully', () => {
    const hit = makeHit({ chunk_preview: '' })
    expect(__internal.bodyForHit(hit)).toBe('')
  })

  it('confidencePct clamps to [0, 100] and rounds', () => {
    expect(__internal.confidencePct(0.85)).toBe(85)
    expect(__internal.confidencePct(0)).toBe(0)
    expect(__internal.confidencePct(1)).toBe(100)
    expect(__internal.confidencePct(-1)).toBe(0)
    expect(__internal.confidencePct(2)).toBe(100)
    expect(__internal.confidencePct(Number.NaN)).toBe(0)
  })

  it('formatHeading falls back to file_path when title is empty', () => {
    const hit = makeHit({ title: '', heading_path: '', file_path: '/k/x.md' })
    expect(__internal.formatHeading(hit)).toBe('### /k/x.md')
  })

  it('formatHeading includes › separator when heading_path present', () => {
    const out = __internal.formatHeading(
      makeHit({ title: 'T', heading_path: 'A › B' }),
    )
    expect(out).toBe('### T › A › B')
  })

  it('resolveLimit defaults, floors, and clamps to RAG_MAX_LIMIT', () => {
    expect(__internal.resolveLimit(undefined)).toBeGreaterThan(0)
    expect(__internal.resolveLimit(0)).toBe(1)
    expect(__internal.resolveLimit(-5)).toBe(1)
    expect(__internal.resolveLimit(1000)).toBe(RAG_MAX_LIMIT)
    expect(__internal.resolveLimit(3.7)).toBe(3)
    expect(__internal.resolveLimit(Number.NaN)).toBeGreaterThan(0)
  })

  it('validateQuery enforces 1..500 chars', () => {
    expect(() => __internal.validateQuery('')).toThrow(KbSearchError)
    expect(() => __internal.validateQuery('   ')).toThrow(KbSearchError)
    expect(() => __internal.validateQuery('x'.repeat(501))).toThrow(KbSearchError)
    expect(__internal.validateQuery('  ok  ')).toBe('ok')
  })

  it('validateQuery rejects non-string input', () => {
    expect(() => __internal.validateQuery(null as unknown as string)).toThrow(KbSearchError)
    expect(() => __internal.validateQuery(42 as unknown as string)).toThrow(KbSearchError)
  })

  it('toSource maps KbSearchHit → KbSource (no chunk text leak)', () => {
    const hit = makeHit({
      doc_id: 'adr-001',
      file_path: '/k/a.md',
      title: 'A',
      heading_path: 'H',
      similarity: 0.42,
    })
    expect(__internal.toSource(hit)).toEqual({
      doc_id: 'adr-001',
      file_path: '/k/a.md',
      title: 'A',
      heading_path: 'H',
      similarity: 0.42,
    })
  })
})

// ─── Pure packer ──────────────────────────────────────────────────────────

describe('packHits', () => {
  it('admits the first hit even when budget is small (guarantees grounding)', () => {
    const hits = [makeHit({ chunk_preview: 'x'.repeat(2000) })]
    const out = __internal.packHits(hits, 50)
    expect(out.sections.length).toBe(1)
    expect(out.packed.length).toBe(1)
  })

  it('refuses to admit anything when maxTokens is 0', () => {
    const hits = [makeHit()]
    const out = __internal.packHits(hits, 0)
    expect(out.sections.length).toBe(0)
    expect(out.packed.length).toBe(0)
  })

  it('greedily packs subsequent hits under maxTokens * headroom', () => {
    const tiny = makeHit({ chunk_preview: 'short' })
    const hits = [tiny, makeHit({ doc_id: 'b', chunk_id: 'b#0' }), makeHit({ doc_id: 'c', chunk_id: 'c#0' })]
    // Budget large enough for all three.
    const out = __internal.packHits(hits, 10_000)
    expect(out.sections.length).toBe(3)
    expect(out.packed.map((h) => h.doc_id)).toEqual(['adr-040', 'b', 'c'])
  })

  it('stops admitting when running cost would exceed the headroom budget', () => {
    // Each section ~ (chars/4) + 50 overhead. Use full RAG_MAX_CHUNK_CHARS chunks.
    const big = (id: string) =>
      makeHit({
        doc_id: id,
        chunk_id: `${id}#0`,
        chunk_preview: 'x'.repeat(RAG_MAX_CHUNK_CHARS),
      })
    const hits = [big('a'), big('b'), big('c'), big('d'), big('e')]
    // 200 tokens budget → ~180 effective → first hit forced; second probably won't fit.
    const out = __internal.packHits(hits, 200)
    expect(out.sections.length).toBeGreaterThanOrEqual(1)
    expect(out.sections.length).toBeLessThan(hits.length)
  })

  it('returns aligned sections + packed arrays', () => {
    const hits = [makeHit({ doc_id: 'a', chunk_id: 'a#0' }), makeHit({ doc_id: 'b', chunk_id: 'b#0' })]
    const out = __internal.packHits(hits, 5_000)
    expect(out.sections.length).toBe(out.packed.length)
  })
})

// ─── End-to-end getRagContext() ───────────────────────────────────────────

describe('getRagContext', () => {
  it('returns empty context + empty sources when search returns no hits', async () => {
    stubSearch([])
    const out = await getRagContext(fakeEnv(), 'anything')
    expect(out).toEqual({ contextBlock: '', sources: [] })
  })

  it('returns empty context when maxTokens is 0 (caller opted out)', async () => {
    stubSearch([makeHit()])
    const out = await getRagContext(fakeEnv(), 'q', { maxTokens: 0 })
    expect(out.contextBlock).toBe('')
    expect(out.sources).toEqual([])
  })

  it('formats markdown with heading, body, and citation block', async () => {
    stubSearch([
      makeHit({
        title: 'KB Vector Pipeline',
        heading_path: 'Decision',
        file_path: '/k/ADR-040.md',
        chunk_preview: 'Hello world',
        rerank_score: 0.82,
      }),
    ])
    const { contextBlock } = await getRagContext(fakeEnv(), 'kb pipeline')
    expect(contextBlock.startsWith('## Knowledge Base Context\n\n')).toBe(true)
    expect(contextBlock).toContain('### KB Vector Pipeline › Decision')
    expect(contextBlock).toContain('Hello world')
    expect(contextBlock).toContain('_Source: /k/ADR-040.md (confidence: 82%)_')
  })

  it('includes rerank_score as a 0-100 confidence percentage', async () => {
    stubSearch([
      makeHit({ rerank_score: 0.5 }),
      makeHit({ doc_id: 'b', chunk_id: 'b#0', rerank_score: 0.999 }),
    ])
    const { contextBlock } = await getRagContext(fakeEnv(), 'q', { maxTokens: 10_000 })
    expect(contextBlock).toContain('confidence: 50%')
    expect(contextBlock).toContain('confidence: 100%')
  })

  it('sources array stays aligned with packed sections (no orphans)', async () => {
    const big = (id: string) =>
      makeHit({
        doc_id: id,
        chunk_id: `${id}#0`,
        chunk_preview: 'x'.repeat(RAG_MAX_CHUNK_CHARS),
      })
    stubSearch([big('a'), big('b'), big('c'), big('d'), big('e')])

    const { contextBlock, sources } = await getRagContext(fakeEnv(), 'q', { maxTokens: 250 })

    // Each section heading begins with "### " — count occurrences.
    const sectionCount = (contextBlock.match(/^### /gm) ?? []).length
    expect(sources.length).toBe(sectionCount)
    expect(sources.length).toBeGreaterThanOrEqual(1)
  })

  it('respects the budget headroom (effective budget is maxTokens * 0.9)', async () => {
    // Construct two ~equal-size chunks; pick a budget that fits one but not two
    // under the 0.9 headroom. Chunk body = 400 chars → ~100 tokens body + 50 overhead = 150
    // per section. 2 sections = 300 tokens. Budget 300 with headroom 0.9 = 270 effective
    // → 2nd hit must NOT fit.
    const big = (id: string) =>
      makeHit({
        doc_id: id,
        chunk_id: `${id}#0`,
        chunk_preview: 'x'.repeat(RAG_MAX_CHUNK_CHARS),
      })
    stubSearch([big('a'), big('b')])
    const { sources } = await getRagContext(fakeEnv(), 'q', { maxTokens: 300 })
    expect(sources.length).toBe(1)

    // Sanity check: doubling the budget DOES admit both.
    stubSearch([big('a'), big('b')])
    const { sources: roomy } = await getRagContext(fakeEnv(), 'q', { maxTokens: 600 })
    expect(roomy.length).toBe(2)
  })

  it('handles oversized first chunk gracefully (truncates, does not throw)', async () => {
    const huge = makeHit({ chunk_preview: 'y'.repeat(10_000) })
    stubSearch([huge])
    const { contextBlock, sources } = await getRagContext(fakeEnv(), 'q', { maxTokens: 50 })
    expect(sources.length).toBe(1)
    // The body inside the block must be the truncated preview, not the raw 10k chars.
    expect(contextBlock.length).toBeLessThan(2_000)
    expect(contextBlock).toContain('…')
  })

  it('passes domain and type filters through to KbSearchService.search', async () => {
    const spy = stubSearch([])
    await getRagContext(fakeEnv(), 'auth flow', {
      domain: 'security',
      type: 'spec',
      limit: 8,
    })
    const callArgs = spy.mock.calls[0][0]
    expect(callArgs).toMatchObject({
      query: 'auth flow',
      domain: 'security',
      type: 'spec',
      limit: 8,
    })
  })

  it('omits domain/type when not provided so they do not constrain Vectorize', async () => {
    const spy = stubSearch([])
    await getRagContext(fakeEnv(), 'anything')
    const callArgs = spy.mock.calls[0][0]
    expect(callArgs.domain).toBeUndefined()
    expect(callArgs.type).toBeUndefined()
  })

  it('clamps the upstream limit to RAG_MAX_LIMIT', async () => {
    const spy = stubSearch([])
    await getRagContext(fakeEnv(), 'q', { limit: 999 })
    const callArgs = spy.mock.calls[0][0]
    expect(callArgs.limit).toBe(RAG_MAX_LIMIT)
  })

  it('validates query length (rejects empty)', async () => {
    await expect(getRagContext(fakeEnv(), '')).rejects.toMatchObject({
      name: 'KbSearchError',
      code: 'invalid_query',
    })
  })

  it('validates query length (rejects > 500 chars)', async () => {
    await expect(getRagContext(fakeEnv(), 'x'.repeat(501))).rejects.toMatchObject({
      code: 'invalid_query',
    })
  })

  it('propagates KbSearchService errors unchanged (e.g. embedding failed)', async () => {
    stubSearch(new KbSearchError('embedding_failed', 'AI unavailable'))
    await expect(getRagContext(fakeEnv(), 'q')).rejects.toMatchObject({
      name: 'KbSearchError',
      code: 'embedding_failed',
    })
  })

  it('default maxTokens is RAG_DEFAULT_MAX_TOKENS when not provided', async () => {
    // Indirect check: with a fat single hit we should still pack exactly 1
    // (first hit is always admitted). Confirms the helper does not throw on
    // the default and exposes the constant for callers/tests.
    stubSearch([makeHit()])
    const { sources } = await getRagContext(fakeEnv(), 'q')
    expect(sources.length).toBe(1)
    expect(RAG_DEFAULT_MAX_TOKENS).toBeGreaterThan(0)
  })

  it('section overhead is included in budget math', async () => {
    // Trivial smoke test: overhead constant is non-zero so tiny chunks still
    // consume budget. Guards against accidental constant deletion.
    expect(RAG_SECTION_OVERHEAD_TOKENS).toBeGreaterThan(0)
    expect(RAG_BUDGET_HEADROOM).toBeGreaterThan(0)
    expect(RAG_BUDGET_HEADROOM).toBeLessThanOrEqual(1)
    expect(RAG_CHARS_PER_TOKEN).toBe(4)
  })

  it('produces a clean markdown block (no trailing whitespace on sections)', async () => {
    stubSearch([
      makeHit({ doc_id: 'a', chunk_id: 'a#0', chunk_preview: 'first' }),
      makeHit({ doc_id: 'b', chunk_id: 'b#0', chunk_preview: 'second' }),
    ])
    const { contextBlock } = await getRagContext(fakeEnv(), 'q', { maxTokens: 5_000 })
    expect(contextBlock).not.toMatch(/[ \t]+\n/) // no trailing whitespace before newline
    expect(contextBlock.endsWith(' ')).toBe(false)
    expect(contextBlock.endsWith('\n')).toBe(false)
  })
})
