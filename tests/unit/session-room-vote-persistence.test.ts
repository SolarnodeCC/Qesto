/**
 * Requirement: ADR-0049 (verifiable voting receipt / tally integrity) — vote flush to D1 and KV is idempotent.
 * Vote flush persistence — regression guard for the multi-vote under-count bug
 * (migration 0080 + supersede handling).
 *
 * Before the fix, the votes table's UNIQUE(question_id, voter_id) key let only
 * one row per voter per question survive; the flush swallowed the resulting
 * UNIQUE error, so multi_select/upvote/word_cloud recaps under-counted. Widening
 * the key to (question_id, voter_id, option_id) fixes that but, on its own, would
 * double-count a vote_policy='multi' change-your-answer — so the flush also
 * deletes the superseded row. These tests exercise both behaviours against a
 * minimal D1 fake that models the widened key.
 *
 * DD-12: the fake now models two more real-D1 behaviours the flush depends on
 * after batching. `bind()` returns a NEW statement rather than mutating a shared
 * one (Cloudflare's D1PreparedStatement is immutable — the previous fake
 * returned `this`, which silently aliased every statement pushed into a batch),
 * and `batch()` applies an array of statements in order. `INSERT OR IGNORE` is
 * modelled as a no-op on conflict instead of the old throw-and-string-match.
 */
import { describe, it, expect } from 'vitest'
import { flushVotesToD1AndKV, type VoteFlushState } from '../../functions/api/lib/session-room-persistence'
import { K_META } from '../../functions/api/lib/session-room-storage-keys'
import type { BufferedVote } from '../../functions/api/lib/session-room-types'
import type { Env } from '../../functions/api/types'

type VoteRow = {
  id: string
  session_id: string
  question_id: string
  voter_id: string
  option_id: string
  submitted_at: number
}

// Minimal D1 fake — implements only the two statements flushVotesToD1AndKV
// issues, with the WIDENED UNIQUE(question_id, voter_id, option_id) semantics.
class FakeD1 {
  rows: VoteRow[] = []
  /** DD-12: how many round-trips the flush actually cost. */
  batchCalls = 0
  statementsRun = 0

  prepare(sql: string) {
    return new FakeStmt(this, sql.trim())
  }

  /** Real D1 applies a batch in order, atomically. */
  async batch(statements: FakeStmt[]): Promise<Array<{ meta: { changes: number } }>> {
    this.batchCalls++
    const out: Array<{ meta: { changes: number } }> = []
    for (const stmt of statements) out.push(await stmt.run())
    return out
  }
}

class FakeStmt {
  constructor(
    private readonly db: FakeD1,
    private readonly sql: string,
    private readonly args: readonly unknown[] = [],
  ) {}

  /**
   * Real D1 returns a NEW statement from bind() — the prepared statement is
   * immutable. Returning `this` (as this fake previously did) aliases every
   * statement derived from the same prepare() call, so a batch built by pushing
   * `stmt.bind(...)` would collapse to N copies of the last binding.
   */
  bind(...args: unknown[]): FakeStmt {
    return new FakeStmt(this.db, this.sql, args)
  }

  async run(): Promise<{ meta: { changes: number } }> {
    this.db.statementsRun++
    if (this.sql.startsWith('INSERT OR IGNORE INTO votes')) {
      const [id, session_id, question_id, voter_id, option_id, submitted_at] = this.args as [
        string, string, string, string, string, number,
      ]
      if (
        this.db.rows.some(
          (r) => r.question_id === question_id && r.voter_id === voter_id && r.option_id === option_id,
        )
      ) {
        // OR IGNORE: a conflicting row is skipped, not an error.
        return { meta: { changes: 0 } }
      }
      this.db.rows.push({ id, session_id, question_id, voter_id, option_id, submitted_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM votes WHERE question_id')) {
      const [question_id, voter_id, option_id] = this.args as [string, string, string]
      const before = this.db.rows.length
      this.db.rows = this.db.rows.filter(
        (r) => !(r.question_id === question_id && r.voter_id === voter_id && r.option_id === option_id),
      )
      return { meta: { changes: before - this.db.rows.length } }
    }
    throw new Error(`FakeD1: unexpected SQL: ${this.sql}`)
  }
}

function makeStorage() {
  const map = new Map<string, unknown>()
  map.set(K_META, { sessionId: 's1', teamId: null })
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, value)
    },
  }
}

