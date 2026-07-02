// ADR-040 Phase 2: Knowledge-base search orchestration.
//
// Pipeline (ADR-040 §2.5):
//   1. validate(query) — reject empty / oversize early
//   2. embed(query)   — Workers AI bge-m3 (3s timeout, degrade to []`)
//   3. queryVector()  — Vectorize.query with topK = limit * 3 + filters
//   4. dedupByDoc()   — keep highest-scoring chunk per doc_id
//   5. hydrate()      — batch JOIN kb_chunks/kb_documents
//   6. rerank()       — 0.7 cosine + 0.15 tag-overlap + 0.15 domain-match
//   7. slice()        — top `limit`
//
// Errors throw a typed `KbSearchError`; the route maps to HTTP envelope.

import type {
  KbHydratedChunk,
  KbSearchHit,
  KbSearchRequest,
  KbStatus,
} from '../types/knowledge-base'
import type { KbQueryFilter, KbVectorMatch, KbVectorRepository } from '../repositories/kbVectorRepository'
import { firstEmbeddingVector } from '../lib/embedding'
import { runAI, envWithAI } from '../lib/ai/ai-gateway'
import { safeLogContext } from '../lib/log'

// ─── Tunable constants ────────────────────────────────────────────────────
// The re-ranking weights are deliberately exposed: tuning is expected once
// we have evaluation telemetry. Keep them in `[0, 1]` and summing to ~1.

export const KB_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const KB_EMBED_DIM = 1024
export const KB_EMBED_TIMEOUT_MS = 3_000
export const KB_DEFAULT_LIMIT = 5
export const KB_MAX_LIMIT = 20
export const KB_DEDUPE_MULTIPLIER = 3
export const KB_DEFAULT_STATUS: KbStatus = 'accepted'
export const KB_CHUNK_PREVIEW_CHARS = 240

export const KB_RERANK_WEIGHTS = {
  cosine: 0.7,
  tagOverlap: 0.15,
  domainMatch: 0.15,
} as const

export const KB_DOMAIN_MATCH_BONUS = 1 // weight already applied via KB_RERANK_WEIGHTS.domainMatch

// ─── Errors ───────────────────────────────────────────────────────────────

export type KbSearchErrorCode =
  | 'invalid_query'
  | 'embedding_unavailable'
  | 'embedding_failed'
  | 'vector_search_failed'
  | 'internal_error'

