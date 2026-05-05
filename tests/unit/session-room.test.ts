// S1–S5 acceptance for the SessionRoom Durable Object.
//
// The harness mocks just the slice of the runtime the DO actually touches
// (storage + alarm + hibernated socket registry). The WebSocket upgrade
// response (HTTP 101) is workerd-specific; we verify the upgrade *logic* by
// manually registering sockets via `state.acceptWebSocket()` and driving
// `webSocketMessage` / `alarm()`. End-to-end 101 is covered by the staging
// deploy smoke test.

import { describe, expect, it, vi } from 'vitest'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env, QuestionKind, VotePolicy } from '../../functions/api/types'
import {
  MockDurableObjectState,
  MockWebSocket,
} from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'irrelevant-for-do-tests',
    LIVE_ENERGIZERS_ENABLED: 'false',
    DB: new D1Mock() as unknown as D1Database,
  } as unknown as Env
}

function makeLiveEnergizerEnv(): Env {
  return {
    ...makeEnv(),
    LIVE_ENERGIZERS_ENABLED: 'true',
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

async function buildLiveEnergizerRoom(): Promise<{
  room: SessionRoom
  state: MockDurableObjectState
  db: D1Mock
}> {
  const state = new MockDurableObjectState()
  const env = makeLiveEnergizerEnv()
  const db = env.DB as unknown as D1Mock
  const room = new SessionRoom(state as unknown as DurableObjectState, env)
  return { room, state, db }
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

function connectPresenter(state: MockDurableObjectState, userId = 'user_host', permissions?: string[]): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'presenter',
    voterId: `host_${userId}`,
    ipHash: 'presenter-ip',
    bucket: { tokens: 10, lastAt: 0 },
    ...(permissions !== undefined ? { permissions } : {}),
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

  it('adds v1 to server frames and accepts explicit v1 client frames', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const ws = connectVoter(state, 'anon_v1')
    await sendMessage(room, ws, { v: 1, type: 'request_state', data: {}, timestamp: 0 })

    const init1 = ws.messages<{ v?: number; type: string }>().find((m) => m.type === 'init')
    expect(init1?.v).toBe(1)
  })

  it('rejects unsupported future protocol versions without closing the socket', async () => {
    const { room, state } = await buildRoom()
    await init(room)

    const ws = connectVoter(state, 'anon_future')
    await sendMessage(room, ws, { v: 99, type: 'request_state', data: {}, timestamp: 0 })

    const err = ws.messages<{ type: string; data: { code?: string } }>().find((m) => m.type === 'error')
    expect(err?.data.code).toBe('unsupported_protocol')
    expect(ws.closed).toBe(false)
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

describe('Sprint 25 — LIVE energizer protocol foundation', () => {
  it('keeps energizer activation dark when the feature flag is off', async () => {
    const { room, state } = await buildRoom()
    await init(room)
    const presenter = connectPresenter(state)

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: { id: 'eg_1', kind: 'quick_finger', title: 'Quick finger', status: 'active' },
      },
      timestamp: 0,
    })

    const err = presenter.messages<{ type: string; data: { code?: string } }>().find((m) => m.type === 'error')
    expect(err?.data.code).toBe('feature_disabled')
    expect(await state.storage.get('active_energizer')).toBeUndefined()
  })

  it('broadcasts active energizer state when enabled and presenter-triggered', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'anon_energizer')

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: { id: 'eg_1', kind: 'quick_finger', title: 'Quick finger', status: 'active' },
      },
      timestamp: 0,
    })

    for (const ws of [presenter, voter]) {
      const msg = ws.messages<{ type: string; data: { energizer?: { id?: string } } }>().find(
        (entry) => entry.type === 'energizer_state',
      )
      expect(msg?.data.energizer?.id).toBe('eg_1')
    }
    expect(await state.storage.get('active_energizer')).toMatchObject({ id: 'eg_1', status: 'active' })
  })

  it('includes active energizer state in request_state snapshots', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: { id: 'eg_2', kind: 'quick_finger', title: 'Quick finger', status: 'active' },
      },
      timestamp: 0,
    })

    const reconnect = connectVoter(state, 'anon_reconnect', 'ip_reconnect')
    await sendMessage(room, reconnect, { v: 1, type: 'request_state', data: {}, timestamp: 0 })

    const initMsg = reconnect.messages<{ type: string; data: { energizer?: { id?: string } | null } }>().find(
      (entry) => entry.type === 'init',
    )
    expect(initMsg?.data.energizer?.id).toBe('eg_2')
  })

  it('rejects voter-triggered energizer activation', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const voter = connectVoter(state, 'anon_forbidden')

    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: { id: 'eg_3', kind: 'quick_finger', title: 'Nope', status: 'active' },
      },
      timestamp: 0,
    })

    const err = voter.messages<{ type: string; data: { code?: string } }>().find((m) => m.type === 'error')
    expect(err?.data.code).toBe('forbidden')
  })
})

