import { Hono } from 'hono'
import { safeLogContext } from '../../lib/log'
import type { Env } from '../../types'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { KbSyncChunkFields, KbSyncDocumentFields } from '../../types/knowledge-base'

/** A validated sync record (vector fields always present; D1 fields optional). */
type ValidRecord = {
  id: string
  values: number[]
  metadata: Record<string, unknown>
  document?: KbSyncDocumentFields
  chunk?: KbSyncChunkFields
}

function isValidRecord(v: unknown): v is ValidRecord {
  return (
    !!v &&
    typeof (v as ValidRecord).id === 'string' &&
    Array.isArray((v as ValidRecord).values) &&
    typeof (v as ValidRecord).metadata === 'object' &&
    (v as ValidRecord).metadata !== null
  )
}

/**
 * Write the D1 side of the sync (kb_documents + kb_chunks) for records that
 * carry the document/chunk fields. Idempotent: documents and chunks upsert by
 * primary key, and stale chunks (from a doc that shrank) are pruned using the
 * authoritative `chunk_count`. Returns the number of doc/chunk rows written.
 *
 * Why both stores: `kb_search` hydrates chunk text / file_path / title from D1
 * (kbVectorRepository.hydrateChunks). A vector with no D1 row is skipped during
 * hydration and never surfaces — so D1 must be populated with the vectors.
 */
async function writeD1Rows(
  db: D1Database,
  records: ValidRecord[],
): Promise<{ documentsUpserted: number; chunksUpserted: number }> {
  // De-dupe documents by doc_id (the fields repeat across a doc's chunks).
  const docsById = new Map<string, { docId: string; doc: KbSyncDocumentFields }>()
  const chunkStatements: D1PreparedStatement[] = []

  const DOC_SQL = `INSERT INTO kb_documents
      (doc_id, file_path, type, domain, category, status, version, owner, title,
       tags_json, relates_to_json, size_bytes, doc_hash, chunk_count, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
    ON CONFLICT(doc_id) DO UPDATE SET
      file_path = excluded.file_path, type = excluded.type, domain = excluded.domain,
      category = excluded.category, status = excluded.status, version = excluded.version,
      owner = excluded.owner, title = excluded.title, tags_json = excluded.tags_json,
      relates_to_json = excluded.relates_to_json, size_bytes = excluded.size_bytes,
      doc_hash = excluded.doc_hash, chunk_count = excluded.chunk_count,
      updated_at = excluded.updated_at`

  const CHUNK_SQL = `INSERT INTO kb_chunks
      (chunk_id, doc_id, chunk_index, heading_path, start_line, end_line, text,
       token_estimate, chunk_hash, vector_id, embedded_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ON CONFLICT(chunk_id) DO UPDATE SET
      doc_id = excluded.doc_id, chunk_index = excluded.chunk_index,
      heading_path = excluded.heading_path, start_line = excluded.start_line,
      end_line = excluded.end_line, text = excluded.text,
      token_estimate = excluded.token_estimate, chunk_hash = excluded.chunk_hash,
      vector_id = excluded.vector_id, embedded_at = excluded.embedded_at`

  const PRUNE_SQL = `DELETE FROM kb_chunks WHERE doc_id = ?1 AND chunk_index >= ?2`

  for (const r of records) {
    const docId = typeof r.metadata.doc_id === 'string' ? r.metadata.doc_id : undefined
    if (!docId || !r.document || !r.chunk) continue

    docsById.set(docId, { docId, doc: r.document })
    const c = r.chunk
    chunkStatements.push(
      db
        .prepare(CHUNK_SQL)
        .bind(
          r.id, // chunk_id == vector id
          docId,
          c.chunk_index,
          c.heading_path,
          c.start_line,
          c.end_line,
          c.text,
          c.token_estimate,
          c.chunk_hash,
          r.id, // vector_id == chunk_id
          c.embedded_at,
        ),
    )
  }

  if (docsById.size === 0) return { documentsUpserted: 0, chunksUpserted: 0 }

  const docStatements: D1PreparedStatement[] = []
  const pruneStatements: D1PreparedStatement[] = []
  for (const { docId, doc } of docsById.values()) {
    docStatements.push(
      db
        .prepare(DOC_SQL)
        .bind(
          docId,
          doc.file_path,
          doc.type,
          doc.domain,
          doc.category ?? null,
          doc.status,
          doc.version ?? null,
          doc.owner ?? null,
          doc.title,
          JSON.stringify(doc.tags ?? []),
          JSON.stringify(doc.relates_to ?? []),
          doc.size_bytes,
          doc.doc_hash,
          doc.chunk_count,
          doc.created_at,
          doc.updated_at,
        ),
    )
    // Prune chunks left over from a previous, longer version of this doc.
    pruneStatements.push(db.prepare(PRUNE_SQL).bind(docId, doc.chunk_count))
  }

  // Documents first (chunks FK-reference kb_documents), then chunks, then prune.
  await db.batch(docStatements)
  await db.batch(chunkStatements)
  await db.batch(pruneStatements)

  return { documentsUpserted: docStatements.length, chunksUpserted: chunkStatements.length }
}

