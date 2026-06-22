import { describe, it, expect, vi } from 'vitest'
import { deleteUserGdprData } from '../../functions/api/lib/gdpr-delete-user'

// Mock D1: the owner-sessions SELECT returns two sessions; batch() (used by
// hardDeleteSession) reports a change; all other statements are inert.
function makeDb(sessionIds: string[]) {
  const stmt = {
    bind() {
      return stmt
    },
    async all<T>() {
      return { results: sessionIds.map((id) => ({ id })) as unknown as T[] }
    },
    async first<T>() {
      return null as T
    },
    async run() {
      return { meta: { changes: 1 } }
    },
  }
  return {
    prepare: () => stmt,
    // last statement in hardDeleteSession's batch carries changes > 0
    batch: async (stmts: unknown[]) => stmts.map(() => ({ meta: { changes: 1 } })),
  } as unknown as D1Database
}

function makeKv() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as KVNamespace
}

describe('deleteUserGdprData — third privacy layer (vectors)', () => {
  it('purges DECISIONS_VECTORIZE by the user session ids and never touches HELP_VECTORIZE', async () => {
    const deleteByIds = vi.fn().mockResolvedValue({ count: 2 })
    const result = await deleteUserGdprData(
      {
        DB: makeDb(['s1', 's2']),
        USERS_KV: makeKv(),
        TEAMS_KV: makeKv(),
        DECISIONS_VECTORIZE: { deleteByIds } as unknown as VectorizeIndex,
      },
      'user-123',
    )
    expect(deleteByIds).toHaveBeenCalledTimes(1)
    expect(deleteByIds).toHaveBeenCalledWith(['s1', 's2'])
    expect(result.vectorsDeleted).toBe(2)
    expect(result.sessionsDeleted).toBe(2)
  })

  it('is a no-op on the vector layer when there are no sessions', async () => {
    const deleteByIds = vi.fn()
    const result = await deleteUserGdprData(
      {
        DB: makeDb([]),
        USERS_KV: makeKv(),
        TEAMS_KV: makeKv(),
        DECISIONS_VECTORIZE: { deleteByIds } as unknown as VectorizeIndex,
      },
      'user-123',
    )
    expect(deleteByIds).not.toHaveBeenCalled()
    expect(result.vectorsDeleted).toBe(0)
  })

  it('still deletes D1/KV data when the vector binding is absent (backward compatible)', async () => {
    const result = await deleteUserGdprData(
      { DB: makeDb(['s1']), USERS_KV: makeKv(), TEAMS_KV: makeKv() },
      'user-123',
    )
    expect(result.sessionsDeleted).toBe(1)
    expect(result.vectorsDeleted).toBe(0)
  })

  it('swallows a vector-purge failure so the legal-floor deletion still completes', async () => {
    const deleteByIds = vi.fn().mockRejectedValue(new Error('vectorize down'))
    const result = await deleteUserGdprData(
      {
        DB: makeDb(['s1']),
        USERS_KV: makeKv(),
        TEAMS_KV: makeKv(),
        DECISIONS_VECTORIZE: { deleteByIds } as unknown as VectorizeIndex,
      },
      'user-123',
    )
    expect(result.vectorsDeleted).toBe(0)
    expect(result.sessionsDeleted).toBe(1)
  })
})
