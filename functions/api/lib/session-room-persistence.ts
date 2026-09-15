import { absent } from './absent'
/**
 * Vote flush + R2 snapshot/hydrate helpers extracted from SessionRoom (TD-01).
 */

import type { LiveEnergizerState, LiveQuestion } from '../realtime'
import type { Env } from '../types'
import { logEvent } from './log'
import { writeKvJson } from './kv'
import { writeEvent } from './observability'
import {
  K_META,
  K_QUESTION,
  K_QUESTIONS,
  K_QUESTION_INDEX,
  K_PENDING_RESPONSES,
  K_COUNTS,
  K_VOTERS,
  K_STATUS,
  K_ACTIVE_ENERGIZER,
} from './session-room-storage-keys'
import type { Meta, Counts, Votes, BufferedVote } from './session-room-types'
/**
 * DD-12 — statements per D1 batch. Comfortably under D1's per-batch ceiling
 * while still collapsing a full 500-voter flush into a handful of round-trips
 * instead of ~1000.
 */
export const VOTE_FLUSH_BATCH_SIZE = 100

export interface SessionRoomStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

export interface VoteFlushState {
  voteBuffer: BufferedVote[]
  lastFlushAt: number
  flushScheduled: boolean
  _voters: Votes | null
  _counts: Counts | null
}

interface SnapshotData {
  questions: LiveQuestion[] | undefined
  questionIndex: number | undefined
  currentQuestion: LiveQuestion | undefined
  counts: Counts | undefined
  voters: Votes | undefined
  pendingResponses: unknown[] | undefined
  activeEnergizer: LiveEnergizerState | null | undefined
  status: string | undefined
}

// Parse-then-narrow at the R2 trust boundary — never cast a JSON.parse result
// straight into the snapshot shape.
function parseSnapshot(raw: string): SnapshotData | null {
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return absent()
  }
  if (!v || typeof v !== 'object') return absent()
  const o = v as Record<string, unknown>
  return {
    questions: Array.isArray(o.questions) ? (o.questions as LiveQuestion[]) : undefined,
    questionIndex: typeof o.questionIndex === 'number' ? o.questionIndex : undefined,
    currentQuestion: (o.currentQuestion as LiveQuestion | undefined) ?? undefined,
    counts: (o.counts as Counts | undefined) ?? undefined,
    voters: (o.voters as Votes | undefined) ?? undefined,
    pendingResponses: Array.isArray(o.pendingResponses) ? o.pendingResponses : undefined,
    activeEnergizer: (o.activeEnergizer as LiveEnergizerState | null | undefined) ?? undefined,
    status: typeof o.status === 'string' ? o.status : undefined,
  }
}

