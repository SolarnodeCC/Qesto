// S1–S5 acceptance for the SessionRoom Durable Object.
//
// The harness mocks just the slice of the runtime the DO actually touches
// (storage + alarm + hibernated socket registry). The WebSocket upgrade
// response (HTTP 101) is workerd-specific; we verify the upgrade *logic* by
// manually registering sockets via `state.acceptWebSocket()` and driving
// `webSocketMessage` / `alarm()`. End-to-end 101 is covered by the staging
// deploy smoke test.

import { describe, expect, it } from 'vitest'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env, QuestionKind, VotePolicy } from '../../functions/api/types'
import {
  MockDurableObjectState,
  MockWebSocket,
} from '../helpers/do-mock'

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'irrelevant-for-do-tests',
  } as unknown as Env
}

async function buildRoom(): Promise<{
  room: SessionRoom
  state: MockDurableObjectState
}> {
  const state = new MockDurableObjectState()
  const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv())
  return { room, state }
}

async function init(
  room: SessionRoom,
  overrides: Partial<{
    sessionId: string
    ownerId: string
    code: string
    title: string
    votePolicy: VotePolicy
    question: {
      id: string
      kind: QuestionKind
      prompt: string
      options: { id: string; label: string }[]
    }
  }> = {},
) {
  const body = {
    sessionId: 'sess_1',
    ownerId: 'user_host',
    code: 'ABC123',
    title: 'Retro Q2',
    votePolicy: 'once' as VotePolicy,
    question: {
      id: 'q_1',
      kind: 'poll' as const,
      prompt: 'What should we prioritise?',
      options: [
        { id: 'a', label: 'Feature X' },
        { id: 'b', label: 'Tech debt' },
        { id: 'c', label: 'Hiring' },
      ],
    },
    ...overrides,
  }
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  expect(res.status).toBe(200)
  return body
}

function connectVoter(state: MockDurableObjectState, voterId: string, ipHash = 'ip01'): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'voter',
    voterId,
    ipHash,
    bucket: { tokens: 10, lastAt: 0 }, // reset so first vote never starved
  })
  state.acceptWebSocket(ws, [`ip:${ipHash}`, `voter:${voterId}`, 'role:voter'])
  return ws
}

function connectPresenter(state: MockDurableObjectState, userId = 'user_host'): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'presenter',
    voterId: `host_${userId}`,
    ipHash: 'presenter-ip',
    bucket: { tokens: 10, lastAt: 0 },
  })
  state.acceptWebSocket(ws, ['ip:presenter-ip', `voter:host_${userId}`, 'role:presenter'])
  return ws
}

async function sendMessage(room: SessionRoom, ws: MockWebSocket, msg: unknown): Promise<void> {
  await room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg))
}

// ──────────────────────────────────────────────────────────────────────────

describe('S1 — init + request_state', () => {
  it('seeds meta + question and emits init on request_state', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const ws = connectVoter(state, 'anon_a')
    await sendMessage(room, ws, { type: 'request_state', data: {}, timestamp: 0 })

    const msgs = ws.messages<{ type: string; data: Record<string, unknown> }>()
    const init1 = msgs.find((m) => m.type === 'init')
    expect(init1).toBeTruthy()
    expect(init1?.data.session).toMatchObject({ id: 'sess_1', title: 'Retro Q2', code: 'ABC123' })
    expect((init1?.data.question as { options: unknown[] }).options).toHaveLength(3)
    expect(init1?.data.role).toBe('voter')
  })

  it('rejects init twice (idempotence guard)', async () => {
    const { room } = await buildRoom()
    await init(room)
    const res = await room.fetch(
      new Request('https://do.internal/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess_1',
          ownerId: 'user_host',
          code: 'ABC123',
          title: 'x',
        }),
      }),
    )
    expect(res.status).toBe(409)
  })
})

describe('S2 — 25 concurrent voters', () => {
  it('every live socket receives the debounced results broadcast', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const voters: MockWebSocket[] = []
    for (let i = 0; i < 25; i++) {
      voters.push(connectVoter(state, `anon_${i}`, `ip${i}`))
    }

    // Each voter votes for one of three options.
    for (let i = 0; i < voters.length; i++) {
      const option = ['a', 'b', 'c'][i % 3]!
      await sendMessage(room, voters[i], {
        type: 'vote',
        data: { questionId: 'q_1', optionId: option },
        timestamp: 0,
      })
    }

    // DO schedules an alarm; test drives it manually since there is no runtime.
    await room.alarm()

    for (const ws of voters) {
      const msgs = ws.messages<{ type: string }>()
      expect(msgs.some((m) => m.type === 'results')).toBe(true)
    }

    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect((counts.a ?? 0) + (counts.b ?? 0) + (counts.c ?? 0)).toBe(25)
  })
})