export class KbSearchError extends Error {
  public readonly code: KbSearchErrorCode
  public override readonly cause?: unknown
  constructor(code: KbSearchErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'KbSearchError'
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new KbSearchError('embedding_unavailable', `${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

function firstEmbedding(result: unknown): number[] | undefined {
  return firstEmbeddingVector(result, KB_EMBED_DIM)
}

/**
 * Keep only the highest-scoring chunk per doc_id. Vectorize returns matches
 * already sorted by descending score, so the first occurrence of any
 * doc_id is the best one.
 */
function dedupByDoc(matches: KbVectorMatch[]): KbVectorMatch[] {
  const seen = new Set<string>()
  const out: KbVectorMatch[] = []
  for (const m of matches) {
    const docId = m.metadata.doc_id
    if (!docId || seen.has(docId)) continue
    seen.add(docId)
    out.push(m)
  }
  return out
}

/**
 * Jaccard tag overlap: |A ∩ B| / |A ∪ B|. Returns 0 when either side is
 * empty (no signal). Case-insensitive, trimmed.
 */
function tagOverlapRatio(requestTags: string[] | undefined, chunkTags: string[]): number {
  if (!requestTags || requestTags.length === 0 || chunkTags.length === 0) return 0
  const norm = (t: string) => t.trim().toLowerCase()
  const a = new Set(requestTags.map(norm).filter(Boolean))
  const b = new Set(chunkTags.map(norm).filter(Boolean))
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function domainMatch(requestDomain: string | undefined, chunkDomain: string): number {
  if (!requestDomain) return 0
  return requestDomain === chunkDomain ? KB_DOMAIN_MATCH_BONUS : 0
}

function computeRerankScore(
  cosine: number,
  tagOverlap: number,
  domainMatchValue: number,
): number {
  const score =
    KB_RERANK_WEIGHTS.cosine * cosine +
    KB_RERANK_WEIGHTS.tagOverlap * tagOverlap +
    KB_RERANK_WEIGHTS.domainMatch * domainMatchValue
  return Math.max(0, Math.min(1, score))
}

function chunkPreview(text: string): string {
  if (text.length <= KB_CHUNK_PREVIEW_CHARS) return text
  return text.slice(0, KB_CHUNK_PREVIEW_CHARS).trimEnd() + '…'
}

function validateRequest(req: KbSearchRequest): {
  query: string
  limit: number
  filter: KbQueryFilter
} {
  if (!req || typeof req.query !== 'string') {
    throw new KbSearchError('invalid_query', 'query must be a string')
  }
  const query = req.query.trim()
  if (query.length < 1) {
    throw new KbSearchError('invalid_query', 'query must be at least 1 character')
  }
  if (query.length > 500) {
    throw new KbSearchError('invalid_query', 'query must be <= 500 characters')
  }
  const requestedLimit = typeof req.limit === 'number' && Number.isFinite(req.limit) ? req.limit : KB_DEFAULT_LIMIT
  const limit = Math.max(1, Math.min(KB_MAX_LIMIT, Math.floor(requestedLimit)))

  const filter: KbQueryFilter = { status: req.status ?? KB_DEFAULT_STATUS }
  if (req.domain) filter.domain = req.domain
  if (req.type) filter.type = req.type

  return { query, limit, filter }
}

// ─── Service ──────────────────────────────────────────────────────────────

export class KbSearchService {
  constructor(
    private readonly repo: KbVectorRepository,
    private readonly ai: Ai,
  ) {}

  async search(req: KbSearchRequest): Promise<KbSearchHit[]> {
    const { query, limit, filter } = validateRequest(req)

    // 1. Embed query (timeout-bounded). Embedding failures bubble up as
    //    `embedding_unavailable`; the caller maps to 503.
    let vector: number[]
    try {
      const result = await withTimeout(
        runAI(envWithAI(this.ai), KB_EMBED_MODEL, { text: query }),
        KB_EMBED_TIMEOUT_MS,
        'KB query embedding',
      )
      const embedding = firstEmbedding(result)
      if (!embedding) {
        throw new KbSearchError('embedding_failed', 'embedding returned no vector')
      }
      vector = embedding
    } catch (err) {
      if (err instanceof KbSearchError) throw err
      throw new KbSearchError('embedding_failed', (err as Error).message ?? 'embedding failed', err)
    }

    // 2. Vector search. We over-fetch (limit * 3) to leave headroom for
    //    dedup-by-doc collapse. Vectorize failures are logged and treated
    //    as zero-result so the route can return an empty list (ADR-040
    //    requirement: search degrades gracefully).
    let matches: KbVectorMatch[]
    try {
      matches = await this.repo.queryVector(vector, {
        topK: limit * KB_DEDUPE_MULTIPLIER,
        filter,
      })
    } catch (err) {
      safeLogContext(err, { traceId: 'system', route: 'kb-search/vectorize-query', errorClass: err instanceof Error ? err.name : 'UnknownError' })
      return []
    }
    if (matches.length === 0) return []

    // 3. Dedupe by doc_id, preserving best score per doc.
    const dedup = dedupByDoc(matches)
    if (dedup.length === 0) return []

    // 4. Batch hydrate from D1.
    const hydrated = await this.repo.hydrateChunks(dedup.map((m) => m.id))

    // 5. Re-rank.
    const hits: KbSearchHit[] = []
    for (const match of dedup) {
      const chunk: KbHydratedChunk | undefined = hydrated.get(match.id)
      if (!chunk) continue // eventually-consistent gap; skip

      // Cosine from Vectorize on a bge-m3 cosine index is already in [-1, 1].
      // Clamp + rescale to [0, 1] to make weighting predictable.
      const cosine = Math.max(0, Math.min(1, (match.score + 1) / 2))
      const tagOverlap = tagOverlapRatio(req.tags, chunk.tags)
      const dMatch = domainMatch(req.domain, chunk.domain)

      hits.push({
        doc_id: chunk.doc_id,
        chunk_id: chunk.chunk_id,
        file_path: chunk.file_path,
        title: chunk.title,
        heading_path: chunk.heading_path,
        type: chunk.type,
        domain: chunk.domain,
        tags: chunk.tags,
        similarity: Number(cosine.toFixed(4)),
        rerank_score: Number(computeRerankScore(cosine, tagOverlap, dMatch).toFixed(4)),
        chunk_preview: chunkPreview(chunk.text),
      })
    }

    // 6. Sort descending by rerank score, then slice.
    hits.sort((a, b) => b.rerank_score - a.rerank_score)
    return hits.slice(0, limit)
  }
}

// Exposed for tests so re-ranking math can be exercised in isolation.
export const __internal = {
  dedupByDoc,
  tagOverlapRatio,
  domainMatch,
  computeRerankScore,
  chunkPreview,
  validateRequest,
  firstEmbedding,
}
