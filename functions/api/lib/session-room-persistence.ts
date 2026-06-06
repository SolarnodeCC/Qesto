/**
 * Vote flush + R2 snapshot/hydrate helpers extracted from SessionRoom (TD-01).
 */

import type { LiveEnergizerState, LiveQuestion } from '../realtime'
import type { Env } from '../types'
import { logEvent } from './log'
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
    return null
  }
  if (!v || typeof v !== 'object') return null
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
    const stmt = env.DB.prepare(
      'INSERT INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at) VALUES (?, ?, ?, ?, ?, ?)',
    )

    const batch = state.voteBuffer.map((v) => [
      crypto.randomUUID(),
      v.sessionId,
      v.questionId,
      v.voterId,
      v.optionId,
      v.submittedAt,
    ])

    for (const row of batch) {
      try {
        await stmt.bind(...row).run()
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('UNIQUE constraint failed'))) {
          throw err
        }
      }
    }

    if (state._voters) await storage.put(K_VOTERS, state._voters)
    if (state._counts) await storage.put(K_COUNTS, state._counts)

    if (!env.SESSIONS_KV) {
      logEvent({ event: 'do.kv_unavailable', sessionId: meta.sessionId, detail: 'SESSIONS_KV' })
    } else if (state._voters) {
      await env.SESSIONS_KV.put(
        `votes:${meta.sessionId}`,
        JSON.stringify({ voters: state._voters, counts: state._counts, flushedAt: Date.now() }),
        { expirationTtl: 3600 },
      )
    }

    writeEvent(env.METRICS_AE, {
      name: 'do.vote_buffer_flush',
      sessionId: meta.sessionId,
      teamId: meta.teamId ?? undefined,
      durationMs: Date.now() - startMs,
      count: batch.length,
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