/**
 * Delete chunk rows by chunk_id, then drop any parent document left with zero
 * chunks. Mirrors the Vectorize delete so the two stores don't drift. Returns
 * the number of chunk rows targeted for deletion.
 */
async function deleteD1Rows(db: D1Database, chunkIds: string[]): Promise<number> {
  if (chunkIds.length === 0) return 0

  // chunk_id == `${doc_id}#${index}` — derive the affected doc_ids.
  const docIds = new Set<string>()
  for (const id of chunkIds) {
    const hash = id.lastIndexOf('#')
    if (hash > 0) docIds.add(id.slice(0, hash))
  }

  const batchSize = 100
  for (let i = 0; i < chunkIds.length; i += batchSize) {
    const batch = chunkIds.slice(i, i + batchSize)
    const placeholders = batch.map((_, j) => `?${j + 1}`).join(',')
    await db
      .prepare(`DELETE FROM kb_chunks WHERE chunk_id IN (${placeholders})`)
      .bind(...batch)
      .run()
  }

  // Remove now-orphaned documents (no remaining chunks).
  const orphanCleanup: D1PreparedStatement[] = []
  for (const docId of docIds) {
    orphanCleanup.push(
      db
        .prepare(
          `DELETE FROM kb_documents
            WHERE doc_id = ?1
              AND NOT EXISTS (SELECT 1 FROM kb_chunks WHERE kb_chunks.doc_id = ?1)`,
        )
        .bind(docId),
    )
  }
  if (orphanCleanup.length > 0) await db.batch(orphanCleanup)

  return chunkIds.length
}

