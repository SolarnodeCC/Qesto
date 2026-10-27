/**
 * Requirement: issue #876 (DD-03) — the per-session voter salt is destroyed at
 * close, in the same write that closes the session, so stored voter ids become
 * permanently un-invertible. It is replaced (not NULLed) so the pre-0082 legacy
 * derivation can never be triggered for a post-0082 session. Also covers
 * issue #912 (DD-40): the close is one atomic batch with the final votes.
 */
import { describe, expect, it } from 'vitest'
import {
  closeSessionWithVotes,
  markSessionClosed,
} from '../../functions/api/repositories/sessionLifecycleRepository'

function captureDb() {
  const calls: Array<{ sql: string; binds: unknown[] }> = []
  const db = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          return {
            async run() {
              calls.push({ sql, binds })
              return { success: true }
            },
          }
        },
      }
    },
  }
  return { db: db as unknown as D1Database, calls }
}

describe('markSessionClosed (DD-03)', () => {
  it('closes and overwrites a non-null voter_salt with fresh random bytes in one statement', async () => {
    const { db, calls } = captureDb()
    await markSessionClosed(db, 's1', 'owner', 123)
    expect(calls).toHaveLength(1)
    const { sql, binds } = calls[0]!
    expect(sql).toMatch(/status = 'closed'/)
    expect(sql).toMatch(/voter_salt = CASE WHEN voter_salt IS NULL THEN NULL ELSE \?4 END/)
    expect(binds.slice(0, 3)).toEqual([123, 's1', 'owner'])
    expect(binds[3]).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses a different replacement salt every close', async () => {
    const a = captureDb()
    const b = captureDb()
    await markSessionClosed(a.db, 's1', 'o', 1)
    await markSessionClosed(b.db, 's1', 'o', 1)
    expect(a.calls[0]!.binds[3]).not.toBe(b.calls[0]!.binds[3])
  })
})

// DD-40 (issue #912): final votes and the closed status are one atomic batch.
describe('closeSessionWithVotes (DD-40)', () => {
  it('submits vote inserts and the close UPDATE in a single db.batch', async () => {
    const batches: Array<Array<{ sql: string; binds: unknown[] }>> = []
    const db = {
      prepare(sql: string) {
        return { bind: (...binds: unknown[]) => ({ sql, binds }) }
      },
      async batch(stmts: Array<{ sql: string; binds: unknown[] }>) {
        batches.push(stmts)
        return stmts.map(() => ({ meta: { changes: 1 } }))
      },
    } as unknown as D1Database
    await closeSessionWithVotes(db, {
      sessionId: 's1',
      ownerId: 'o1',
      closedAt: 5,
      questionId: 'q1',
      votes: [
        { voterId: 'v1', optionId: 'a' },
        { voterId: 'v2', optionId: 'b' },
      ],
    })
    expect(batches).toHaveLength(1)
    const sqls = batches[0]!.map((s) => s.sql)
    expect(sqls.filter((s) => s.includes('INSERT OR IGNORE INTO votes'))).toHaveLength(2)
    expect(sqls[sqls.length - 1]).toMatch(/UPDATE sessions SET status = 'closed'/)
  })
})
