// DO energizing phase (#529 Janurai re-audit): D1 may be `energizing` while the DO
// must not expose questions or accept votes until transition-to-live.

import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env, VotePolicy } from '../../functions/api/types'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    LIVE_ENERGIZERS_ENABLED: 'true',
    DB: new D1Mock() as unknown as D1Database,
  } as unknown as Env
}

async function buildRoom() {
  const state = new MockDurableObjectState()
  const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv())
  return { room, state }
}

const POLL_Q = {
  id: 'q_1',
  kind: 'poll' as const,
  prompt: 'Priority?',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
}

async function initEnergizing(room: SessionRoom) {
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_en',
        ownerId: 'user_host',
        code: 'ENRG01',
        title: 'Warm-up session',
        votePolicy: 'once' as VotePolicy,
        question: POLL_Q,
        questions: [POLL_Q],
        initialStatus: 'energizing',
      }),
    }),
  )
  expect(res.status).toBe(200)
}

function connectVoter(state: MockDurableObjectState, voterId: string): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'voter',
    voterId,
    ipHash: 'ip01',
    bucket: { tokens: 10, lastAt: 0 },
  })
  state.acceptWebSocket(ws, [`ip:ip01`, `voter:${voterId}`, 'role:voter'])
  return ws
}

describe('SessionRoom energizing phase', () => {
  it('init with energizing hides the question in the init snapshot', async () => {
    const { room, state } = await buildRoom()
    await initEnergizing(room)

    const ws = connectVoter(state, 'voter_a')
    await room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'request_state', data: {}, timestamp: 0 }),
    )

    const init = ws.messages<{ type: string; data: Record<string, unknown> }>().find((m) => m.type === 'init')
    expect(init?.data.session).toMatchObject({ status: 'energizing' })
    expect(init?.data.question).toBeNull()
  })

  it('rejects votes while energizing', async () => {
    const { room, state } = await buildRoom()
    await initEnergizing(room)
    const ws = connectVoter(state, 'voter_b')

    await room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({
        type: 'vote',
        data: { questionId: 'q_1', optionId: 'a' },
        timestamp: 0,
      }),
    )

    const err = ws.messages<{ type: string; data: { code?: string } }>().find((m) => m.type === 'error')
    expect(err?.data.code).toBe('energizing')
  })

  it('transition-to-live exposes the first question and allows voting', async () => {
    const { room, state } = await buildRoom()
    await initEnergizing(room)

    const transition = await room.fetch(new Request('https://do.internal/transition-to-live', { method: 'POST' }))
    expect(transition.status).toBe(200)
    const body = (await transition.json()) as { ok: boolean; data: { transitioned: boolean } }
    expect(body.data.transitioned).toBe(true)

    const ws = connectVoter(state, 'voter_c')
    await room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'request_state', data: {}, timestamp: 0 }),
    )
    const init = ws.messages<{ type: string; data: Record<string, unknown> }>().find((m) => m.type === 'init')
    expect(init?.data.session).toMatchObject({ status: 'live' })
    expect((init?.data.question as { id: string }).id).toBe('q_1')

    await room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({
        type: 'vote',
        data: { questionId: 'q_1', optionId: 'a' },
        timestamp: 1,
      }),
    )
    const voteErr = ws.messages<{ type: string; data: { code?: string } }>().find((m) => m.type === 'error')
    expect(voteErr).toBeUndefined()
  })
})