export function mountKbSyncRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.post('/kb-sync', async (c) => {
    const traceId = (c.get('trace_id') as string) || 'unknown'
    const adminKey = c.req.header('x-admin-key')
    const expectedKey = c.env.KB_ADMIN_KEY

    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return c.json(
        {
          ok: false,
          error: { code: 'unauthorized', message: 'x-admin-key header required and must match KB_ADMIN_KEY' },
          trace_id: traceId,
        },
        401,
      )
    }

    let vectors: unknown
    try {
      vectors = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be valid JSON array' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (!Array.isArray(vectors)) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be an array of vectors' },
          trace_id: traceId,
        },
        400,
      )
    }

    const validVectors = vectors.filter(isValidRecord)

    if (validVectors.length === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'No valid vectors in payload' },
          trace_id: traceId,
        },
        400,
      )
    }

    try {
      const batchSize = 100
      let totalUpserted = 0

      // Vectorize only accepts {id, values, metadata}; strip the D1-only fields
      // (document/chunk) that travel in the same record.
      for (let i = 0; i < validVectors.length; i += batchSize) {
        const batch = validVectors.slice(i, i + batchSize)
        const vectorBatch = batch.map((r) => ({
          id: r.id,
          values: r.values,
          metadata: r.metadata,
        }))
        await c.env.KB_VECTORIZE.upsert(vectorBatch as VectorizeVector[])
        totalUpserted += batch.length
      }

      // Persist the D1 side (kb_documents + kb_chunks) so search can hydrate.
      // Records without document/chunk fields (legacy vector-only payloads) are
      // skipped by writeD1Rows, preserving backward compatibility.
      let documentsUpserted = 0
      let chunksUpserted = 0
      if (c.env.DB) {
        const d1 = await writeD1Rows(c.env.DB, validVectors)
        documentsUpserted = d1.documentsUpserted
        chunksUpserted = d1.chunksUpserted
      }

      // Record sync timestamp for monitoring
      if (c.env.ACTIONS_KV) {
        await c.env.ACTIONS_KV.put('kb_sync_metadata', JSON.stringify({
          last_sync_at: Date.now(),
          vectors_upserted: totalUpserted,
          documents_upserted: documentsUpserted,
          chunks_upserted: chunksUpserted,
        }))
      }

      return c.json(
        {
          ok: true,
          data: {
            message: 'KB sync complete',
            vectors_upserted: totalUpserted,
            documents_upserted: documentsUpserted,
            chunks_upserted: chunksUpserted,
            batches: Math.ceil(totalUpserted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId, route: '[admin] kb-sync/upsert', errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'sync_error',
            message: `KB sync failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  app.post('/kb-sync-delete', async (c) => {
    const traceId = (c.get('trace_id') as string) || 'unknown'
    const adminKey = c.req.header('x-admin-key')
    const expectedKey = c.env.KB_ADMIN_KEY

    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return c.json(
        {
          ok: false,
          error: { code: 'unauthorized', message: 'x-admin-key header required and must match KB_ADMIN_KEY' },
          trace_id: traceId,
        },
        401,
      )
    }

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be valid JSON' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (!payload || typeof payload !== 'object' || !('vector_ids' in payload)) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must contain vector_ids array' },
          trace_id: traceId,
        },
        400,
      )
    }

    const vectorIds = (payload as Record<string, unknown>).vector_ids
    if (!Array.isArray(vectorIds) || !vectorIds.every((id): id is string => typeof id === 'string')) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'vector_ids must be an array of strings' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (vectorIds.length === 0) {
      return c.json(
        {
          ok: true,
          data: {
            message: 'No vectors to delete',
            vectors_deleted: 0,
            batches: 0,
          },
          trace_id: traceId,
        },
        200,
      )
    }

    try {
      const batchSize = 100
      let totalDeleted = 0

      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize)
        await c.env.KB_VECTORIZE.deleteByIds(batch)
        totalDeleted += batch.length
      }

      // Keep D1 consistent with Vectorize: remove the chunk rows, then any
      // document left with zero chunks. vector_id == chunk_id == `${doc_id}#N`.
      let chunksDeleted = 0
      if (c.env.DB) {
        chunksDeleted = await deleteD1Rows(c.env.DB, vectorIds)
      }

      // Record sync timestamp for monitoring
      if (c.env.ACTIONS_KV && totalDeleted > 0) {
        const current = await c.env.ACTIONS_KV.get('kb_sync_metadata')
        const metadata = current ? JSON.parse(current) : {}
        await c.env.ACTIONS_KV.put('kb_sync_metadata', JSON.stringify({
          ...metadata,
          last_sync_at: Date.now(),
          last_operation: 'delete',
        }))
      }

      return c.json(
        {
          ok: true,
          data: {
            message: 'KB delete complete',
            vectors_deleted: totalDeleted,
            chunks_deleted: chunksDeleted,
            batches: Math.ceil(totalDeleted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId, route: '[admin] kb-sync/delete', errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'sync_error',
            message: `KB delete failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // Platform-admin only — the Ops tab reads this via api() with a Bearer token.
  // Previously unguarded, which leaked sync metadata to unauthenticated callers.
  app.get('/kb-sync/status', authMiddleware, adminMiddleware, async (c) => {
    if (!c.env.ACTIONS_KV) {
      return c.json(
        {
          ok: true,
          data: { message: 'KB sync status unavailable', last_sync_at: null },
        },
        200,
      )
    }

    const metadata = await c.env.ACTIONS_KV.get('kb_sync_metadata')
    if (!metadata) {
      return c.json(
        {
          ok: true,
          data: { message: 'KB has not been synced', last_sync_at: null },
        },
        200,
      )
    }

    return c.json(
      {
        ok: true,
        data: JSON.parse(metadata),
      },
      200,
    )
  })
}
