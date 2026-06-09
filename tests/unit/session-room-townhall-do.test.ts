// TOWNHALL-04 (ADR-0044): DO integration for the townhall Q&A board. Uses the same
// MockDurableObjectState / MockWebSocket harness as session-room.test.ts — sockets are
// registered manually and webSocketMessage is driven directly.

import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'

function makeEnv(townhall = true, db: D1Mock = new D1Mock()): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    LIVE_ENERGIZERS_ENABLED: 'false',
    ...(townhall ? { REALTIME_TOWNHALL_ENABLED: 'true' } : {}),
    DB: db as unknown as D1Database,
  } as unknown as Env
}

async function buildRoom(townhall = true) {
  const state = new MockDurableObjectState()
  const db = new D1Mock()
  const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv(townhall, db))
  return { room, state, db }
}

async function initTownhall(room: SessionRoom, moderation: 'pre' | 'post' = 'pre') {
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_th',
        ownerId: 'user_host',
        code: 'TWN123',
        title: 'All-Hands Q&A',
        sessionMode: 'townhall',
        townhallModeration: moderation,
      }),
    }),
  )
  expect(res.status).toBe(200)
}

async function initPoll(room: SessionRoom) {
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_poll',
        ownerId: 'user_host',
        code: 'POLL01',
        title: 'Poll session',
        sessionMode: 'reflection',
      }),
    }),
  )
  expect(res.status).toBe(200)
}

function connectVoter(state: MockDurableObjectState, voterId: string, ipHash = 'ipv'): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({ role: 'voter', voterId, ipHash, bucket: { tokens: 10, lastAt: 0 } })
  state.acceptWebSocket(ws, [`ip:${ipHash}`, `voter:${voterId}`, 'role:voter'])
  return ws
}

function connectPresenter(state: MockDurableObjectState, permissions?: string[]): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({
    role: 'presenter',
    voterId: 'host_1',
    ipHash: 'ipp',
    bucket: { tokens: 10, lastAt: 0 },
    ...(permissions !== undefined ? { permissions } : {}),
  })
  state.acceptWebSocket(ws, ['ip:ipp', 'voter:host_1', 'role:presenter'])
  return ws
}

const send = (room: SessionRoom, ws: MockWebSocket, msg: unknown) =>
  room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg))

type Frame = { type: string; data: Record<string, any> }
const frames = (ws: MockWebSocket) => ws.messages<Frame>()
const last = (ws: MockWebSocket, type: string) => frames(ws).filter((m) => m.type === type).at(-1)

describe('townhall init + snapshot', () => {
  it('advertises townhall_board and returns an empty board snapshot', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'pre')
    const ws = connectVoter(state, 'v1')
    await send(room, ws, { type: 'request_state', data: {}, timestamp: 0 })

    const init = last(ws, 'init')
    expect(init?.data.features).toContain('townhall_board')
    const snap = last(ws, 'townhall_state')
    expect(snap?.data).toMatchObject({ moderation: 'pre', items: [], spotlightId: null, rev: 0 })
  })

  it('does not enable townhall when the flag is off', async () => {
    const { room, state } = await buildRoom(false)
    await initTownhall(room, 'pre')
    const ws = connectVoter(state, 'v1')
    await send(room, ws, { type: 'request_state', data: {}, timestamp: 0 })
    expect(last(ws, 'init')?.data.features).not.toContain('townhall_board')

    await send(room, ws, { type: 'townhall_submit', data: { body: 'Will this work?' }, timestamp: 0 })
    expect(last(ws, 'error')?.data.code).toBe('unsupported_feature')
  })
})

describe('pre-moderation visibility', () => {
  it('hides pending submissions from the audience; presenter sees them', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'pre')
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'v1')

    await send(room, voter, { type: 'townhall_submit', data: { body: 'How is Q3 tracking?' }, timestamp: 0 })

    // Presenter sees a pending item; audience (voter) sees no added frame.
    const added = last(presenter, 'townhall_question_added')
    expect(added?.data.item.status).toBe('pending')
    expect(frames(voter).some((m) => m.type === 'townhall_question_added')).toBe(false)
  })

  it('reveals the item to the audience on approve', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'pre')
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'How is Q3 tracking?' }, timestamp: 0 })
    const itemId = last(presenter, 'townhall_question_added')!.data.item.id

    await send(room, presenter, { type: 'townhall_moderate', data: { itemId, action: 'approve' }, timestamp: 0 })

    const voterAdded = last(voter, 'townhall_question_added')
    expect(voterAdded?.data.item.id).toBe(itemId)
    expect(voterAdded?.data.item.status).toBe('approved')
  })
})

describe('post-moderation visibility', () => {
  it('shows submissions to the audience immediately', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const voter = connectVoter(state, 'v1')
    const watcher = connectVoter(state, 'v2', 'ipv2')

    await send(room, voter, { type: 'townhall_submit', data: { body: 'Any layoffs planned?' }, timestamp: 0 })

    expect(last(watcher, 'townhall_question_added')?.data.item.status).toBe('approved')
  })
})

describe('upvotes', () => {
  it('increments once and rejects duplicates from the same voter', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const author = connectVoter(state, 'v1')
    const voter = connectVoter(state, 'v2', 'ipv2')
    await send(room, author, { type: 'townhall_submit', data: { body: 'Bonus this year?' }, timestamp: 0 })
    const itemId = last(voter, 'townhall_question_added')!.data.item.id

    await send(room, voter, { type: 'townhall_upvote', data: { itemId }, timestamp: 0 })
    expect(last(voter, 'townhall_question_updated')?.data.item.upvotes).toBe(1)

    await send(room, voter, { type: 'townhall_upvote', data: { itemId }, timestamp: 0 })
    expect(last(voter, 'error')?.data.code).toBe('duplicate')
  })
})

