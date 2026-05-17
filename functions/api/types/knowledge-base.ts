// ADR-040 Phase 2: TypeScript contracts for knowledge-base vector search.
//
// Shared between functions/api/ (server) and src/ (frontend, future). Keep this
// file framework-free — no Hono, no D1, no Vectorize types — so it can be
// imported from React without bundling worker-only modules.

/**
 * Document type, derived from the doc's source folder + frontmatter `type`.
 * Mirrors `kb_documents.type`.
 */
export type KbType = 'adr' | 'spec' | 'guide' | 'runbook' | 'experiment' | 'unknown'

/**
 * Document lifecycle state. Mirrors `kb_documents.status`.
 * Note: ADR-040 §3.2 lists the Vectorize-side enum as {draft, accepted, deprecated},
 * but the D1 schema (and writer pipeline) also allows 'proposed' for in-flight ADRs.
 */
export type KbStatus = 'draft' | 'proposed' | 'accepted' | 'deprecated'

/**
 * Domain bucket. Enumerated from the `knowledge-base/` folder layout and
 * frontmatter; kept as a string union (rather than enum) so the writer pipeline
 * can extend it without a code change. The values listed are the
 * currently-known set — additions should land here as docs grow.
 */
export type KbDomain =
  | 'security'
  | 'ai-context'
  | 'infrastructure'
  | 'product'
  | 'frontend'
  | 'backend'
  | 'realtime'
  | 'integrations'
  | 'deployment'
  | 'data'
  | 'observability'
  | 'governance'
  | (string & { readonly __brand?: 'KbDomain' })

/** Inbound search request body. */
export interface KbSearchRequest {
  /** Free-text query. 1..500 chars after trim. */
  query: string
  /** Exact-match filter on `kb_documents.domain`. */
  domain?: string
  /** Exact-match filter on `kb_documents.type`. */
  type?: KbType
  /** OR-match against `kb_documents.tags_json` (any tag in list matches). */
  tags?: string[]
  /** Exact-match filter on `kb_documents.status`. Defaults to 'accepted'. */
  status?: KbStatus
  /** Number of hits to return after re-ranking. 1..20, default 5. */
  limit?: number
}

/** One hit in a search response. */
export interface KbSearchHit {
  doc_id: string
  chunk_id: string
  file_path: string
  title: string
  heading_path: string
  type: KbType
  domain: string
  tags: string[]
  /** Cosine similarity from Vectorize, normalised to 0..1. */
  similarity: number
  /** Composite rerank score (0..1) — see KbSearchService for weights. */
  rerank_score: number
  /** First 240 chars of `kb_chunks.text`. */
  chunk_preview: string
}

/** Compact citation source, used by RAG callers that don't need the chunk body. */
export interface KbSource {
  doc_id: string
  file_path: string
  title: string
  heading_path: string
  similarity: number
}

/**
 * Vectorize metadata shape (per vector in `KB_VECTORIZE`). Mirror of
 * ADR-040 §3.2. Kept <1KB; chunk text lives in D1 only.
 */
export interface KbVectorMetadata {
  doc_id: string
  chunk_id: string
  type: KbType
  domain: string
  status: KbStatus
  /** Capped to 8 entries by the writer pipeline. */
  tags: string[]
  /** Truncated to 120 chars by the writer pipeline. */
  heading_path: string
}

/** Hydrated chunk + parent document metadata, returned by repository. */
export interface KbHydratedChunk {
  chunk_id: string
  doc_id: string
  text: string
  heading_path: string
  file_path: string
  title: string
  type: KbType
  domain: string
  tags: string[]
  status: KbStatus
}

/** Response envelope (inside `data`) for POST /api/knowledge-base/search. */
export interface KbSearchResponse {
  items: KbSearchHit[]
  query_id: string
  latency_ms: number
}
