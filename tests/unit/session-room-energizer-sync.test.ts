// Audit E-2 — single energizer plane. The host lobby manages energizers over
// REST; the routes reconcile lifecycle changes into the SessionRoom DO via the
// internal `/energizer-sync` endpoint so participants (anonymous included)
// receive them over the WebSocket. These tests drive the DO half: sync
// activate/advance/complete, the emoji_poll / word_cloud live answers with the
// aggregate `optionCounts` read model, and the `/energizer-state` host read.

import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
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

async function buildRoom(): Promise<{ room: SessionRoom; state: MockDurableObjectState }> {
  const state = new MockDurableObjectState()
  const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv())
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_sync',
        ownerId: 'user_host',
        code: 'SYNC01',
        title: 'Energizer sync',
        votePolicy: 'once',
        question: {
          id: 'q_1',
          kind: 'poll',
          prompt: 'Q?',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        },
      }),
    }),
  )
  expect(res.status).toBe(200)
  return { room, state }
}

function connectVoter(state: MockDurableObjectState, voterId: string, ipHash = 'ip01'): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'voter',
    voterId,
    ipHash,
    bucket: { tokens: 10, lastAt: 0 },
  })
  state.acceptWebSocket(ws, [`ip:${ipHash}`, `voter:${voterId}`, 'role:voter'])
  return ws
}

async function sendMessage(room: SessionRoom, ws: MockWebSocket, msg: unknown): Promise<void> {
  await room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg))
}

async function postSync(room: SessionRoom, body: unknown): Promise<Response> {
  return room.fetch(
    new Request('https://do.internal/energizer-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const EMOJI_POLL = {
  id: 'eg_emoji',
  kind: 'emoji_poll',
  title: 'Vibe check',
  prompt: 'Vibe check',
  status: 'active',
  options: ['🔥', '😴', '🎉'],
}

describe('/energizer-sync — REST-plane lifecycle reconciliation', () => {
  it('activate broadcasts the energizer to connected voters', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_1')

    const res = await postSync(room, { action: 'activate', energizer: EMOJI_POLL })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, applied: true })

    const msg = voter
      .messages<{ type: string; data: { energizer?: { id?: string; kind?: string } } }>()
      .find((entry) => entry.type === 'energizer_state')
    expect(msg?.data.energizer).toMatchObject({ id: 'eg_emoji', kind: 'emoji_poll' })
  })

  it('re-activating the same energizer keeps accumulated answers', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_keep')
    await postSync(room, { action: 'activate', energizer: EMOJI_POLL })
    await sendMessage(room, voter, {
      v: 1,
      type: 'energizer_answer',
      data: { energizerId: 'eg_emoji', value: '🔥' },
      timestamp: 0,
    })

    await postSync(room, { action: 'activate', energizer: EMOJI_POLL })

    expect(await state.storage.get('active_energizer')).toMatchObject({
      id: 'eg_emoji',
      answers: [{ voterId: 'anon_keep', value: '🔥' }],
    })
  })

  it('activate strips the quick-finger answer key from voter broadcasts', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_redact')

    await postSync(room, {
      action: 'activate',
      energizer: {
        id: 'eg_qf',
        kind: 'quick_finger',
        title: 'Fast!',
        status: 'active',
        options: ['A', 'B'],
        correctIndex: 1,
      },
    })

    const msg = voter
      .messages<{ type: string; data: { energizer?: { correctIndex?: number } } }>()
      .find((entry) => entry.type === 'energizer_state')
    expect(msg?.data.energizer).toBeTruthy()
    expect(msg?.data.energizer?.correctIndex).toBeUndefined()
  })

  it('advance moves the team quiz question and completed=true finishes it', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_tq')
    await postSync(room, {
      action: 'activate',
      energizer: {
        id: 'eg_tq',
        kind: 'team_quiz',
        title: 'Quiz',
        status: 'active',
        questions: [
          { prompt: 'First?', options: ['A', 'B'], correctIndex: 0 },
          { prompt: 'Second?', options: ['C', 'D'], correctIndex: 1 },
        ],
        currentIndex: 0,
      },
    })

    await postSync(room, { action: 'advance', energizerId: 'eg_tq', currentIndex: 1, completed: false })
    expect(await state.storage.get('active_energizer')).toMatchObject({ currentIndex: 1, status: 'active' })

    await postSync(room, { action: 'advance', energizerId: 'eg_tq', currentIndex: 1, completed: true })
    expect(await state.storage.get('active_energizer')).toMatchObject({ status: 'completed' })

    const completedMsg = voter
      .messages<{ type: string; data: { energizer?: { status?: string } } }>()
      .filter((entry) => entry.type === 'energizer_state')
      .at(-1)
    expect(completedMsg?.data.energizer?.status).toBe('completed')
  })

  it('advance for a non-active energizer id reports applied=false', async () => {
    const { room } = await buildRoom()
    const res = await postSync(room, { action: 'advance', energizerId: 'eg_missing', currentIndex: 1, completed: false })
    expect(await res.json()).toMatchObject({ ok: true, applied: false })
  })

  it('complete finalises the active energizer', async () => {
    const { room, state } = await buildRoom()
    await postSync(room, { action: 'activate', energizer: EMOJI_POLL })
    const res = await postSync(room, { action: 'complete', energizerId: 'eg_emoji' })
    expect(await res.json()).toMatchObject({ ok: true, applied: true })
    expect(await state.storage.get('active_energizer')).toMatchObject({ status: 'completed' })
  })

  it('rejects malformed payloads', async () => {
    const { room } = await buildRoom()
    const res = await postSync(room, { action: 'activate' })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid energizer payload with applied=false', async () => {
    const { room } = await buildRoom()
    const res = await postSync(room, { action: 'activate', energizer: { id: '', kind: 'nope' } })
    expect(await res.json()).toMatchObject({ ok: true, applied: false })
  })
})

