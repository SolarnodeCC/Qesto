// ADR-040 Phase 3: RAG context injection helper.
//
// Wraps `KbSearchService` to produce a ready-to-inject markdown context block
// for AI prompts, plus a structured `sources` array for citation/attribution.
//
// Design notes:
//   • Greedy token packing — fits as many hits as possible under the budget.
//   • Token estimation uses the same heuristic as the rest of the codebase
//     (`chars / 4`) plus a ~50-token overhead per packed section to cover the
//     markdown scaffolding (heading + citation line).
//   • Target is `maxTokens * 0.9` so we leave buffer headroom for the prompt
//     stitch the caller does after we return.
//   • Graceful degradation: when search returns no hits we return an empty
//     context block (not an error). The caller decides how to prompt
//     without grounding.
//   • Query validation mirrors `KbSearchService` (1..500 chars after trim)
//     so callers fail-fast before paying for the embedding round-trip.
//
// Integration shape (see register-analyze.ts for the live wiring):
//
//   const { contextBlock, sources } = await getRagContext(c.env, query, {
//     maxTokens: 1500,
//     domain: 'product',
//   })
//   // … prompt = `${systemHeader}\n\n${contextBlock}\n\nUser: ${query}`

import { KbVectorRepository } from '../../repositories/kbVectorRepository'
import {
  KbSearchError,
  KbSearchService,
} from '../../services/kbSearchService'
import type { Env } from '../../types'
import type {
  KbSearchHit,
  KbSource,
  KbType,
} from '../../types/knowledge-base'

// ─── Tunables ─────────────────────────────────────────────────────────────

/** Default token budget for the packed context block. */
export const RAG_DEFAULT_MAX_TOKENS = 1500
/** Headroom we leave under the requested budget (90%) to allow the caller
 *  to stitch the rest of the prompt without overflowing the model window. */
export const RAG_BUDGET_HEADROOM = 0.9
/** Default upstream search limit before packing. */
export const RAG_DEFAULT_LIMIT = 5
/** Maximum upstream search limit a caller can request. */
export const RAG_MAX_LIMIT = 20
/** Approximate token overhead per packed section (heading + citation). */
export const RAG_SECTION_OVERHEAD_TOKENS = 50
/** Chunk text truncation when previews are missing or oversize. */
export const RAG_MAX_CHUNK_CHARS = 400
/** Char → token conversion heuristic (matches Phase 1/2). */
export const RAG_CHARS_PER_TOKEN = 4

// ─── Types ────────────────────────────────────────────────────────────────

export interface RagContextOptions {
  /** Token budget for the packed context block. Default 1500. */
  maxTokens?: number
  /** Domain filter passed to KbSearchService. */
  domain?: string
  /** Document-type filter passed to KbSearchService. */
  type?: KbType
  /** Max search hits before packing. Default 5, capped to 20. */
  limit?: number
}

export interface RagContext {
  /** Markdown block ready for prompt injection. Empty string when no
   *  results were returned by KbSearchService. */
  contextBlock: string
  /** Structured citations for the sections that fit under the budget. */
  sources: KbSource[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Same heuristic the writer pipeline and search service use. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / RAG_CHARS_PER_TOKEN)
}

/** Pick the body text for a hit — prefer the (preserved) preview but
 *  enforce a hard char ceiling so a single oversize chunk can't blow the
 *  budget for the whole block. */
function bodyForHit(hit: KbSearchHit): string {
  const raw = (hit.chunk_preview ?? '').trim()
  if (raw.length <= RAG_MAX_CHUNK_CHARS) return raw
  return raw.slice(0, RAG_MAX_CHUNK_CHARS).trimEnd() + '…'
}

/** Confidence percentage rendered in the citation line. */
function confidencePct(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}

function formatHeading(hit: KbSearchHit): string {
  const title = hit.title?.trim() || hit.file_path
  const path = hit.heading_path?.trim()
  return path ? `### ${title} › ${path}` : `### ${title}`
}

function formatSection(hit: KbSearchHit): string {
  const heading = formatHeading(hit)
  const body = bodyForHit(hit)
  const citation = `_Source: ${hit.file_path} (confidence: ${confidencePct(hit.rerank_score)}%)_`
  return `${heading}\n${body}\n\n${citation}`
}