describe('Sprint 26/27 — LIVE Quick Finger answers', () => {
  it('accepts participant answers, ranks correct responses, and broadcasts score state', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const fast = connectVoter(state, 'anon_fast', 'ip_fast')
    const slow = connectVoter(state, 'anon_slow', 'ip_slow')

    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: {
          id: 'eg_qf',
          kind: 'quick_finger',
          title: 'Quick finger',
          status: 'active',
          prompt: 'Pick the right answer',
          options: ['A', 'B'],
          correctIndex: 1,
        },
      },
      timestamp: 0,
    })
    vi.setSystemTime(1_250)
    await sendMessage(room, fast, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_qf', value: 'B' },
      timestamp: 0,
    })
    vi.setSystemTime(1_600)
    await sendMessage(room, slow, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_qf', value: 'B' },
      timestamp: 0,
    })

    const stateMsg = slow
      .messages<{ type: string; data: { energizer?: { answers?: { voterId: string; rank: number; speedMs: number }[] } } }>()
      .filter((entry) => entry.type === 'energizer_state')
      .at(-1)

    expect(stateMsg?.data.energizer?.answers).toMatchObject([
      { voterId: 'anon_fast', rank: 1, speedMs: 250 },
      { voterId: 'anon_slow', rank: 2, speedMs: 600 },
    ])
    expect(await state.storage.get('active_energizer')).toMatchObject({
      id: 'eg_qf',
      answers: [
        { voterId: 'anon_fast', rank: 1 },
        { voterId: 'anon_slow', rank: 2 },
      ],
    })
    vi.useRealTimers()
  })

  it('rejects duplicate Quick Finger answers and replays the stored score on reconnect', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'anon_dupe_qf', 'ip_qf')

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: {
          id: 'eg_qf_dupe',
          kind: 'quick_finger',
          title: 'Quick finger',
          status: 'active',
          options: ['A', 'B'],
          correctIndex: 0,
        },
      },
      timestamp: 0,
    })
    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_qf_dupe', value: 'A' },
      timestamp: 0,
    })
    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_qf_dupe', value: 'B' },
      timestamp: 0,
    })

    const err = voter.messages<{ type: string; data: { code?: string } }>().find(
      (entry) => entry.type === 'error' && entry.data.code === 'duplicate_energizer_answer',
    )
    expect(err).toBeTruthy()

    const reconnect = connectVoter(state, 'anon_dupe_qf', 'ip_qf_2')
    await sendMessage(room, reconnect, { v: 1, type: 'request_state', data: {}, timestamp: 0 })

    const initMsg = reconnect.messages<{ type: string; data: { energizer?: { answers?: unknown[] } | null } }>().find(
      (entry) => entry.type === 'init',
    )
    expect(initMsg?.data.energizer?.answers).toHaveLength(1)
  })
})

