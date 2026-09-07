import { describe, expect, it } from 'vitest'
import {
  deleteTeamSessionVectors,
  hardDeleteSession,
} from '../../functions/api/lib/session-delete'

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

describe('deleteTeamSessionVectors — team cascade (audit #12)', () => {
  function dbWithSessions(ids: string[]) {
    return {
      prepare() {
        return {
          bind: () => ({ all: async () => ({ results: ids.map((id) => ({ id })) }) }),
        }
      },
    } as unknown as D1Database
  }

  it('deletes every vector belonging to the team\'s sessions', async () => {
    const { vec, deleted } = makeVectorize()
    const n = await deleteTeamSessionVectors(dbWithSessions(['s1', 's2', 's3']), vec, 'team-1')
    expect(n).toBe(3)
    expect(deleted).toEqual([['s1', 's2', 's3']])
  })

  it('batches at 100 ids per delete call', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const { vec, deleted } = makeVectorize()
    const n = await deleteTeamSessionVectors(dbWithSessions(ids), vec, 'team-1')
    expect(n).toBe(250)
    expect(deleted.map((b) => b.length)).toEqual([100, 100, 50])
  })

  it('is a no-op without a Vectorize binding', async () => {
    expect(await deleteTeamSessionVectors(dbWithSessions(['s1']), undefined, 'team-1')).toBe(0)
  })

  it('returns 0 rather than throwing when the purge fails', async () => {
    const failing = {
      async deleteByIds() {
        throw new Error('vectorize unavailable')
      },
    } as unknown as VectorizeIndex
    // A purge problem must never block the team deletion that follows it.
    expect(await deleteTeamSessionVectors(dbWithSessions(['s1']), failing, 'team-1')).toBe(0)
  })

  it('returns 0 when the team has no sessions', async () => {
    const { vec, deleted } = makeVectorize()
    expect(await deleteTeamSessionVectors(dbWithSessions([]), vec, 'team-1')).toBe(0)
    expect(deleted).toEqual([])
  })
})
