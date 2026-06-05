// ADR-040 Phase 2: Knowledge-base vector repository.
//
// Thin IO boundary over D1 (kb_documents + kb_chunks) and the KB_VECTORIZE
// index. Holds no business logic — re-ranking, deduplication, and policy
// belong in `services/kbSearchService.ts`.
//
// Audit gates honored:
//   - Batch hydration via WHERE chunk_id IN (...) — no N+1.
//   - Repository never returns nullable D1 rows untyped; callers get
//     `KbHydratedChunk | undefined` keyed by chunk_id.
//   - All filters that originate from request bodies are passed through to
//     Vectorize as parametric `filter` — never concatenated into a query.

import type {
  KbHydratedChunk,
  KbStatus,
  KbType,
  KbVectorMetadata,
} from '../types/knowledge-base'

export interface KbVectorMatch {
  /** Vector id; equals `chunk_id`. */
  id: string
  /** Cosine similarity from Vectorize (already in 0..1 for our index). */
  score: number
  metadata: KbVectorMetadata
}

export interface KbQueryFilter {
  domain?: string
  type?: KbType
  status?: KbStatus
}

export interface KbQueryOptions {
  /** Defaults to 15 (3x typical limit of 5 for dedupe headroom). */
  topK?: number
  filter?: KbQueryFilter
}

/** Raw D1 row shape from a kb_chunks JOIN kb_documents query. */
interface KbChunkRow {
  chunk_id: string
  doc_id: string
  text: string
  heading_path: string | null
  file_path: string
  title: string
  type: string
  domain: string
  tags_json: string
  status: string
}

const KNOWN_TYPES: KbType[] = ['adr', 'spec', 'guide', 'runbook', 'experiment', 'unknown']
// jankurai:allow HLT-001-DEAD-MARKER reason=external-contract-status-value expires=2027-06-01
const KNOWN_STATUSES: KbStatus[] = ['draft', 'proposed', 'accepted', 'deprecated']

function coerceType(value: string): KbType {
  return (KNOWN_TYPES as string[]).includes(value) ? (value as KbType) : 'unknown'
}

function coerceStatus(value: string): KbStatus {
  return (KNOWN_STATUSES as string[]).includes(value) ? (value as KbStatus) : 'draft'
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

function rowToHydratedChunk(row: KbChunkRow): KbHydratedChunk {
  return {
    chunk_id: row.chunk_id,
    doc_id: row.doc_id,
    text: row.text,
    heading_path: row.heading_path ?? '',
    file_path: row.file_path,
    title: row.title,
    type: coerceType(row.type),
    domain: row.domain,
    tags: parseTags(row.tags_json),
    status: coerceStatus(row.status),
  }
}

export class KbVectorRepository {
  constructor(
    private readonly db: D1Database,
    private readonly vectorize: VectorizeIndex,
  ) {}

  /**
   * Query the KB_VECTORIZE index. Returns raw matches sorted by descending
   * score (Vectorize default). The Vectorize binding rejects unknown filter
   * keys, so we only pass keys we explicitly support.
   */
  async queryVector(vector: number[], opts: KbQueryOptions = {}): Promise<KbVectorMatch[]> {
    const filter: Record<string, unknown> = {}
    if (opts.filter?.domain) filter.domain = opts.filter.domain
    if (opts.filter?.type) filter.type = opts.filter.type
    if (opts.filter?.status) filter.status = opts.filter.status

    const result = await this.vectorize.query(vector, {
      topK: opts.topK ?? 15,
      // `qesto-kb-production` is a Vectorize **v2** index — `returnMetadata`
      // must be the string form ('all'|'indexed'|'none'); the legacy boolean
      // throws on v2. Metadata filtering (status/domain/type below) also
      // requires v2 metadata indexes on those properties.
      returnMetadata: 'all',
      ...(Object.keys(filter).length > 0 ? { filter: filter as VectorizeVectorMetadataFilter } : {}),
    })

    return (result.matches ?? []).map((match) => ({
      id: match.id,
      score: typeof match.score === 'number' ? match.score : 0,
      metadata: (match.metadata ?? {}) as unknown as KbVectorMetadata,
    }))
  }

  /**
   * Fetch a single chunk + its parent document metadata. Returns null when
   * the chunk has been deleted between Vectorize indexing and this query
   * (eventual consistency gap during re-embed).
   */
  async hydrateChunk(chunkId: string): Promise<KbHydratedChunk | null> {
    const row = await this.db
      .prepare(
        `SELECT c.chunk_id, c.doc_id, c.text, c.heading_path,
                d.file_path, d.title, d.type, d.domain, d.tags_json, d.status
           FROM kb_chunks c
           JOIN kb_documents d ON d.doc_id = c.doc_id
          WHERE c.chunk_id = ?1
          LIMIT 1`,
      )
      .bind(chunkId)
      .first<KbChunkRow>()
    return row ? rowToHydratedChunk(row) : null
  }

  /**
   * Batch hydrate multiple chunks. Returns a Map keyed by chunk_id so the
   * service can preserve Vectorize's original ranking while filling in
   * metadata. Missing chunks (deleted concurrently) are omitted; callers
   * must defend against gaps in the map.
   *
   * Uses a single `WHERE chunk_id IN (?,?,?,...)` query to avoid N+1.
   */
  async hydrateChunks(chunkIds: string[]): Promise<Map<string, KbHydratedChunk>> {
    const out = new Map<string, KbHydratedChunk>()
    if (chunkIds.length === 0) return out

    // De-dupe defensively — caller may pass duplicates after Vectorize
    // matches are dedup'd by doc_id, but we want exact one bind per id.
    const uniqueIds = Array.from(new Set(chunkIds))
    const placeholders = uniqueIds.map((_, i) => `?${i + 1}`).join(',')
    const sql = `SELECT c.chunk_id, c.doc_id, c.text, c.heading_path,
                        d.file_path, d.title, d.type, d.domain, d.tags_json, d.status
                   FROM kb_chunks c
                   JOIN kb_documents d ON d.doc_id = c.doc_id
                  WHERE c.chunk_id IN (${placeholders})`

    const { results } = await this.db
      .prepare(sql)
      .bind(...uniqueIds)
      .all<KbChunkRow>()

    for (const row of results ?? []) {
      out.set(row.chunk_id, rowToHydratedChunk(row))
    }
    return out
  }
}