describe('Sprint 28 — LIVE Team Quiz loop', () => {
  const TEAM_QUIZ = {
    id: 'eg_tq',
    kind: 'team_quiz' as const,
    title: 'Team quiz',
    status: 'active' as const,
    questions: [
      { prompt: 'First?', options: ['A', 'B'], correctIndex: 0 },
      { prompt: 'Second?', options: ['C', 'D'], correctIndex: 1 },
    ],
  }

  it('locks one answer per voter per quiz question and ranks score summaries', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const v1 = connectVoter(state, 'anon_tq_1', 'ip_tq_1')
    const v2 = connectVoter(state, 'anon_tq_2', 'ip_tq_2')

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: { energizer: TEAM_QUIZ },
      timestamp: 0,
    })
    await sendMessage(room, v1, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_tq', value: 'A' },
      timestamp: 0,
    })
    await sendMessage(room, v1, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_tq', value: 'B' },
      timestamp: 0,
    })
    await sendMessage(room, v2, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_tq', value: 'B' },
      timestamp: 0,
    })

    const err = v1.messages<{ type: string; data: { code?: string } }>().find(
      (entry) => entry.type === 'error' && entry.data.code === 'duplicate_energizer_answer',
    )
    expect(err).toBeTruthy()

    const active = await state.storage.get<{ submissions: unknown[]; scores: { voterId: string; score: number; rank: number }[] }>('active_energizer')
    expect(active?.submissions).toHaveLength(2)
    expect(active?.scores).toMatchObject([
      { voterId: 'anon_tq_1', score: 1, rank: 1 },
      { voterId: 'anon_tq_2', score: 0, rank: 2 },
    ])
  })

  it('presenter advances through quiz questions and reconnect snapshots restore the current quiz index', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'anon_tq_reconnect', 'ip_tq_reconnect')

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: { energizer: TEAM_QUIZ },
      timestamp: 0,
    })
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_advance',
      data: { energizerId: 'eg_tq' },
      timestamp: 0,
    })

    const advanceMsg = voter
      .messages<{ type: string; data: { energizer?: { currentIndex?: number; status?: string } } }>()
      .filter((entry) => entry.type === 'energizer_state')
      .at(-1)
    expect(advanceMsg?.data.energizer?.currentIndex).toBe(1)

    const reconnect = connectVoter(state, 'anon_tq_reconnect', 'ip_tq_reconnect_2')
    await sendMessage(room, reconnect, { v: 1, type: 'request_state', data: {}, timestamp: 0 })
    const initMsg = reconnect.messages<{ type: string; data: { energizer?: { currentIndex?: number } | null } }>().find(
      (entry) => entry.type === 'init',
    )
    expect(initMsg?.data.energizer?.currentIndex).toBe(1)

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_advance',
      data: { energizerId: 'eg_tq' },
      timestamp: 0,
    })
    const completed = await state.storage.get<{ status: string; currentIndex: number }>('active_energizer')
    expect(completed).toMatchObject({ status: 'completed', currentIndex: 1 })
  })
})

describe('Sprint 29 — leaderboard and badge foundation', () => {
  it('derives a bounded Quick Finger leaderboard and idempotent speed badges', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const fast = connectVoter(state, 'anon_lb_fast', 'ip_lb_fast')
    const slow = connectVoter(state, 'anon_lb_slow', 'ip_lb_slow')

    vi.useFakeTimers()
    vi.setSystemTime(2_000)
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: {
          id: 'eg_lb_qf',
          kind: 'quick_finger',
          title: 'Quick finger',
          status: 'active',
          options: ['A', 'B'],
          correctIndex: 0,
        },
      },
      timestamp: 0,
    })
    vi.setSystemTime(2_100)
    await sendMessage(room, fast, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_lb_qf', value: 'A' },
      timestamp: 0,
    })
    vi.setSystemTime(2_500)
    await sendMessage(room, slow, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_lb_qf', value: 'A' },
      timestamp: 0,
    })
    await sendMessage(room, slow, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_lb_qf', value: 'A' },
      timestamp: 0,
    })

    const active = await state.storage.get<{
      leaderboard: { voterId: string; rank: number; badges: { id: string; kind: string }[] }[]
      badges: Record<string, { id: string; kind: string }[]>
    }>('active_energizer')
    expect(active?.leaderboard).toHaveLength(2)
    expect(active?.leaderboard[0]).toMatchObject({ voterId: 'anon_lb_fast', rank: 1 })
    expect(active?.badges.anon_lb_fast.map((badge) => badge.kind)).toEqual(['first_answer', 'speedster'])
    expect(new Set(active?.badges.anon_lb_fast.map((badge) => badge.id)).size).toBe(active?.badges.anon_lb_fast.length)
    vi.useRealTimers()
  })

  it('awards Team Quiz engagement and perfect trivia badges once at completion', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'anon_badge_tq', 'ip_badge_tq')

    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_activate',
      data: {
        energizer: {
          id: 'eg_badge_tq',
          kind: 'team_quiz',
          title: 'Team quiz',
          status: 'active',
          questions: [
            { prompt: 'First?', options: ['A', 'B'], correctIndex: 0 },
            { prompt: 'Second?', options: ['C', 'D'], correctIndex: 1 },
          ],
        },
      },
      timestamp: 0,
    })
    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_badge_tq', value: 'A' },
      timestamp: 0,
    })
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_advance',
      data: { energizerId: 'eg_badge_tq' },
      timestamp: 0,
    })
    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_badge_tq', value: 'D' },
      timestamp: 0,
    })
    await sendMessage(room, presenter, {
      v: 1,
      type: 'energizer_advance',
      data: { energizerId: 'eg_badge_tq' },
      timestamp: 0,
    })

    const completed = await state.storage.get<{
      leaderboard: { voterId: string; score: number; badges: { id: string; kind: string }[] }[]
      badges: Record<string, { id: string; kind: string }[]>
    }>('active_energizer')
    expect(completed?.leaderboard[0]).toMatchObject({ voterId: 'anon_badge_tq', score: 2 })
    expect(completed?.badges.anon_badge_tq.map((badge) => badge.kind)).toEqual([
      'first_answer',
      'engaged',
      'perfect_trivia',
    ])
    expect(new Set(completed?.badges.anon_badge_tq.map((badge) => badge.id)).size).toBe(completed?.badges.anon_badge_tq.length)
  })
})

