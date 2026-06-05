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
// jankurai:allow HLT-001-DEAD-MARKER reason=external-contract-status-value expires=2027-06-01
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

// ─── Sync pipeline contract (ADR-040 Phase 1) ──────────────────────────────
//
// The embed pipeline (`scripts/embed-kb.ts`) emits these records and the admin
// sync endpoint (`POST /api/admin/kb-sync`) consumes them. A record is
// self-contained: it carries the Vectorize vector AND the D1 rows
// (`kb_documents` + `kb_chunks`) required to make the chunk searchable
// end-to-end. Search hydrates chunk text / file_path / title from D1, so a
// vector without its D1 rows is invisible to `kb_search` — both must be written
// together. `doc_id` and `chunk_id` are carried once, in `metadata`.

/** `kb_documents` row fields carried in a sync record (`doc_id` lives in `metadata`). */
export interface KbSyncDocumentFields {
  file_path: string
  type: string
  domain: string
  category?: string | null
  status: string
  version?: string | null
  owner?: string | null
  title: string
  tags: string[]
  relates_to: string[]
  size_bytes: number
  doc_hash: string
  /** Total chunks for this doc — authoritative count used to prune stale chunks. */
  chunk_count: number
  created_at: number
  updated_at: number
}

/** `kb_chunks` row fields carried in a sync record (`chunk_id`/`doc_id` live in `metadata`). */
export interface KbSyncChunkFields {
  chunk_index: number
  heading_path: string
  start_line: number
  end_line: number
  text: string
  token_estimate: number
  chunk_hash: string
  embedded_at: number
}

/**
 * One record in the kb-sync payload. `document`/`chunk` are optional only for
 * backward compatibility with legacy vector-only payloads; the current pipeline
 * always sends both so D1 stays populated alongside Vectorize.
 */
export interface KbSyncRecord {
  /** Vectorize record id; equals `chunk_id`. */
  id: string
  /** bge-m3 embedding (1024-dim). */
  values: number[]
  metadata: KbVectorMetadata
  document?: KbSyncDocumentFields
  chunk?: KbSyncChunkFields
}
