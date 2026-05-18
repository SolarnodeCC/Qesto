// Knowledge-Base Search API (Phase 5)
//
// Routes:
//   GET /api/kb-search?q=...          — Semantic search against KB vectors
//   GET /api/kb-search/:doc-id        — Fetch full KB document by ID
//
// Search uses Cloudflare Vectorize for similarity matching.
// Results include metadata (doc_id, chunk_id, type, domain, heading_path).

import { Hono } from 'hono'
import type { Env } from '../types'
import { ulid } from '../lib/ulid'
import { validateData, AiEmbeddingResponseSchema, VectorMetadataSchema } from '../lib/validators'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KBSearchResult {
  id: string
  score: number
  metadata: {
    doc_id: string
    chunk_id: string
    type?: string
    domain?: string
    status?: string
    tags?: string[]
    heading_path?: string
  }
  content?: string
}

export interface KBSearchResponse {
  ok: boolean
  data: {
    query: string
    results: KBSearchResult[]
    total: number
    elapsed_ms: number
  }
  trace_id: string
}

// ─── Routes ────────────────────────────────────────────────────────────────────

export function registerKBRoutes(parent: Hono<{ Bindings: Env }>) {
  const app = new Hono<{ Bindings: Env }>()

  // GET /api/kb-search?q=...
  // Semantic search against KB vectors using Vectorize.
  app.get('/search', async (c) => {
    const traceId = ulid()
    c.set('trace_id', traceId)

    const query = c.req.query('q')
    const topK = Math.min(parseInt(c.req.query('topK') ?? '10'), 50)

    if (!query || query.trim().length === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_query', message: 'Query parameter q is required and must not be empty' },
          trace_id: traceId,
        },
        400,
      )
    }

    const startTime = Date.now()

    try {
      // Generate embedding for the query using Workers AI
      const aiResponse = await c.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: query,
      })

      const validated = validateData(aiResponse, AiEmbeddingResponseSchema)
      if (!validated?.data) {
        throw new Error('Invalid AI response format')
      }

      const queryEmbedding = validated.data

      // Query Vectorize with the embedding
      const vectorizeResults = await c.env.KB_VECTORIZE.query(queryEmbedding, { topK })

      const results: KBSearchResult[] = vectorizeResults.map((match) => {
        const meta = validateData(match.metadata || {}, VectorMetadataSchema) ?? {}
        return {
          id: match.id,
          score: match.score,
          metadata: meta as KBSearchResult['metadata'],
          content: typeof meta.content === 'string' ? meta.content : undefined,
        }
      })

      return c.json(
        {
          ok: true,
          data: {
            query,
            results,
            total: results.length,
            elapsed_ms: Date.now() - startTime,
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      console.error('[kb-search] Error:', err)
      return c.json(
        {
          ok: false,
          error: {
            code: 'search_error',
            message: `Search failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // GET /api/kb-search/doc/:doc-id
  // Fetch KB document metadata by doc_id.
  // Note: Full document content stored in Vectorize metadata is subject to size limits.
  app.get('/doc/:doc_id', async (c) => {
    const traceId = ulid()
    c.set('trace_id', traceId)

    const docId = c.req.param('doc_id')

    if (!docId || docId.trim().length === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_param', message: 'doc_id parameter is required' },
          trace_id: traceId,
        },
        400,
      )
    }

    try {
      // Query Vectorize for all vectors matching this doc_id
      // This is a workaround since Vectorize doesn't support metadata filtering directly
      // In production, you'd store doc metadata in a separate D1 table
      const placeholder = new Array(1024).fill(0)
      const vectorizeResults = await c.env.KB_VECTORIZE.query(placeholder, { topK: 100 })

      const docChunks = vectorizeResults
        .filter((match) => (match.metadata as unknown as Record<string, unknown>)?.doc_id === docId)
        .sort((a, b) => {
          const aChunk = parseInt((a.metadata as unknown as Record<string, unknown>)?.chunk_id as string) || 0
          const bChunk = parseInt((b.metadata as unknown as Record<string, unknown>)?.chunk_id as string) || 0
          return aChunk - bChunk
        })

      if (docChunks.length === 0) {
        return c.json(
          {
            ok: false,
            error: { code: 'not_found', message: `Document ${docId} not found in knowledge base` },
            trace_id: traceId,
          },
          404,
        )
      }

      return c.json(
        {
          ok: true,
          data: {
            doc_id: docId,
            chunks: docChunks.map((chunk) => ({
              id: chunk.id,
              metadata: chunk.metadata,
              content: (chunk.metadata as unknown as Record<string, unknown>)?.content,
            })),
            total_chunks: docChunks.length,
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      console.error('[kb-search] Error:', err)
      return c.json(
        {
          ok: false,
          error: {
            code: 'search_error',
            message: `Lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  parent.route('/api/kb', app)
}
