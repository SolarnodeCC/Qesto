// XR-AVATAR-01 edge-case and robustness tests for ADR-0066.
//
// Coverage of spec and security-review concerns:
//   - rev monotonicity under rapid successive ticks (never decreases; strictly > per fan-out).
//   - avatar cap / many-socket fan-out: 50+ sockets contributing poses merged correctly,
//     bounded per-frame avatars, no per-frame broadcast (broadcast only on tick).
//   - late-join + disconnect interleaving: join mid-session, disconnect removes from next
//     fan-out + writes nothing to storage.
//   - ZK toggle: session with anonymity==='zero_knowledge' never broadcasts xr and never
//     emits the AE event, regardless of flag state.
//   - AE privacy invariant: xr.avatar_sync_latency event has no coordinate values, no voterId.
//   - flag-off inertness: inbound xr_avatar_sync with flag off produces zero side effects
//     (no broadcast, no avatar state mutation, no AE event).

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types'
import { XrAvatarHandler } from '../../functions/api/lib/session-room-xr-handler'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import type { Attachment, Meta } from '../../functions/api/lib/session-room-types'
import type { Env } from '../../functions/api/types'
import { K_META } from '../../functions/api/lib/session-room-storage-keys'

function att(voterId: string): Attachment {
  return { role: 'voter', voterId, ipHash: 'h', bucket: { tokens: 10, lastAt: 0 } }
}

function connect(state: MockDurableObjectState, a: Attachment): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment(a)
  state.acceptWebSocket(ws, [`voter:${a.voterId}`])
  return ws
}

const asWs = (ws: MockWebSocket) => ws as unknown as WebSocket

const baseMeta: Meta = {
  sessionId: 'sess-xr-edge-1',
  ownerId: 'owner-1',
  teamId: 'team-1',
  code: 'EDGE1234',
  title: 'Edge Case Demo',
  startedAt: Date.now(),
  votePolicy: 'once',
  sessionMode: 'reflection',
  plan: 'team',
}

const P: [number, number, number] = [0.1, -0.2, 0.3]
const Q: [number, number, number, number] = [0, 0, 0, 1]

function makeEnv(flag: 'true' | 'false', ae?: AnalyticsEngineDataset): Env {
  return { BETA_XR_ENABLED: flag, METRICS_AE: ae } as unknown as Env
}

