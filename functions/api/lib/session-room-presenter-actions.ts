/**
 * session-room-presenter-actions.ts
 * Presenter-initiated WS actions for SessionRoom: question navigation
 * (advance/back) and copilot question injection (COPILOT-06, ADR-0046).
 * Split out of the former session-room-vote-flow.ts (audit 2026-07-08) so the
 * vote path and the presenter control surface live under their own names.
 */

import type { LiveQuestion } from '../realtime'
import type { QuestionKind } from '../types'
import { serverMessage, errorMessage, now } from './session-room-messages'
import {
  K_META,
  K_QUESTION,
  K_QUESTIONS,
  K_QUESTION_INDEX,
  K_COUNTS,
  K_VOTERS,
  K_ACTIVE_ENERGIZER,
  K_SENTIMENT_MOOD,
  K_SENTIMENT_LAST,
} from './session-room-storage-keys'
import { FUN_MODE_QUESTION_MS, type Meta, type Counts, type Votes, type Attachment } from './session-room-types'
import type { SessionRoomContext } from './session-room-context'
import { canControlSession } from './session-room-presenter-init'
import { rejectIfEnergizingPhase } from './session-room-vote-admission'


/** Per-question tally snapshot, so navigating back restores (not wipes) it. */
const questionStateKey = (questionId: string) => `qstate:${questionId}`
type QuestionState = { counts: Counts; voters: Votes }

/**
 * Move the live pointer from `fromQ` to `toQ`.
 *
 * Previously both advance and back wiped counts + voters. Going Back therefore
 * zeroed the live chart AND the dedupe map, so every participant could vote on
 * that question again — and with vote_policy 'once' a different option created
 * a second D1 row (the uniqueness key is question+voter+option), inflating the
 * results. The outgoing question's tally is now stashed and the target's
 * restored; votes already in D1 are untouched.
 *
 * Also: fun-mode's countdown is per question (it used to be set once at init,
 * so question 2 inherited question 1's deadline), and the restored results are
 * broadcast so clients never show the previous question's totals.
 */
async function switchQuestion(
  self: SessionRoomContext,
  allQs: LiveQuestion[],
  fromQ: LiveQuestion | undefined,
  toIdx: number,
): Promise<void> {
  const toQ = allQs[toIdx]!
  if (fromQ) {
    const counts = self.state._counts ?? (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const voters = await self.ensureVoters()
    await self.ctx.storage.put(questionStateKey(fromQ.id), { counts, voters } satisfies QuestionState)
  }
  const saved = await self.ctx.storage.get<QuestionState>(questionStateKey(toQ.id))
  const counts: Counts = saved?.counts ?? {}
  const voters: Votes = saved?.voters ?? {}
  await self.ctx.storage.put(K_QUESTION_INDEX, toIdx)
  await self.ctx.storage.put(K_QUESTION, toQ)
  await self.ctx.storage.put(K_COUNTS, counts)
  await self.ctx.storage.put(K_VOTERS, voters)
  self.resetVoters(voters)
  // VOTE-CORRUPTION (#538): the in-memory tally cache must switch atomically
  // with storage or the previous question's counts leak into this one.
  self.state._counts = counts

  let expiresAt: number | null = null
  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (meta?.sessionMode === 'fun') {
    expiresAt = now() + FUN_MODE_QUESTION_MS
    await self.ctx.storage.put(K_META, { ...meta, questionExpiresAt: expiresAt })
    await self.scheduleAlarm(expiresAt)
  }

  const ts = now()
  const questionMsg = serverMessage({
    type: 'question',
    data: { question: toQ, index: toIdx, total: allQs.length, ...(expiresAt ? { expiresAt } : {}) },
    timestamp: ts,
  })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const resultsMsg = serverMessage({ type: 'results', data: { counts, total }, timestamp: ts })
  for (const socket of self.ctx.getWebSockets()) {
    try {
      socket.send(questionMsg)
      socket.send(resultsMsg)
    } catch { /* ignore closed socket */ }
  }
}

// ── Presenter navigation ──────────────────────────────────────────────────
export async function handlePresenterAdvance(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
  if (await rejectIfEnergizingPhase(self, ws)) return
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can advance'))
    return
  }
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot advance this session'))
    return
  }
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const curIdx = (await self.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
  const nextIdx = curIdx + 1
  if (nextIdx >= allQs.length) {
    const doneMsg = serverMessage({ type: 'all_done', data: {}, timestamp: now() })
    for (const socket of self.ctx.getWebSockets()) {
      try { socket.send(doneMsg) } catch { /* ignore */ }
    }
    return
  }
  const curQ = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
  await self.ctx.storage.delete(K_ACTIVE_ENERGIZER)
  await self.ctx.storage.delete(K_SENTIMENT_MOOD)
  await self.ctx.storage.delete(K_SENTIMENT_LAST)
  await switchQuestion(self, allQs, curQ, nextIdx)
}

export async function handlePresenterBack(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
  if (await rejectIfEnergizingPhase(self, ws)) return
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can go back'))
    return
  }
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot go back in this session'))
    return
  }
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const curIdx = (await self.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
  const prevIdx = curIdx - 1
  if (prevIdx < 0) {
    ws.send(errorMessage('noop', 'Already at first question'))
    return
  }
  const curQ = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
  await switchQuestion(self, allQs, curQ, prevIdx)
}

// ── COPILOT-06: presenter injects a copilot-drafted question (ADR-0046) ────
// Additive on protocol v1 (ADR-0005): appends to the live question set so the
// presenter can advance to it. Best-effort D1 persistence keeps exports/recaps
// consistent; the live append is authoritative either way.
export async function handleAddQuestion(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { question: { kind: QuestionKind; prompt: string; options: { label: string }[] } },
): Promise<void> {
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot modify this session'))
    return
  }

  const q = data.question
  const newQuestion: LiveQuestion = {
    id: crypto.randomUUID(),
    kind: q.kind,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: crypto.randomUUID(), label: o.label })),
  }

  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  allQs.push(newQuestion)
  await self.ctx.storage.put(K_QUESTIONS, allQs)
  const position = allQs.length - 1

  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (meta?.sessionId) {
    try {
      await self.env.DB.prepare(
        `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
        .bind(newQuestion.id, meta.sessionId, position, newQuestion.kind, newQuestion.prompt, JSON.stringify(newQuestion.options), now())
        .run()
    } catch {
      /* live state already updated; D1 persistence is best-effort */
    }
  }
}