function makeState(buffer: BufferedVote[]): VoteFlushState {
  return { voteBuffer: buffer, lastFlushAt: 0, flushScheduled: true, _voters: {}, _counts: {} }
}

function envWith(db: FakeD1): Env {
  // SESSIONS_KV / METRICS_AE intentionally absent — the flush tolerates both.
  return { DB: db } as unknown as Env
}

function optionsFor(db: FakeD1, voterId: string): string[] {
  return db.rows.filter((r) => r.voter_id === voterId).map((r) => r.option_id).sort()
}

describe('flushVotesToD1AndKV — multi-vote persistence', () => {
  it('persists every option a multi_select voter selects (was under-counted under the old key)', async () => {
    const db = new FakeD1()
    const buffer: BufferedVote[] = [
      { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 1 },
      { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'b', submittedAt: 2 },
      { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'c', submittedAt: 3 },
    ]
    await flushVotesToD1AndKV(makeStorage(), envWith(db), makeState(buffer))
    expect(optionsFor(db, 'v1')).toEqual(['a', 'b', 'c'])
  })

  it("keeps only the final choice for a vote_policy='multi' change-your-answer (supersede across flushes)", async () => {
    const db = new FakeD1()
    // Flush 1: voter picks A.
    await flushVotesToD1AndKV(
      makeStorage(),
      envWith(db),
      makeState([{ sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 1 }]),
    )
    // Flush 2: voter changes to B, superseding the already-persisted A.
    await flushVotesToD1AndKV(
      makeStorage(),
      envWith(db),
      makeState([
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'b', submittedAt: 2, supersedesOptionId: 'a' },
      ]),
    )
    expect(optionsFor(db, 'v1')).toEqual(['b'])
  })

  it('resolves supersede in buffer order within one flush (A→B→A ends at A)', async () => {
    const db = new FakeD1()
    await flushVotesToD1AndKV(
      makeStorage(),
      envWith(db),
      makeState([
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 1 },
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'b', submittedAt: 2, supersedesOptionId: 'a' },
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 3, supersedesOptionId: 'b' },
      ]),
    )
    expect(optionsFor(db, 'v1')).toEqual(['a'])
  })

  it('is idempotent on re-flush of the same buffer (no duplicate rows, no throw)', async () => {
    const db = new FakeD1()
    const storage = makeStorage()
    const mk = () =>
      makeState([
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 1 },
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'b', submittedAt: 2 },
      ])
    await flushVotesToD1AndKV(storage, envWith(db), mk())
    await flushVotesToD1AndKV(storage, envWith(db), mk())
    expect(optionsFor(db, 'v1')).toEqual(['a', 'b'])
  })

  it('keeps distinct voters independent when superseding', async () => {
    const db = new FakeD1()
    // v1 picks A then supersedes to B; v2 independently picks A and keeps it.
    await flushVotesToD1AndKV(
      makeStorage(),
      envWith(db),
      makeState([
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'a', submittedAt: 1 },
        { sessionId: 's1', questionId: 'q1', voterId: 'v2', optionId: 'a', submittedAt: 2 },
        { sessionId: 's1', questionId: 'q1', voterId: 'v1', optionId: 'b', submittedAt: 3, supersedesOptionId: 'a' },
      ]),
    )
    expect(optionsFor(db, 'v1')).toEqual(['b'])
    expect(optionsFor(db, 'v2')).toEqual(['a'])
  })

  it('DD-12: collapses a large flush into batched round-trips, not one per vote', async () => {
    const db = new FakeD1()
    // 250 distinct voters on one question — half of the `starter` plan's
    // 500-participant cap. Under the pre-DD-12 loop this cost 250 sequential
    // awaited .run() calls inside a single 5s flush window.
    const buffer: BufferedVote[] = Array.from({ length: 250 }, (_, i) => ({
      sessionId: 's1',
      questionId: 'q1',
      voterId: `v${i}`,
      optionId: 'a',
      submittedAt: i,
    }))

    await flushVotesToD1AndKV(makeStorage(), envWith(db), makeState(buffer))

    expect(db.rows).toHaveLength(250)
    // 250 statements at VOTE_FLUSH_BATCH_SIZE=100 → 3 batches, not 250 trips.
    expect(db.batchCalls).toBe(3)
    expect(db.statementsRun).toBe(250)
  })
})
