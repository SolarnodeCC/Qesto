import { describe, expect, it } from 'vitest'
import { hardDeleteSession } from '../../functions/api/lib/session-delete'

/** Minimal D1 stub: records batched SQL and reports one change on the last one. */
function makeDb(changes = 1) {
  const seen: string[] = []
  const db = {
    prepare(sql: string) {
      seen.push(sql.trim())
      return { bind: () => ({ __sql: sql }) }
    },
    async batch(stmts: unknown[]) {
      return stmts.map((_, i) => ({ meta: { changes: i === stmts.length - 1 ? changes : 1 } }))
    },
  } as unknown as D1Database
  return { db, seen }
}

function makeVectorize() {
  const deleted: string[][] = []
  const vec = {
    async deleteByIds(ids: string[]) {
      deleted.push(ids)
      return { mutationId: 'm', count: ids.length }
    },
  } as unknown as VectorizeIndex
  return { vec, deleted }
}

describe('hardDeleteSession — decision-vector cascade (audit #12)', () => {
  it('deletes the session vector alongside the D1 rows', async () => {
    const { db } = makeDb()
    const { vec, deleted } = makeVectorize()

    const res = await hardDeleteSession(db, 'sess-1', 'user-1', vec)

    expect(res.deleted).toBe(true)
    expect(deleted).toEqual([['sess-1']])
  })

  it('still deletes the D1 rows when the vector delete throws', async () => {
    const { db } = makeDb()
    const failing = {
      async deleteByIds() {
        throw new Error('vectorize unavailable')
      },
    } as unknown as VectorizeIndex

    const res = await hardDeleteSession(db, 'sess-1', 'user-1', failing)

    // The durable-record deletion is the legal floor and must not be blocked.
    expect(res.deleted).toBe(true)
  })

  it('remains callable without a Vectorize binding', async () => {
    const { db } = makeDb()
    const res = await hardDeleteSession(db, 'sess-1', 'user-1')
    expect(res.deleted).toBe(true)
  })

  it('reports not-deleted when the session did not belong to the caller', async () => {
    const { db } = makeDb(0)
    const { vec } = makeVectorize()
    const res = await hardDeleteSession(db, 'sess-1', 'other-user', vec)
    expect(res.deleted).toBe(false)
  })
})