function toSource(hit: KbSearchHit): KbSource {
  return {
    doc_id: hit.doc_id,
    file_path: hit.file_path,
    title: hit.title,
    heading_path: hit.heading_path,
    similarity: hit.similarity,
  }
}

/**
 * Greedy packer: walks hits in rerank order and admits each section while
 * the running token estimate (incl. per-section overhead) stays below the
 * effective budget (`maxTokens * RAG_BUDGET_HEADROOM`). Always admits the
 * first hit if there is any budget at all — otherwise an oversized first
 * chunk would leave callers with an empty grounding context. The first
 * section is then char-clamped via `bodyForHit` to keep the response
 * bounded.
 */
function packHits(hits: KbSearchHit[], maxTokens: number): {
  sections: string[]
  packed: KbSearchHit[]
} {
  const effectiveBudget = Math.floor(maxTokens * RAG_BUDGET_HEADROOM)
  const sections: string[] = []
  const packed: KbSearchHit[] = []
  let runningTokens = 0

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]
    const section = formatSection(hit)
    const sectionTokens = estimateTokens(section) + RAG_SECTION_OVERHEAD_TOKENS

    // First hit gets a guaranteed slot if the budget is non-zero, so an
    // oversized chunk never produces an empty grounding context. Subsequent
    // hits must respect the running budget.
    const isFirst = i === 0
    if (!isFirst && runningTokens + sectionTokens > effectiveBudget) {
      break
    }
    if (isFirst && effectiveBudget <= 0) {
      break
    }

    sections.push(section)
    packed.push(hit)
    runningTokens += sectionTokens
  }

  return { sections, packed }
}

function validateQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new KbSearchError('invalid_query', 'query must be a string')
  }
  const trimmed = query.trim()
  if (trimmed.length < 1) {
    throw new KbSearchError('invalid_query', 'query must be at least 1 character')
  }
  if (trimmed.length > 500) {
    throw new KbSearchError('invalid_query', 'query must be <= 500 characters')
  }
  return trimmed
}

function resolveLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return RAG_DEFAULT_LIMIT
  return Math.max(1, Math.min(RAG_MAX_LIMIT, Math.floor(raw)))
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch relevant knowledge-base chunks for `query`, pack them into a
 * markdown context block under `maxTokens`, and return the block + a
 * structured citation array.
 *
 * Errors:
 *   • `KbSearchError('invalid_query')` — empty / oversize query.
 *   • Other `KbSearchError` codes from `KbSearchService` bubble up unchanged
 *     so the caller can decide whether to degrade gracefully or surface.
 *
 * No-results path is **not** an error — `{ contextBlock: '', sources: [] }`
 * is returned and the caller can fall back to an ungrounded prompt.
 */
export async function getRagContext(
  env: Env,
  query: string,
  opts: RagContextOptions = {},
): Promise<RagContext> {
  const trimmedQuery = validateQuery(query)
  const maxTokens = Math.max(0, Math.floor(opts.maxTokens ?? RAG_DEFAULT_MAX_TOKENS))
  const limit = resolveLimit(opts.limit)

  const repo = new KbVectorRepository(env.DB, env.KB_VECTORIZE)
  const service = new KbSearchService(repo, env.AI)

  const hits = await service.search({
    query: trimmedQuery,
    limit,
    ...(opts.domain !== undefined ? { domain: opts.domain } : {}),
    ...(opts.type !== undefined ? { type: opts.type } : {}),
  })

  if (hits.length === 0) {
    return { contextBlock: '', sources: [] }
  }

  const { sections, packed } = packHits(hits, maxTokens)
  if (sections.length === 0 || packed.length === 0) {
    return { contextBlock: '', sources: [] }
  }

  const contextBlock = `## Knowledge Base Context\n\n${sections.join('\n\n')}`
  const sources: KbSource[] = packed.map(toSource)
  return { contextBlock, sources }
}

// Exposed for tests so packing / formatting math can be exercised in isolation.
export const __internal = {
  estimateTokens,
  bodyForHit,
  confidencePct,
  formatHeading,
  formatSection,
  packHits,
  validateQuery,
  resolveLimit,
  toSource,
}