describe('Sprint 31 — Enterprise energizer activation permissions', () => {
  it('denies presenter activation when custom permissions exclude energizer activation', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state, 'user_host', [])

    await sendMessage(room, presenter, {
      type: 'energizer_activate',
      data: { energizer: { id: 'eg_denied', kind: 'quick_finger', title: 'Denied', status: 'active' } },
      timestamp: 0,
    })

    const err = presenter.messages<{ type: string; data: { code: string } }>().find((entry) => entry.type === 'error')
    expect(err?.data.code).toBe('forbidden')
    expect(await state.storage.get('active_energizer')).toBeUndefined()
  })

  it('allows presenter activation when custom permissions include energizer activation', async () => {
    const { room, state } = await buildLiveEnergizerRoom()
    await init(room)
    const presenter = connectPresenter(state, 'user_host', ['energizer:activate'])

    await sendMessage(room, presenter, {
      type: 'energizer_activate',
      data: { energizer: { id: 'eg_allowed', kind: 'quick_finger', title: 'Allowed', status: 'active' } },
      timestamp: 0,
    })

    expect(await state.storage.get('active_energizer')).toMatchObject({ id: 'eg_allowed', status: 'active' })
  })

  it('writes sanitized audit evidence for realtime activation, answers, completion, and denials', async () => {
    const { room, state, db } = await buildLiveEnergizerRoom()
    await init(room)
    const denied = connectPresenter(state, 'user_host', [])
    const presenter = connectPresenter(state, 'user_host', ['session:launch', 'energizer:activate'])
    const voter = connectVoter(state, 'anon_audit')

    await sendMessage(room, denied, {
      type: 'energizer_activate',
      data: { energizer: { id: 'eg_audit_denied', kind: 'quick_finger', title: 'Denied title', status: 'active' } },
      timestamp: 0,
    })
    await sendMessage(room, presenter, {
      type: 'energizer_activate',
      data: {
        energizer: {
          id: 'eg_audit',
          kind: 'team_quiz',
          title: 'Audit quiz',
          status: 'active',
          questions: [
            { prompt: 'Private prompt 1', options: ['A', 'B'], correctIndex: 0 },
          ],
        },
      },
      timestamp: 0,
    })
    await sendMessage(room, voter, {
      type: 'energizer_answer',
      data: { energizerId: 'eg_audit', value: 'A' },
      timestamp: 0,
    })
    await sendMessage(room, presenter, {
      type: 'energizer_advance',
      data: { energizerId: 'eg_audit' },
      timestamp: 0,
    })

    const actions = [...db.auditEvents.values()].map((event) => event.action)
    expect(actions).toEqual(expect.arrayContaining([
      'ws.energizer_activation_denied',
      'ws.energizer_activated',
      'ws.energizer_answered',
      'ws.energizer_completed',
    ]))
    const serialized = JSON.stringify([...db.auditEvents.values()])
    expect(serialized).not.toContain('Private prompt 1')
    expect(serialized).not.toContain('"value":"A"')
  })
})
