/**
 * Requirement: ADR-042 Phase 2.2 (buffered vote flush) + ADR-0001 (DO per session) — buffered votes always reach D1.
 */
// Regression: a DO has ONE alarm and every scheduler only moves it earlier.
// The 100ms results-broadcast alarm replaced the 5s vote-flush alarm; when it
// fired before the flush interval nothing re-armed, so trailing votes lived in
// memory only and were lost when the DO was evicted or redeployed.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import { D1Mock } from '../helpers/d1-mock'
import { FLUSH_INTERVAL_MS } from '../../functions/api/lib/session-room-types'

afterEach(() => vi.restoreAllMocks())

async function setup() {
  const state = new MockDurableObjectState()
  const db = new D1Mock()
  const env = { ENV: 'dev', PAGES_URL: 'http://local', API_URL: 'http://local', JWT_SECRET: testJwtSecret(), LIVE_ENERGIZERS_ENABLED: 'false', DB: db as unknown as D1Database } as unknown as Env
  const room = new SessionRoom(state as unknown as DurableObjectState, env)
  const res = await room.fetch(new Request('https://do.internal/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'sess_rearm', ownerId: 'user_host', code: 'RRM001', title: 'Rearm', votePolicy: 'once',
      question: { id: 'q_1', kind: 'poll', prompt: 'Pick', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
    }),
  }))
  expect(res.status).toBe(200)
  return { room, state, db }
}

function voter(state: MockDurableObjectState, id: string): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment({ role: 'voter', voterId: id, ipHash: `ip_${id}`, bucket: { tokens: 10, lastAt: 0 } })
  state.acceptWebSocket(ws, [`ip:ip_${id}`, `voter:${id}`, 'role:voter'])
  return ws
}

/** workerd clears the alarm before invoking alarm(); the mock does not. */
async function fireAlarm(room: SessionRoom, state: MockDurableObjectState) {
  ;(state.storage as unknown as { alarm: number | null }).alarm = null
  await room.alarm()
}

describe('SessionRoom alarm re-arm', () => {
  it('re-arms the flush after the debounced broadcast alarm fires early', async () => {
    let clock = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    const { room, state, db } = await setup()
    const ws = voter(state, 'anon_1')
    await room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ type: 'vote', data: { questionId: 'q_1', optionId: 'a' }, timestamp: 0 }))

    // The broadcast alarm (+100ms) fires first: results go out, no flush yet.
    clock += 150
    await fireAlarm(room, state)
    expect([...db.votes.values()].length).toBe(0)

    // …and the flush deadline must have been re-armed (previously: null).
    const next = await state.storage.getAlarm()
    expect(next).not.toBeNull()
    expect(next!).toBeLessThanOrEqual(clock + FLUSH_INTERVAL_MS)

    // When it fires, the vote reaches D1.
    clock = next!
    await fireAlarm(room, state)
    expect([...db.votes.values()].length).toBe(1)
  })
})
