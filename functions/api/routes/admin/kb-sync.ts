import { Hono } from 'hono'
import { safeLogContext } from '../../lib/log'
import type { Env } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { AdminVariables } from '../../middleware/admin'

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

    const validVectors = vectors.filter(
      (v): v is { id: string; values: number[]; metadata: Record<string, unknown> } =>
        v && typeof v.id === 'string' && Array.isArray(v.values) && typeof v.metadata === 'object',
    )

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

      for (let i = 0; i < validVectors.length; i += batchSize) {
        const batch = validVectors.slice(i, i + batchSize)
        await c.env.KB_VECTORIZE.upsert(batch as VectorizeVector[])
        totalUpserted += batch.length
      }

      return c.json(
        {
          ok: true,
          data: {
            message: 'Vectorize upsert complete',
            vectors_upserted: totalUpserted,
            batches: Math.ceil(totalUpserted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId, route: '[admin] kb-sync/vectorize-upsert', errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'vectorize_error',
            message: `Vectorize upsert failed: ${err instanceof Error ? err.message : 'unknown error'}`,
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

      return c.json(
        {
          ok: true,
          data: {
            message: 'Vectorize delete complete',
            vectors_deleted: totalDeleted,
            batches: Math.ceil(totalDeleted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId, route: '[admin] kb-sync/vectorize-delete', errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'vectorize_error',
            message: `Vectorize delete failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })
}