describe('S3 — reconnect replays state', () => {
  it('sends init with current counts after request_state', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const v1 = connectVoter(state, 'anon_x')
    await sendMessage(room, v1, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await room.alarm()

    // v1 disconnects.
    await room.webSocketClose(v1 as unknown as WebSocket, 1005, 'bye', true)
    v1.close(1005, 'bye')

    // v1 reconnects as a fresh socket (new anon id on different ip wouldn't trip dedupe).
    const v1b = connectVoter(state, 'anon_x', 'ip01')
    await sendMessage(room, v1b, { type: 'request_state', data: {}, timestamp: 0 })

    const init2 = v1b.messages<{ type: string; data: Record<string, unknown> }>().find(
      (m) => m.type === 'init',
    )
    expect(init2).toBeTruthy()
    const results = init2?.data.results as { counts: Record<string, number>; total: number }
    expect(results.total).toBe(1)
    expect(results.counts.a).toBe(1)
  })

  it('rejects duplicate votes from the same voterId', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const ws = connectVoter(state, 'anon_dupe')
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'b' },
      timestamp: 0,
    })
    const errs = ws.messages<{ type: string; data: { code?: string } }>().filter((m) => m.type === 'error')
    expect(errs.some((e) => e.data.code === 'duplicate')).toBe(true)

    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect(counts.a).toBe(1)
    expect(counts.b ?? 0).toBe(0)
  })
})

describe('S4 — close finalises and drops connections', () => {
  it('broadcasts session_closed, closes sockets, persists counts', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const v1 = connectVoter(state, 'anon_1')
    const v2 = connectVoter(state, 'anon_2', 'ip02')
    await sendMessage(room, v1, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await sendMessage(room, v2, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'b' },
      timestamp: 0,
    })
    await room.alarm()

    const res = await room.fetch(new Request('https://do.internal/close', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { counts: Record<string, number>; total: number } }
    expect(body.ok).toBe(true)
    expect(body.data.total).toBe(2)

    for (const ws of [v1, v2]) {
      expect(ws.closed).toBe(true)
      expect(ws.messages<{ type: string }>().some((m) => m.type === 'session_closed')).toBe(true)
    }
    expect(await state.storage.get<string>('status')).toBe('closed')
  })

  it('second close returns 409', async () => {
    const { room } = await buildRoom()
    await init(room)
    await room.fetch(new Request('https://do.internal/close', { method: 'POST' }))
    const res = await room.fetch(new Request('https://do.internal/close', { method: 'POST' }))
    expect(res.status).toBe(409)
  })
})

describe('S5 — vote flood trips the token bucket', () => {
  it('closes the flooding socket with policy violation', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const bully = new MockWebSocket()
    // Start with an empty bucket at t=0 so every vote starves.
    bully.serializeAttachment({
      role: 'voter',
      voterId: 'anon_bully',
      ipHash: 'ipBully',
      bucket: { tokens: 0, lastAt: Date.now() },
    })
    state.acceptWebSocket(bully, ['ip:ipBully', 'voter:anon_bully', 'role:voter'])

    await sendMessage(room, bully, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    expect(bully.closed).toBe(true)
    expect(bully.closeCode).toBe(1008)

    // Legitimate voter on another IP still works.
    const bystander = connectVoter(state, 'anon_ok', 'ipOk')
    await sendMessage(room, bystander, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await room.alarm()
    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect(counts.a).toBe(1)
  })
})

describe('WS4-A/B — votePolicy multi + react (SessionRoom integration)', () => {
  it('multi policy swaps choice and decrements prior option counts', async () => {
    const { room, state } = await buildRoom()
    await init(room, { votePolicy: 'multi' })

    const ws = connectVoter(state, 'v_multi')
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'b' },
      timestamp: 0,
    })
    await room.alarm()

    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect(counts.a).toBe(0)
    expect(counts.b).toBe(1)
  })

  it('react policy increments each submission without decrementing prior option', async () => {
    const { room, state } = await buildRoom()
    await init(room, { votePolicy: 'react' })

    const ws = connectVoter(state, 'v_react')
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'a' },
      timestamp: 0,
    })
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_1', optionId: 'b' },
      timestamp: 0,
    })
    await room.alarm()

    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect(counts.a).toBe(1)
    expect(counts.b).toBe(1)
  })

  it('multi_select accepts two options from one voter under once policy metadata', async () => {
    const { room, state } = await buildRoom()
    await init(room, {
      votePolicy: 'once',
      question: {
        id: 'q_ms',
        kind: 'multi_select',
        prompt: 'Pick many',
        options: [
          { id: 'x', label: 'X' },
          { id: 'y', label: 'Y' },
        ],
      },
    })

    const ws = connectVoter(state, 'v_ms')
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_ms', optionId: 'x' },
      timestamp: 0,
    })
    await sendMessage(room, ws, {
      type: 'vote',
      data: { questionId: 'q_ms', optionId: 'y' },
      timestamp: 0,
    })
    await room.alarm()

    const counts = (await state.storage.get<Record<string, number>>('counts')) ?? {}
    expect(counts.x).toBe(1)
    expect(counts.y).toBe(1)
  })
})

describe('advance authorisation', () => {
  it('rejects advance from a voter role', async () => {
    const { room, state } = await buildRoom()
    await init(room)
    const ws = connectVoter(state, 'anon_v')
    await sendMessage(room, ws, { type: 'advance', data: {}, timestamp: 0 })
    const errs = ws.messages<{ type: string; data: { code?: string } }>().filter((m) => m.type === 'error')
    expect(errs.some((e) => e.data.code === 'forbidden')).toBe(true)
  })

  it('presenter advance past last question broadcasts all_done', async () => {
    const { room, state } = await buildRoom()
    await init(room)
    const ws = connectPresenter(state)
    await sendMessage(room, ws, { type: 'advance', data: {}, timestamp: 0 })
    const msgs = ws.messages<{ type: string }>()
    expect(msgs.some((m) => m.type === 'all_done')).toBe(true)
  })
})
