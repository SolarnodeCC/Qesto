import { describe, expect, it } from 'vitest'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'

function makeEnv(db: D1Mock = new D1Mock()): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'irrelevant',
    LIVE_ENERGIZERS_ENABLED: 'false',
    DB: db as unknown as D1Database,
  } as unknown as Env
}

async function buildRoom() {
  const state = new MockDurableObjectState()
  const db = new D1Mock()
  const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv(db))
  return { room, state, db }
}

async function initRetro(room: SessionRoom, carriedActions: string[] = []) {
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_retro',
        ownerId: 'user_host',
        code: 'RET123',
        title: 'Sprint Retro',
        sessionMode: 'retro',
        retroDotVoteLimit: 2,
        retroCarriedActions: carriedActions,
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

function connectPresenter(state: MockDurableObjectState): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({ role: 'presenter', voterId: 'host_1', ipHash: 'ipp', bucket: { tokens: 10, lastAt: 0 } })
  state.acceptWebSocket(ws, ['ip:ipp', 'voter:host_1', 'role:presenter'])
  return ws
}

const send = (room: SessionRoom, ws: MockWebSocket, msg: unknown) =>
  room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg))

type Frame = { type: string; data: Record<string, unknown> }
const frames = (ws: MockWebSocket) => ws.messages<Frame>()
const last = (ws: MockWebSocket, type: string) => frames(ws).filter((m) => m.type === type).at(-1)

describe('retro init + snapshot', () => {
  it('returns retro_state with carried action items', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room, ['Improve CI pipeline'])
    const ws = connectVoter(state, 'v1')
    await send(room, ws, { type: 'request_state', data: {}, timestamp: 0 })

    const snap = last(ws, 'retro_state')
    expect(snap?.data).toMatchObject({ dotVoteLimit: 2, rev: 1 })
    const items = snap?.data.items as Array<{ column: string; body: string; carried?: boolean }>
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ column: 'actions', body: 'Improve CI pipeline', carried: true })
  })
})

describe('retro submit', () => {
  it('broadcasts new cards to all clients', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room)
    const voter = connectVoter(state, 'v1')
    const watcher = connectVoter(state, 'v2', 'ipv2')

    await send(room, voter, { type: 'retro_submit', data: { column: 'went_well', body: 'Great collaboration' }, timestamp: 0 })

    const added = last(watcher, 'retro_item_added')
    expect(added?.data.item).toMatchObject({ column: 'went_well', body: 'Great collaboration' })
  })

  it('rejects invalid column', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'retro_submit', data: { column: 'invalid', body: 'Nope' }, timestamp: 0 })
    expect(last(voter, 'error')).toBeDefined()
  })
})

describe('retro dot votes', () => {
  it('allows dot votes on action items only', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'retro_submit', data: { column: 'went_well', body: 'Shipped on time' }, timestamp: 0 })
    const wellId = (last(voter, 'retro_item_added')?.data.item as { id: string }).id

    await send(room, voter, { type: 'retro_upvote', data: { itemId: wellId }, timestamp: 0 })
    expect(last(voter, 'error')?.data).toMatchObject({ code: 'validation' })
  })

  it('enforces dot vote limit per voter', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room)
    const voter = connectVoter(state, 'v1')
    const ids: string[] = []
    for (const body of ['Action A', 'Action B', 'Action C']) {
      await send(room, voter, { type: 'retro_submit', data: { column: 'actions', body }, timestamp: 0 })
      ids.push((last(voter, 'retro_item_added')?.data.item as { id: string }).id)
    }
    await send(room, voter, { type: 'retro_upvote', data: { itemId: ids[0] }, timestamp: 0 })
    await send(room, voter, { type: 'retro_upvote', data: { itemId: ids[1] }, timestamp: 0 })
    await send(room, voter, { type: 'retro_upvote', data: { itemId: ids[2] }, timestamp: 0 })
    expect(last(voter, 'error')?.data).toMatchObject({ code: 'limit' })
  })
})

describe('retro close', () => {
  it('returns action items on close', async () => {
    const { room, state } = await buildRoom()
    await initRetro(room, ['Carried action'])
    const presenter = connectPresenter(state)
    await send(room, presenter, { type: 'retro_submit', data: { column: 'actions', body: 'New action' }, timestamp: 0 })

    // Transition to live status in storage (init sets live)
    const closeRes = await room.fetch(new Request('https://do.internal/close', { method: 'POST' }))
    expect(closeRes.status).toBe(200)
    const body = (await closeRes.json()) as {
      ok: boolean
      data: {
        retroActionItems: string[]
        retroStats: { wentWell: number; didntGoWell: number; actions: number; totalCards: number }
      }
    }
    expect(body.ok).toBe(true)
    expect(body.data.retroActionItems).toContain('Carried action')
    expect(body.data.retroActionItems).toContain('New action')
    expect(body.data.retroStats.totalCards).toBeGreaterThanOrEqual(2)
  })
})