export async function flushVotesToD1AndKV(
  storage: SessionRoomStorage,
  env: Env,
  state: VoteFlushState,
): Promise<void> {
  if (state.voteBuffer.length === 0) {
    state.flushScheduled = false
    return
  }

  const meta = await storage.get<Meta>(K_META)
  if (!meta) return

  const startMs = Date.now()
  try {
    // DD-12: this loop used to await each statement individually — up to two
    // sequential D1 round-trips per buffered vote. At the `starter` plan's
    // 500-participant cap that is ~1000 serialised calls inside one 5s flush
    // window (FLUSH_INTERVAL_MS); at 5-15ms each the flush cannot keep pace with
    // its own interval, the buffer grows unboundedly, and the DO's single
    // threaded event loop stalls — delaying broadcasts to every connected
    // socket. This is the hottest path in the product and the most visible way
    // it can fail: live, on stage, mid-session.
    //
    // D1 has no interactive transactions, so `batch()` is the only primitive
    // that both pipelines the statements and applies them atomically. Ordering
    // within a batch is preserved, so per-voter supersede (delete old -> insert
    // new) stays correct even for A->B->A inside a single window.
    const insertStmt = env.DB.prepare(
      // INSERT OR IGNORE replaces the previous catch-and-string-match on
      // "UNIQUE constraint failed". Post-widening (migration 0080) the UNIQUE key
      // is (question_id, voter_id, option_id), so a collision only ever means an
      // idempotent re-flush after a partial failure — exactly what IGNORE is
      // for. Matching on an engine error message inside a batch is not possible
      // anyway, since one conflicting row would roll the whole batch back.
      'INSERT OR IGNORE INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    // vote_policy='multi' change-your-answer: remove the voter's superseded
    // option row (scoped to the exact (question, voter, option) identity) before
    // inserting their new choice, so the durable projection keeps only the final
    // pick. Idempotent — deleting a not-yet-flushed old option is a no-op.
    const deleteStmt = env.DB.prepare(
      'DELETE FROM votes WHERE question_id = ? AND voter_id = ? AND option_id = ?',
    )

    // DD-03: `zero_knowledge` is sold as the strongest privacy tier, but it only
    // ever suppressed sentiment analysis, XR avatars and AI insights — the vote
    // row itself was still written with a voter identifier derived from the
    // participant's IP. In this mode the durable row now carries a per-vote
    // random id instead, so nothing in D1 links two votes to one person, let
    // alone to an address. Dedupe for the session still works: it runs off
    // `state._voters` in DO memory (K_VOTERS), which never reaches D1.
    const zeroKnowledge = meta.anonymity === 'zero_knowledge'

    const statements: D1PreparedStatement[] = []
    let insertCount = 0
    for (const v of state.voteBuffer) {
      const durableVoterId = zeroKnowledge ? `zk_${crypto.randomUUID()}` : v.voterId
      if (v.supersedesOptionId && !zeroKnowledge) {
        // Supersede targets a stable voter_id; under ZK there is none to target,
        // and the in-memory projection already holds only the final choice.
        statements.push(deleteStmt.bind(v.questionId, v.voterId, v.supersedesOptionId))
      }
      statements.push(
        insertStmt.bind(crypto.randomUUID(), v.sessionId, v.questionId, durableVoterId, v.optionId, v.submittedAt),
      )
      insertCount++
    }

    // Chunked so a very large flush never exceeds D1's per-batch statement
    // ceiling. Chunks apply in order, so cross-chunk supersede ordering holds.
    for (let i = 0; i < statements.length; i += VOTE_FLUSH_BATCH_SIZE) {
      await env.DB.batch(statements.slice(i, i + VOTE_FLUSH_BATCH_SIZE))
    }

    if (state._voters) await storage.put(K_VOTERS, state._voters)
    if (state._counts) await storage.put(K_COUNTS, state._counts)

    if (!env.SESSIONS_KV) {
      logEvent({ event: 'do.kv_unavailable', sessionId: meta.sessionId, detail: 'SESSIONS_KV' })
    } else if (state._voters) {
      await writeKvJson(
        env.SESSIONS_KV,
        `votes:${meta.sessionId}`,
        { voters: state._voters, counts: state._counts, flushedAt: Date.now() },
        { expirationTtl: 3600 },
      )
    }

    writeEvent(env.METRICS_AE, {
      name: 'do.vote_buffer_flush',
      sessionId: meta.sessionId,
      teamId: meta.teamId ?? undefined,
      durationMs: Date.now() - startMs,
      count: insertCount,
      detail: 'batch_insert_to_d1',
    })

    state.voteBuffer = []
    state.lastFlushAt = Date.now()
    state.flushScheduled = false
  } catch (err) {
    logEvent({
      event: 'do.flush_votes_failed',
      sessionId: meta.sessionId,
      errorClass: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    state.flushScheduled = false
  }
}

export async function maybeSnapshot(
  storage: SessionRoomStorage,
  env: Env,
  state: Pick<VoteFlushState, '_counts'>,
): Promise<void> {
  if (!env.R2_SESSIONS) return

  const meta = await storage.get<Meta>(K_META)
  if (!meta) return

  try {
    const snapshot = {
      sessionId: meta.sessionId,
      meta,
      questions: (await storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? [],
      questionIndex: (await storage.get<number>(K_QUESTION_INDEX)) ?? 0,
      currentQuestion: await storage.get<LiveQuestion>(K_QUESTION),
      counts: state._counts ?? (await storage.get<Counts>(K_COUNTS)) ?? {},
      voters: (await storage.get<Votes>(K_VOTERS)) ?? {},
      pendingResponses: (await storage.get<unknown[]>(K_PENDING_RESPONSES)) ?? [],
      activeEnergizer: (await storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null,
      status: await storage.get<string>(K_STATUS),
      snapshotAt: Date.now(),
    }

    await env.R2_SESSIONS.put(`sessions/${meta.sessionId}/snapshot.json`, JSON.stringify(snapshot), {
      customMetadata: { sessionId: meta.sessionId, snapshotAt: String(Date.now()) },
    })
  } catch (err) {
    logEvent({
      event: 'do.snapshot_failed',
      sessionId: meta.sessionId,
      errorClass: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function maybeHydrate(
  storage: SessionRoomStorage,
  env: Env,
  state: Pick<VoteFlushState, '_counts' | '_voters'>,
): Promise<void> {
  if (!env.R2_SESSIONS) return

  const meta = await storage.get<Meta>(K_META)
  if (!meta) return

  try {
    const obj = await env.R2_SESSIONS.get(`sessions/${meta.sessionId}/snapshot.json`)
    if (!obj) return

    const snapshot = parseSnapshot(await obj.text())
    if (!snapshot) return

    if (snapshot.questions) await storage.put(K_QUESTIONS, snapshot.questions)
    if (snapshot.questionIndex !== undefined) await storage.put(K_QUESTION_INDEX, snapshot.questionIndex)
    if (snapshot.currentQuestion) await storage.put(K_QUESTION, snapshot.currentQuestion)
    if (snapshot.counts) {
      await storage.put(K_COUNTS, snapshot.counts)
      state._counts = snapshot.counts
    }
    if (snapshot.voters) {
      await storage.put(K_VOTERS, snapshot.voters)
      state._voters = snapshot.voters
    }
    if (snapshot.pendingResponses?.length) {
      await storage.put(K_PENDING_RESPONSES, snapshot.pendingResponses)
    }
    if (snapshot.activeEnergizer) await storage.put(K_ACTIVE_ENERGIZER, snapshot.activeEnergizer)
    if (snapshot.status) await storage.put(K_STATUS, snapshot.status)

    logEvent({ event: 'do.snapshot_hydrated', sessionId: meta.sessionId })
    writeEvent(env.METRICS_AE, {
      name: 'do.recovery_from_snapshot',
      sessionId: meta.sessionId,
      count: Object.keys(snapshot.voters ?? {}).length,
      detail: 'recovery_success',
    })
  } catch (err) {
    logEvent({
      event: 'do.hydrate_failed',
      sessionId: meta.sessionId,
      errorClass: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
  }
}