describe('emoji_poll / word_cloud live answers (single plane, audit E-2)', () => {
  it('tallies emoji answers into optionCounts and lets a voter change their vote', async () => {
    const { room, state } = await buildRoom()
    const a = connectVoter(state, 'anon_a', 'ip_a')
    const b = connectVoter(state, 'anon_b', 'ip_b')
    await postSync(room, { action: 'activate', energizer: EMOJI_POLL })

    await sendMessage(room, a, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_emoji', value: '🔥' }, timestamp: 0 })
    await sendMessage(room, b, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_emoji', value: '🔥' }, timestamp: 0 })
    // Changing a vote replaces the previous answer (upsert semantics).
    await sendMessage(room, a, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_emoji', value: '🎉' }, timestamp: 0 })
    await room.alarm()

    expect(await state.storage.get('active_energizer')).toMatchObject({
      optionCounts: { '🔥': 1, '🎉': 1 },
    })

    const msg = b
      .messages<{ type: string; data: { energizer?: { optionCounts?: Record<string, number>; answers?: { voterId: string }[] } } }>()
      .filter((entry) => entry.type === 'energizer_state')
      .at(-1)
    // Aggregate counts reach every voter; raw answers stay redacted to own.
    expect(msg?.data.energizer?.optionCounts).toEqual({ '🔥': 1, '🎉': 1 })
    expect(msg?.data.energizer?.answers).toMatchObject([{ voterId: 'anon_b' }])
  })

  it('rejects an emoji outside the configured options', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_bad')
    await postSync(room, { action: 'activate', energizer: EMOJI_POLL })

    await sendMessage(room, voter, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_emoji', value: '💀' }, timestamp: 0 })

    const err = voter.messages<{ type: string; data: { code?: string } }>().find(
      (entry) => entry.type === 'error' && entry.data.code === 'bad_energizer_answer',
    )
    expect(err).toBeTruthy()
  })

  it('word_cloud accepts single words only', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_wc')
    await postSync(room, {
      action: 'activate',
      energizer: { id: 'eg_wc', kind: 'word_cloud', title: 'One word', status: 'active' },
    })

    await sendMessage(room, voter, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_wc', value: 'two words' }, timestamp: 0 })
    const err = voter.messages<{ type: string; data: { code?: string } }>().find(
      (entry) => entry.type === 'error' && entry.data.code === 'bad_energizer_answer',
    )
    expect(err).toBeTruthy()

    await sendMessage(room, voter, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_wc', value: 'focus' }, timestamp: 0 })
    await room.alarm()
    expect(await state.storage.get('active_energizer')).toMatchObject({
      optionCounts: { focus: 1 },
    })
  })
})

describe('/energizer-state — host-only live read model', () => {
  it('returns the full unredacted active energizer', async () => {
    const { room, state } = await buildRoom()
    const voter = connectVoter(state, 'anon_read')
    await postSync(room, {
      action: 'activate',
      energizer: {
        id: 'eg_qf2',
        kind: 'quick_finger',
        title: 'Fast!',
        status: 'active',
        options: ['A', 'B'],
        correctIndex: 0,
      },
    })
    await sendMessage(room, voter, { v: 1, type: 'energizer_answer', data: { energizerId: 'eg_qf2', value: 'A' }, timestamp: 0 })

    const res = await room.fetch(new Request('https://do.internal/energizer-state', { method: 'GET' }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; energizer: { id: string; correctIndex?: number; answers?: unknown[] } }
    expect(body.energizer).toMatchObject({ id: 'eg_qf2', correctIndex: 0 })
    expect(body.energizer.answers).toHaveLength(1)
  })

  it('returns null when no energizer is active', async () => {
    const { room } = await buildRoom()
    const res = await room.fetch(new Request('https://do.internal/energizer-state', { method: 'GET' }))
    expect((await res.json()) as { energizer: null }).toMatchObject({ energizer: null })
  })
})
