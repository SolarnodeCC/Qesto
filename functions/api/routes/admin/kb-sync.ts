import { Hono } from 'hono'
import { safeLogContext } from '../../lib/log'
import type { Env } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { AdminVariables } from '../../middleware/admin'
import {
  deleteKbSyncD1Rows,
  isKbSyncValidRecord,
  writeKbSyncD1Rows,
} from '../../lib/kb-sync-d1'

function unauthorized(traceId: string) {
  return {
    body: {
      ok: false as const,
      error: { code: 'unauthorized', message: 'x-admin-key header required and must match KB_ADMIN_KEY' },
      trace_id: traceId,
    },
    status: 401 as const,
  }
}

type AdminKeyDenied = ReturnType<typeof unauthorized>

function verifyAdminKey(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
  traceId: string,
): { allowed: true } | { allowed: false; denied: AdminKeyDenied } {
  const adminKey = c.req.header('x-admin-key')
  const expectedKey = c.env.KB_ADMIN_KEY
  if (!adminKey || !expectedKey || adminKey !== expectedKey) {
    return { allowed: false, denied: unauthorized(traceId) }
  }
  return { allowed: true }
}

export function mountKbSyncRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.post('/kb-sync', async (c) => {
    const traceId = (c.get('trace_id') as string) || 'unknown'
    const auth = verifyAdminKey(c, traceId)
    if (!auth.allowed) return c.json(auth.denied.body, auth.denied.status)

    let vectors: unknown
    try {
      vectors = await c.req.json()
    } catch {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'Body must be valid JSON array' }, trace_id: traceId },
        400,
      )
    }

    if (!Array.isArray(vectors)) {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'Body must be an array of vectors' }, trace_id: traceId },
        400,
      )
    }

    const validVectors = vectors.filter(isKbSyncValidRecord)
    if (validVectors.length === 0) {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'No valid vectors in payload' }, trace_id: traceId },
        400,
      )
    }

    try {
      const batchSize = 100
      let totalUpserted = 0

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

      let documentsUpserted = 0
      let chunksUpserted = 0
      if (c.env.DB) {
        const d1 = await writeKbSyncD1Rows(c.env.DB, validVectors)
        documentsUpserted = d1.documentsUpserted
        chunksUpserted = d1.chunksUpserted
      }

      if (c.env.ACTIONS_KV) {
        await c.env.ACTIONS_KV.put(
          'kb_sync_metadata',
          JSON.stringify({
            last_sync_at: Date.now(),
            vectors_upserted: totalUpserted,
            documents_upserted: documentsUpserted,
            chunks_upserted: chunksUpserted,
          }),
        )
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
      safeLogContext(err, {
        traceId,
        route: '[admin] kb-sync/upsert',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        statusCode: 500,
      })
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
    const auth = verifyAdminKey(c, traceId)
    if (!auth.allowed) return c.json(auth.denied.body, auth.denied.status)

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'Body must be valid JSON' }, trace_id: traceId },
        400,
      )
    }

    if (!payload || typeof payload !== 'object' || !('vector_ids' in payload)) {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'Body must contain vector_ids array' }, trace_id: traceId },
        400,
      )
    }

    const vectorIds = (payload as Record<string, unknown>).vector_ids
    if (!Array.isArray(vectorIds) || !vectorIds.every((id): id is string => typeof id === 'string')) {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'vector_ids must be an array of strings' }, trace_id: traceId },
        400,
      )
    }

    if (vectorIds.length === 0) {
      return c.json(
        { ok: true, data: { message: 'No vectors to delete', vectors_deleted: 0, batches: 0 }, trace_id: traceId },
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

      let chunksDeleted = 0
      if (c.env.DB) {
        chunksDeleted = await deleteKbSyncD1Rows(c.env.DB, vectorIds)
      }

      if (c.env.ACTIONS_KV && totalDeleted > 0) {
        const current = await c.env.ACTIONS_KV.get('kb_sync_metadata')
        const metadata = current ? JSON.parse(current) : {}
        await c.env.ACTIONS_KV.put(
          'kb_sync_metadata',
          JSON.stringify({ ...metadata, last_sync_at: Date.now(), last_operation: 'delete' }),
        )
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
      safeLogContext(err, {
        traceId,
        route: '[admin] kb-sync/delete',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        statusCode: 500,
      })
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

  app.get('/kb-sync/status', async (c) => {
    if (!c.env.ACTIONS_KV) {
      return c.json({ ok: true, data: { message: 'KB sync status unavailable', last_sync_at: null } }, 200)
    }

    const metadata = await c.env.ACTIONS_KV.get('kb_sync_metadata')
    if (!metadata) {
      return c.json({ ok: true, data: { message: 'KB has not been synced', last_sync_at: null } }, 200)
    }

    return c.json({ ok: true, data: JSON.parse(metadata) }, 200)
  })
}