describe('moderation permission', () => {
  it('rejects moderation without session:moderate', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'pre')
    const presenter = connectPresenter(state)
    const noPerms = connectPresenter(state, []) // explicit empty permissions → not allowed
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'A question here' }, timestamp: 0 })
    const itemId = last(presenter, 'townhall_question_added')!.data.item.id

    await send(room, noPerms, { type: 'townhall_moderate', data: { itemId, action: 'approve' }, timestamp: 0 })
    expect(last(noPerms, 'error')?.data.code).toBe('forbidden')
  })
})

describe('back-compat & abuse (TOWNHALL-14)', () => {
  it('rejects townhall messages on a non-townhall (poll) session', async () => {
    const { room, state } = await buildRoom() // flag on, but session is reflection mode
    await initPoll(room)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'Should not work' }, timestamp: 0 })
    expect(last(voter, 'error')?.data.code).toBe('unsupported_feature')
  })

  it('enforces the submit token bucket (4th rapid submit rejected)', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const voter = connectVoter(state, 'v1')
    for (const body of ['One?', 'Two?', 'Three?']) {
      await send(room, voter, { type: 'townhall_submit', data: { body }, timestamp: 0 })
    }
    await send(room, voter, { type: 'townhall_submit', data: { body: 'Four?' }, timestamp: 0 })
    expect(last(voter, 'error')?.data.code).toBe('rate_limited')
  })

  it('suppresses duplicate question bodies', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'Same question?' }, timestamp: 0 })
    await send(room, voter, { type: 'townhall_submit', data: { body: 'same   QUESTION?' }, timestamp: 0 })
    expect(last(voter, 'error')?.data.code).toBe('duplicate')
  })

  it('groups a duplicate under a parent, merging upvotes and hiding the child', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const presenter = connectPresenter(state)
    const a = connectVoter(state, 'va', 'ipa')
    const b = connectVoter(state, 'vb', 'ipb')
    await send(room, a, { type: 'townhall_submit', data: { body: 'Parent question?' }, timestamp: 0 })
    const parentId = last(presenter, 'townhall_question_added')!.data.item.id
    await send(room, b, { type: 'townhall_submit', data: { body: 'Child duplicate?' }, timestamp: 0 })
    const childId = last(presenter, 'townhall_question_added')!.data.item.id
    // Same voter upvotes both → union must not double-count.
    await send(room, a, { type: 'townhall_upvote', data: { itemId: parentId }, timestamp: 0 })
    await send(room, a, { type: 'townhall_upvote', data: { itemId: childId }, timestamp: 0 })

    await send(room, presenter, {
      type: 'townhall_moderate',
      data: { itemId: childId, action: 'group', groupParentId: parentId },
      timestamp: 0,
    })

    // Audience loses the child; parent reflects the merged (union) count + grouped badge.
    expect(last(a, 'townhall_question_removed')?.data.itemId).toBe(childId)
    const parentUpdate = frames(presenter)
      .filter((m) => m.type === 'townhall_question_updated' && m.data.item?.id === parentId)
      .at(-1)
    expect(parentUpdate?.data.item.groupedCount).toBe(1)
    expect(parentUpdate?.data.item.upvotes).toBe(1) // union of {va} and {va}

    // Ungroup restores the child to the audience.
    await send(room, presenter, { type: 'townhall_moderate', data: { itemId: childId, action: 'ungroup' }, timestamp: 0 })
    expect(last(a, 'townhall_question_added')?.data.item.id).toBe(childId)
  })

  it('resyncs the full board on request_state', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'On the board' }, timestamp: 0 })
    await send(room, voter, { type: 'request_state', data: {}, timestamp: 0 })
    const snap = last(voter, 'townhall_state')
    expect(snap?.data.items.length).toBe(1)
    expect(snap?.data.items[0].body).toBe('On the board')
  })
})

describe('persist-on-close', () => {
  it('writes the board to D1 with merged upvotes and spotlight history', async () => {
    const { room, state, db } = await buildRoom()
    await initTownhall(room, 'post')
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'Persist me' }, timestamp: 0 })
    const itemId = last(presenter, 'townhall_question_added')!.data.item.id
    await send(room, voter, { type: 'townhall_upvote', data: { itemId }, timestamp: 0 })
    await send(room, presenter, { type: 'townhall_moderate', data: { itemId, action: 'spotlight' }, timestamp: 0 })
    await send(room, presenter, { type: 'townhall_moderate', data: { itemId, action: 'answer' }, timestamp: 0 })

    await room.fetch(new Request('https://do.internal/close', { method: 'POST' }))

    const row = db.townhallQuestions.get(itemId)
    expect(row).toBeTruthy()
    expect(row?.upvotes).toBe(1)
    expect(row?.was_spotlit).toBe(1)
    expect(row?.status).toBe('answered')
    expect(row?.resolved_at).not.toBeNull()
    expect(row?.author_hash).toBe('v1')
  })
})

describe('spotlight', () => {
  it('broadcasts spotlight changes to everyone', async () => {
    const { room, state } = await buildRoom()
    await initTownhall(room, 'post')
    const presenter = connectPresenter(state)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'townhall_submit', data: { body: 'Spotlight me' }, timestamp: 0 })
    const itemId = last(presenter, 'townhall_question_added')!.data.item.id

    await send(room, presenter, { type: 'townhall_moderate', data: { itemId, action: 'spotlight' }, timestamp: 0 })

    expect(last(voter, 'townhall_spotlight_changed')?.data.spotlightId).toBe(itemId)
    expect(last(presenter, 'townhall_spotlight_changed')?.data.spotlightId).toBe(itemId)
  })
})
