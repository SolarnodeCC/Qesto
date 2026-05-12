// ADR-040 Phase 2: Knowledge-base semantic-search HTTP layer.
//
// Routes (mounted under /api/knowledge-base):
//   POST /search                   — semantic search (auth required, rate-limited)
//   GET  /documents/:doc_id        — public metadata for a single document
//   GET  /documents/:doc_id/chunks — full chunk text (admin only)
//
// This route file is intentionally thin: it parses the body, validates auth,
// then delegates to `KbSearchService`. Re-ranking, embedding, and IO live in
// the service / repository layer. Audit gate: route handlers may only do
// HTTP concerns.

import { Hono } from 'hono'
import { fail, ok } from '../lib/http'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { RbacVariables } from '../middleware/rbac'
import { rateLimit } from '../middleware/rate-limit'
import { KbVectorRepository } from '../repositories/kbVectorRepository'
import { KbSearchError, KbSearchService } from '../services/kbSearchService'
import type { Env } from '../types'
import type { KbSearchRequest, KbSearchResponse, KbStatus, KbType } from '../types/knowledge-base'

// Must match the Vars shape used in app.ts so this sub-router can be
// composed into the parent without a structural mismatch.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

function parseTagsField(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) return undefined
  return value.filter((v): v is string => typeof v === 'string').slice(0, 16)
}

function coerceSearchRequest(raw: unknown): KbSearchRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.query !== 'string') return null
  const req: KbSearchRequest = { query: r.query }
  if (typeof r.domain === 'string' && r.domain.length > 0) req.domain = r.domain
  if (typeof r.type === 'string') req.type = r.type as KbType
  if (typeof r.status === 'string') req.status = r.status as KbStatus
  if (typeof r.limit === 'number') req.limit = r.limit
  const tags = parseTagsField(r.tags)
  if (tags) req.tags = tags
  return req
}

function mapKbErrorToStatus(err: KbSearchError): {
  status: 400 | 503 | 500
  code: string
  message: string
} {
  switch (err.code) {
    case 'invalid_query':
      return { status: 400, code: 'invalid_query', message: err.message }
    case 'embedding_unavailable':
      return { status: 503, code: 'embedding_unavailable', message: 'Embedding service unavailable' }
    case 'embedding_failed':
      return { status: 503, code: 'embedding_unavailable', message: 'Embedding service unavailable' }
    case 'vector_search_failed':
    case 'internal_error':
    default:
      return { status: 500, code: 'internal_error', message: 'Internal error' }
  }
}

export function mountKnowledgeBaseRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // POST /search — auth + rate-limited semantic search.
  app.post(
    '/search',
    authMiddleware,
    rateLimit<Vars>({ namespace: 'kb-search', limit: 60, windowSec: 60 }),
    async (c) => {
      const startTime = Date.now()

      let rawBody: unknown
      try {
        rawBody = await c.req.json()
      } catch {
        return fail(c, 'invalid_body', 'Body must be valid JSON', 400)
      }

      const req = coerceSearchRequest(rawBody)
      if (!req) {
        return fail(c, 'invalid_query', 'query is required and must be a string', 400)
      }

      const repo = new KbVectorRepository(c.env.DB, c.env.KB_VECTORIZE)
      const service = new KbSearchService(repo, c.env.AI)

      try {
        const hits = await service.search(req)
        const response: KbSearchResponse = {
          items: hits,
          query_id: crypto.randomUUID(),
          latency_ms: Date.now() - startTime,
        }
        return ok(c, response)
      } catch (err) {
        if (err instanceof KbSearchError) {
          const mapped = mapKbErrorToStatus(err)
          if (mapped.status >= 500) {
            console.error('[kb-search] service error:', err.code, err.message, err.cause)
          }
          return fail(c, mapped.code, mapped.message, mapped.status)
        }
        console.error('[kb-search] unexpected error:', err)
        return fail(c, 'internal_error', 'Internal error', 500)
      }
    },
  )

  // GET /documents/:doc_id — metadata only (no chunks, no body), auth required.
  app.get('/documents/:doc_id', authMiddleware, async (c) => {
    const docId = c.req.param('doc_id')
    if (!docId) return fail(c, 'invalid_param', 'doc_id is required', 400)

    const row = await c.env.DB
      .prepare(
        `SELECT doc_id, file_path, type, domain, category, status, version, owner,
                title, tags_json, relates_to_json, chunk_count, created_at, updated_at
           FROM kb_documents
          WHERE doc_id = ?1
          LIMIT 1`,
      )
      .bind(docId)
      .first<Record<string, unknown>>()

    if (!row) return fail(c, 'not_found', 'Document not found', 404)

    return ok(c, {
      doc_id: row.doc_id,
      file_path: row.file_path,
      type: row.type,
      domain: row.domain,
      category: row.category,
      status: row.status,
      version: row.version,
      owner: row.owner,
      title: row.title,
      tags: safeJsonParse(row.tags_json, []),
      relates_to: safeJsonParse(row.relates_to_json, []),
      chunk_count: row.chunk_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  })

  // GET /documents/:doc_id/chunks — admin only (raw chunk text exposure).
  app.get('/documents/:doc_id/chunks', authMiddleware, adminMiddleware, async (c) => {
    const docId = c.req.param('doc_id')
    if (!docId) return fail(c, 'invalid_param', 'doc_id is required', 400)

    const { results } = await c.env.DB
      .prepare(
        `SELECT chunk_id, chunk_index, heading_path, start_line, end_line, text,
                token_estimate, embedded_at
           FROM kb_chunks
          WHERE doc_id = ?1
          ORDER BY chunk_index ASC`,
      )
      .bind(docId)
      .all<Record<string, unknown>>()

    return ok(c, { doc_id: docId, chunks: results ?? [] })
  })

  // POST /upsert-vectors — Bulk vector sync endpoint (admin only).
  // Syncs embedding vectors to Vectorize via Worker binding.
  // Expected body: array of { id, values: number[], metadata } objects from embed-kb.ts
  // Expected header: x-api-key with admin token (pass any value for initial sync)
  app.post('/upsert-vectors', async (c) => {
    // Operational endpoint for Phase 1 bulk embedding sync.
    // In production, this should be protected by Cloudflare Access or similar.
    // For now, accept any API key (real auth will be added in Phase 4).
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) {
      return fail(c, 'unauthorized', 'x-api-key header required', 401)
    }
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return fail(c, 'invalid_body', 'Body must be valid JSON array', 400)
    }

    if (!Array.isArray(payload)) {
      return fail(c, 'invalid_body', 'Body must be an array of vectors', 400)
    }

    const vectors = payload.filter(
      (v): v is { id: string; values: number[]; metadata: Record<string, unknown> } =>
        v && typeof v.id === 'string' && Array.isArray(v.values) && typeof v.metadata === 'object',
    )

    if (vectors.length === 0) {
      return fail(c, 'invalid_body', 'No valid vectors in payload', 400)
    }

    try {
      const batchSize = 100
      let upsetCount = 0

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        // Use Worker binding to upsert (this avoids the REST API content-type issue)
        await c.env.KB_VECTORIZE.upsert(batch)
        upsetCount += batch.length
      }

      return ok(c, {
        message: 'Vectorize upsert complete',
        vectorsUpsetCount: upsetCount,
        batches: Math.ceil(upsetCount / batchSize),
      })
    } catch (err) {
      console.error('[kb-upsert-vectors] Error:', err)
      return fail(
        c,
        'vectorize_error',
        `Vectorize upsert failed: ${(err as Error).message}`,
        500,
      )
    }
  })

  parent.route('/api/knowledge-base', app)
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
