/**
 * Requirement: ADR-0001 (DO per session) — ENERGIZING is WebSocket-only, and S5 per-IP caps must not lock out shared-NAT rooms.
 */
// handleUpgrade must accept ENERGIZING (warm-ups are delivered over the socket)
// and must not lock out a room that shares one public IP.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleUpgrade } from '../../functions/api/lib/session-room-ws-upgrade'
import type { SessionRoomContext } from '../../functions/api/lib/session-room-context'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'

const REACHED = 'reached-websocket-pair'
const g = globalThis as unknown as { WebSocketPair?: unknown }
let saved: unknown

beforeEach(() => {
  saved = g.WebSocketPair
  // Reaching the pair means every gate (status, caps, rate limit) passed.
  g.WebSocketPair = class { constructor() { throw new Error(REACHED) } }
})
afterEach(() => { g.WebSocketPair = saved })

async function ctxWith(status: string, plan: 'free' | 'team' = 'free', sameIpSockets = 0) {
  const state = new MockDurableObjectState()
  await state.storage.put('status', status)
  await state.storage.put('meta', { sessionId: 's1', plan })
  for (let i = 0; i < sameIpSockets; i++) state.acceptWebSocket(new MockWebSocket(), ['ip:iphash01', 'role:voter'])
  return {
    ctx: state,
    env: {},
    rateLimiter: { checkIpRateLimit: async () => false },
  } as unknown as SessionRoomContext
}

function upgradeReq() {
  return new Request('https://do.internal/ws', {
    headers: { upgrade: 'websocket', 'x-qesto-role': 'voter', 'x-qesto-voter': 'anon_x', 'x-qesto-ip-hash': 'iphash01' },
  })
}

describe('SessionRoom WebSocket upgrade gate', () => {
  it('accepts connections while ENERGIZING', async () => {
    await expect(handleUpgrade(await ctxWith('energizing'), upgradeReq())).rejects.toThrow(REACHED)
  })

  it('still accepts LIVE and rejects draft/closed with 409', async () => {
    await expect(handleUpgrade(await ctxWith('live'), upgradeReq())).rejects.toThrow(REACHED)
    for (const status of ['draft', 'closed']) {
      const res = await handleUpgrade(await ctxWith(status), upgradeReq())
      expect(res.status).toBe(409)
    }
  })

  it('lets the 21st attendee behind one shared IP join (free plan cap is 50)', async () => {
    await expect(handleUpgrade(await ctxWith('live', 'free', 20), upgradeReq())).rejects.toThrow(REACHED)
  })

  it('still enforces the plan participant cap', async () => {
    const res = await handleUpgrade(await ctxWith('live', 'free', 50), upgradeReq())
    expect(res.status).toBe(429)
  })
})
