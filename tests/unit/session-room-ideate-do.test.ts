import { afterEach, describe, expect, it, vi } from 'vitest'
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

async function initIdeate(room: SessionRoom, clusterDebounceMs = 1000) {
  const res = await room.fetch(
    new Request('https://do.internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_ideate',
        ownerId: 'user_host',
        code: 'IDE123',
        title: 'Sprint Ideation',
        sessionMode: 'ideate',
        ideateDotVoteLimit: 2,
        ideateClusterDebounceMs: clusterDebounceMs,
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

afterEach(() => {
  vi.useRealTimers()
})

describe('ideate init + snapshot', () => {
  it('returns ideate_state with dot vote limit', async () => {
    const { room, state } = await buildRoom()
    await initIdeate(room)
    const ws = connectVoter(state, 'v1')
    await send(room, ws, { type: 'request_state', data: {}, timestamp: 0 })

    const snap = last(ws, 'ideate_state')
    expect(snap?.data).toMatchObject({ dotVoteLimit: 2, rev: 0, ideas: [], clusters: [] })
  })
})

describe('ideate submit', () => {
  it('broadcasts new ideas to all clients', async () => {
    const { room, state } = await buildRoom()
    await initIdeate(room)
    const voter = connectVoter(state, 'v1')
    const watcher = connectVoter(state, 'v2', 'ipv2')

    await send(room, voter, { type: 'ideate_submit', data: { body: 'Ship faster releases' }, timestamp: 0 })

    const added = last(watcher, 'ideate_idea_added')
    expect(added?.data.idea).toMatchObject({ body: 'Ship faster releases', upvotes: 0 })
  })

  it('rejects bodies that are too short', async () => {
    const { room, state } = await buildRoom()
    await initIdeate(room)
    const voter = connectVoter(state, 'v1')
    await send(room, voter, { type: 'ideate_submit', data: { body: 'x' }, timestamp: 0 })
    expect(last(voter, 'error')).toBeDefined()
  })
})

describe('ideate dot votes', () => {
  it('enforces dot vote limit per voter', async () => {
    const { room, state } = await buildRoom()
    await initIdeate(room)
    const voter = connectVoter(state, 'v1')
    const ids: string[] = []
    for (const body of ['Idea A', 'Idea B', 'Idea C']) {
      await send(room, voter, { type: 'ideate_submit', data: { body }, timestamp: 0 })
      ids.push((last(voter, 'ideate_idea_added')?.data.idea as { id: string }).id)
    }
    await send(room, voter, { type: 'ideate_upvote', data: { itemId: ids[0] }, timestamp: 0 })
    await send(room, voter, { type: 'ideate_upvote', data: { itemId: ids[1] }, timestamp: 0 })
    await send(room, voter, { type: 'ideate_upvote', data: { itemId: ids[2] }, timestamp: 0 })
    expect(last(voter, 'error')?.data).toMatchObject({ code: 'limit' })
  })

  it('rejects presenter upvotes', async () => {
    const { room, state } = await buildRoom()
    await initIdeate(room)
    const presenter = connectPresenter(state)
    await send(room, presenter, { type: 'ideate_submit', data: { body: 'Host idea' }, timestamp: 0 })
    const id = (last(presenter, 'ideate_idea_added')?.data.idea as { id: string }).id
    await send(room, presenter, { type: 'ideate_upvote', data: { itemId: id }, timestamp: 0 })
    expect(last(presenter, 'error')?.data).toMatchObject({ code: 'forbidden' })
  })
})

describe('ideate clustering alarm', () => {
  it('broadcasts clusters after debounce via alarm', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)

    const { room, state } = await buildRoom()
    await initIdeate(room, 1000)
    const voter = connectVoter(state, 'v1')
    const watcher = connectVoter(state, 'v2', 'ipv2')

    await send(room, voter, { type: 'ideate_submit', data: { body: 'improve deployment pipeline speed' }, timestamp: 0 })
    await send(room, voter, { type: 'ideate_submit', data: { body: 'improve deployment pipeline quality' }, timestamp: 0 })

    vi.setSystemTime(11_500)
    await room.alarm()

    const clusterUpdate = last(watcher, 'ideate_clusters_updated')
    expect(clusterUpdate).toBeDefined()
    const clusters = clusterUpdate?.data.clusters as Array<{ ideaIds: string[] }>
    expect(clusters?.length).toBeGreaterThanOrEqual(1)
  })
})