function mkAe(): AnalyticsEngineDataset {
  return { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
}

function deltas(ws: MockWebSocket) {
  return ws.messages<{ type: string; data: { avatars: unknown[]; rev: number } }>().filter(
    (m) => m.type === 'xr_avatar_sync',
  )
}

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — rev monotonicity under rapid ticks', () => {
  let state: MockDurableObjectState
  let handler: XrAvatarHandler
  let env: Env

  beforeEach(async () => {
    state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    env = makeEnv('true')
    handler = new XrAvatarHandler(state as never, env)
  })

  it('rev never decreases across consecutive flushTick calls', async () => {
    const ws = connect(state, att('v1'))

    // Five consecutive ticks with pose updates; rev should monotonically increase.
    const revs: number[] = []
    for (let i = 0; i < 5; i++) {
      const p: [number, number, number] = [i * 0.1, i * 0.05, i * 0.2]
      await handler.handleSync(asWs(ws), att('v1'), { p, q: Q })
      handler.flushTick()
      const d = deltas(ws)
      if (d.length > 0) {
        revs.push(d[d.length - 1].data.rev)
      }
    }

    // Each rev is strictly greater than the previous.
    for (let i = 1; i < revs.length; i++) {
      expect(revs[i]).toBeGreaterThan(revs[i - 1])
    }
  })

  it('rev increments exactly once per flushTick even with multiple pose updates coalesced', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    // Multiple pose updates from different sockets within the batching window.
    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    await handler.handleSync(asWs(ws1), att('v1'), { p: [0.2, 0.2, 0.2], q: Q })

    handler.flushTick()

    const d1 = deltas(ws1)
    const d2 = deltas(ws2)
    expect(d1).toHaveLength(1)
    expect(d2).toHaveLength(1)
    expect(d1[0].data.rev).toBe(d2[0].data.rev)
    expect(d1[0].data.rev).toBe(1)
  })

  it('rev continues strictly increasing with each new pose update', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()
    const rev1 = deltas(ws)[0].data.rev
    expect(rev1).toBe(1)

    // Update pose and flush — rev should increment.
    await handler.handleSync(asWs(ws), att('v1'), { p: [0.3, 0.3, 0.3], q: Q })
    handler.flushTick()
    const d2 = deltas(ws)
    expect(d2).toHaveLength(2)
    expect(d2[1].data.rev).toBe(2)
    expect(d2[1].data.rev).toBeGreaterThan(rev1)

    // Another update.
    await handler.handleSync(asWs(ws), att('v1'), { p: [0.4, 0.4, 0.4], q: Q })
    handler.flushTick()
    const d3 = deltas(ws)
    expect(d3).toHaveLength(3)
    expect(d3[2].data.rev).toBe(3)
    expect(d3[2].data.rev).toBeGreaterThan(d2[1].data.rev)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — avatar cap / many-socket fan-out', () => {
  let state: MockDurableObjectState
  let handler: XrAvatarHandler
  let env: Env

  beforeEach(async () => {
    state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    env = makeEnv('true')
    handler = new XrAvatarHandler(state as never, env)
  })

  it('handles 50 concurrent sockets with unique poses, all merged in one tick', async () => {
    const sockets: MockWebSocket[] = []
    for (let i = 0; i < 50; i++) {
      const ws = connect(state, att(`v${i}`))
      sockets.push(ws)
      const p: [number, number, number] = [
        (i % 10) * 0.1,
        Math.floor(i / 10) * 0.1,
        (i % 5) * 0.2,
      ]
      await handler.handleSync(asWs(ws), att(`v${i}`), { p, q: Q })
    }

    expect(handler.activeAvatarCount()).toBe(50)
    handler.flushTick()

    // Every socket receives exactly one broadcast with all 50 avatars.
    for (const ws of sockets) {
      const d = deltas(ws)
      expect(d).toHaveLength(1)
      expect(d[0].data.avatars).toHaveLength(50)
    }
  })

  it('broadcasts only once per tick even with multiple pose updates per socket', async () => {
    const ws = connect(state, att('v1'))

    // Multiple rapid pose updates from the same socket within the tick window.
    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws), att('v1'), { p: [0.2, 0.2, 0.2], q: Q })
    await handler.handleSync(asWs(ws), att('v1'), { p: [0.3, 0.3, 0.3], q: Q })

    handler.flushTick()

    // Only one broadcast, with the final pose.
    const d = deltas(ws)
    expect(d).toHaveLength(1)
    expect(d[0].data.avatars).toHaveLength(1)
    const avatar = d[0].data.avatars[0] as { p: [number, number, number] }
    expect(avatar.p).toEqual([0.3, 0.3, 0.3])
  })

  it('correctly merges avatars with stable ephemeral ids across poses', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    // Initial pose from ws1.
    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    handler.flushTick()
    const firstAvatarId = (deltas(ws1)[0].data.avatars[0] as { a: string }).a

    // Update pose from same socket — should reuse avatar id.
    await handler.handleSync(asWs(ws1), att('v1'), { p: [0.2, 0.2, 0.2], q: Q })
    handler.flushTick()
    const secondAvatarId = (deltas(ws1)[1].data.avatars[0] as { a: string }).a
    expect(secondAvatarId).toBe(firstAvatarId)

    // New socket gets a different avatar id.
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    handler.flushTick()
    const broadcast = deltas(ws1)[2]
    expect(broadcast.data.avatars).toHaveLength(2)
    const ids = (broadcast.data.avatars as Array<{ a: string }>).map((a) => a.a)
    expect(new Set(ids).size).toBe(2)
  })

  it('does not broadcast per-frame for each inbound pose update', async () => {
    const ws1 = connect(state, att('v1'))

    // Simulate rapid inbound updates (not driven by flushTick).
    // The handler should schedule only one tick, not one per handleSync.
    const syncPromises = []
    for (let i = 0; i < 10; i++) {
      syncPromises.push(
        handler.handleSync(asWs(ws1), att('v1'), { p: [i * 0.01, 0, 0], q: Q })
      )
    }
    await Promise.all(syncPromises)

    // At this point, tickScheduled should be true but no flush yet.
    // If the implementation broadcasts per inbound, we'd see 10 messages.
    // With proper batching, only one scheduled tick pending.
    const beforeFlush = deltas(ws1).length
    expect(beforeFlush).toBe(0) // No broadcast until flushTick.

    handler.flushTick()
    const afterFlush = deltas(ws1).length
    expect(afterFlush).toBe(1) // Exactly one broadcast from one tick, despite 10 inbound poses.
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — late-join + disconnect interleaving', () => {
  let state: MockDurableObjectState
  let handler: XrAvatarHandler
  let env: Env

  beforeEach(async () => {
    state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    env = makeEnv('true')
    handler = new XrAvatarHandler(state as never, env)
  })

  it('adds late-joining socket to broadcast on next tick', async () => {
    const ws1 = connect(state, att('v1'))
    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    handler.flushTick()
    expect(deltas(ws1)).toHaveLength(1)

    // New socket joins mid-session.
    const ws2 = connect(state, att('v2'))
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    handler.flushTick()

    // ws1 should now see 2 avatars.
    expect(deltas(ws1)[1].data.avatars).toHaveLength(2)
    expect(deltas(ws2)[0].data.avatars).toHaveLength(2)
  })

  it('removes disconnected socket on next tick, no broadcast for it', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))
    const ws3 = connect(state, att('v3'))

    for (const ws of [ws1, ws2, ws3]) {
      await handler.handleSync(asWs(ws), att((ws.deserializeAttachment() as { voterId: string }).voterId), {
        p: P,
        q: Q,
      })
    }
    handler.flushTick()
    expect(handler.activeAvatarCount()).toBe(3)

    // ws2 disconnects.
    handler.forget(asWs(ws2))
    expect(handler.activeAvatarCount()).toBe(2)

    // Pose update from ws3 triggers next tick.
    await handler.handleSync(asWs(ws3), att('v3'), { p: [0.2, 0.2, 0.2], q: Q })
    handler.flushTick()

    // Next broadcast should have 2 avatars (ws1, ws3), not 3.
    const d = deltas(ws1)
    expect(d[d.length - 1].data.avatars).toHaveLength(2)
  })

  it('never persists avatar state for disconnected sockets', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    handler.flushTick()

    handler.forget(asWs(ws2))

    // Storage should never contain any avatar/xr keys.
    const keys = [...(await state.storage.list()).keys()]
    expect(keys.some((k) => k.toLowerCase().includes('avatar') || k.toLowerCase().includes('xr'))).toBe(false)
  })

  it('pruneClosed removes closed sockets from broadcast even if forget was not called', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    handler.flushTick()
    expect(deltas(ws1)).toHaveLength(1)

    // ws2 closes (without calling forget).
    ws2.close()

    // Next tick should prune ws2 automatically.
    await handler.handleSync(asWs(ws1), att('v1'), { p: [0.2, 0.2, 0.2], q: Q })
    handler.flushTick()

    // Broadcast should have 1 avatar (ws1 only).
    const d = deltas(ws1)
    expect(d[d.length - 1].data.avatars).toHaveLength(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — ZK toggle exclusion', () => {
  it('ignores xr_avatar_sync entirely when anonymity is zero_knowledge, flag on', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, { ...baseMeta, anonymity: 'zero_knowledge' })
    const ae = mkAe()
    const env = makeEnv('true', ae)
    const handler = new XrAvatarHandler(state as never, env)

    const ws = connect(state, att('v1'))
    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    // No avatar state, no broadcast, no AE event.
    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('ignores xr_avatar_sync for ZK sessions even if flag is off (guard order)', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, { ...baseMeta, anonymity: 'zero_knowledge' })
    const ae = mkAe()
    const env = makeEnv('false', ae)
    const handler = new XrAvatarHandler(state as never, env)

    const ws = connect(state, att('v1'))
    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    // Flag-off takes precedence; no side effects.
    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('allows xr when anonymity is not zero_knowledge (e.g., none, full, partial)', async () => {
    for (const anonMode of [undefined, 'none', 'full', 'partial']) {
      const state = new MockDurableObjectState()
      const meta: Meta = { ...baseMeta, ...(anonMode ? { anonymity: anonMode as any } : {}) }
      await state.storage.put(K_META, meta)
      const handler = new XrAvatarHandler(state as never, makeEnv('true'))

      const ws = connect(state, att('v1'))
      await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
      handler.flushTick()

      // Should accept the pose and broadcast.
      expect(handler.activeAvatarCount()).toBe(1)
      expect(deltas(ws)).toHaveLength(1)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — AE privacy invariant', () => {
  let state: MockDurableObjectState
  let ae: AnalyticsEngineDataset
  let handler: XrAvatarHandler

  beforeEach(async () => {
    state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    ae = mkAe()
    handler = new XrAvatarHandler(state as never, makeEnv('true', ae))
  })

  it('emits xr.avatar_sync_latency with no coordinates in the event payload', async () => {
    const ws = connect(state, att('v1'))
    const p: [number, number, number] = [0.42, 0.13, -0.7]
    const q: [number, number, number, number] = [0.1, 0.2, 0.3, 0.9]

    await handler.handleSync(asWs(ws), att('v1'), { p, q })
    handler.flushTick()

    await vi.waitFor(() => expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled())

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as any
    const serialized = JSON.stringify(dp)

    // No coordinate values anywhere in the event.
    expect(serialized).not.toContain('0.42')
    expect(serialized).not.toContain('0.13')
    expect(serialized).not.toContain('-0.7')
    expect(serialized).not.toContain('0.1')
    expect(serialized).not.toContain('0.2')
    expect(serialized).not.toContain('0.3')
    expect(serialized).not.toContain('0.9')
  })

  it('emits xr.avatar_sync_latency with no voterId in the event payload', async () => {
    const voterId = 'voter-secret-xyz-12345'
    const ws = connect(state, att(voterId))

    await handler.handleSync(asWs(ws), att(voterId), { p: P, q: Q })
    handler.flushTick()

    await vi.waitFor(() => expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled())

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as any
    const serialized = JSON.stringify(dp)

    // No voterId anywhere.
    expect(serialized).not.toContain(voterId)
  })

  it('emits xr.avatar_sync_latency with no ephemeral avatar id in the event payload', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    await vi.waitFor(() => expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled())

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as any

    // The event should NOT contain any avatar id (it's only in the broadcast message, not AE).
    // Verify by ensuring the doubles[1] (count) is just a number, and no 'a' field.
    expect(typeof dp.doubles[1]).toBe('number')
    const serialized = JSON.stringify(dp)
    expect(serialized).not.toContain('xa_') // avatar id prefix
  })

  it('emits xr.avatar_sync_latency with sessionId and teamId only for context', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    await vi.waitFor(() => expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled())

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as any
    const serialized = JSON.stringify(dp)

    // Should contain sessionId and teamId for analytics context.
    expect(serialized).toContain('sess-xr-edge-1')
    expect(serialized).toContain('team-1')
  })

  it('emits latency duration and avatar count in doubles, not coordinates', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    await vi.waitFor(() => expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled())

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      doubles: number[]
    }

    // doubles[0] = durationMs, doubles[1] = count.
    expect(typeof dp.doubles[0]).toBe('number')
    expect(typeof dp.doubles[1]).toBe('number')
    expect(dp.doubles[0]).toBeGreaterThanOrEqual(0)
    expect(dp.doubles[1]).toBe(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('XrAvatarHandler — flag-off inertness', () => {
  let state: MockDurableObjectState
  let handler: XrAvatarHandler
  let ae: AnalyticsEngineDataset

  beforeEach(async () => {
    state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    ae = mkAe()
    handler = new XrAvatarHandler(state as never, makeEnv('false', ae))
  })

  it('ignores inbound xr_avatar_sync, no avatar state mutation', async () => {
    const ws = connect(state, att('v1'))

    const countBefore = handler.activeAvatarCount()
    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    const countAfter = handler.activeAvatarCount()

    expect(countBefore).toBe(0)
    expect(countAfter).toBe(0)
  })

  it('ignores inbound xr_avatar_sync, no broadcast on flushTick', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    expect(deltas(ws)).toHaveLength(0)
  })

  it('ignores inbound xr_avatar_sync, no AE event emitted', async () => {
    const ws = connect(state, att('v1'))

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    // Allow async writeEvent to settle.
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('flag off takes precedence even if session is non-ZK', async () => {
    const ws = connect(state, att('v1'))

    // Explicitly non-ZK, but flag off.
    const meta: Meta = { ...baseMeta, anonymity: 'none' }
    await state.storage.put(K_META, meta)

    await handler.handleSync(asWs(ws), att('v1'), { p: P, q: Q })
    handler.flushTick()

    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('multiple rapid calls with flag off produce no side effects', async () => {
    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    for (let i = 0; i < 10; i++) {
      await handler.handleSync(asWs(ws1), att('v1'), { p: [i * 0.01, 0, 0], q: Q })
      await handler.handleSync(asWs(ws2), att('v2'), { p: [i * 0.02, 0, 0], q: Q })
    }

    handler.flushTick()

    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws1)).toHaveLength(0)
    expect(deltas(ws2)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})
