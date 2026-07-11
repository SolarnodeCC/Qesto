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
import type { Meta, Counts, Votes, Attachment } from './session-room-types'
import type { SessionRoomContext } from './session-room-context'
import { canControlSession } from './session-room-presenter-init'
import { rejectIfEnergizingPhase } from './session-room-vote-admission'

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
  const nextQ = allQs[nextIdx]
  await self.ctx.storage.put(K_QUESTION_INDEX, nextIdx)
  await self.ctx.storage.put(K_QUESTION, nextQ)
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  await self.ctx.storage.delete(K_ACTIVE_ENERGIZER)
  await self.ctx.storage.delete(K_SENTIMENT_MOOD)
  await self.ctx.storage.delete(K_SENTIMENT_LAST)
  self.resetVoters({})
  // VOTE-CORRUPTION (#538): clearing K_COUNTS in storage is not enough — the
  // in-memory tally cache (state._counts) survives navigation and would carry
  // the previous question's counts into the next question's first vote (and get
  // re-flushed to D1). Reset it atomically with the storage wipe.
  self.state._counts = {}
  const advanceMsg = serverMessage({
    type: 'question',
    data: { question: nextQ, index: nextIdx, total: allQs.length },
    timestamp: now(),
  })
  for (const socket of self.ctx.getWebSockets()) {
    try { socket.send(advanceMsg) } catch { /* ignore closed socket */ }
  }
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
  const prevQ = allQs[prevIdx]
  await self.ctx.storage.put(K_QUESTION_INDEX, prevIdx)
  await self.ctx.storage.put(K_QUESTION, prevQ)
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  self.resetVoters({})
  // VOTE-CORRUPTION (#538): also clear the in-memory tally cache — see
  // handlePresenterAdvance above.
  self.state._counts = {}
  const backMsg = serverMessage({
    type: 'question',
    data: { question: prevQ, index: prevIdx, total: allQs.length },
    timestamp: now(),
  })
  for (const socket of self.ctx.getWebSockets()) {
    try { socket.send(backMsg) } catch { /* ignore closed socket */ }
  }
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
