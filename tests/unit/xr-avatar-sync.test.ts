// XR-AVATAR-01 (ADR-0066) — privacy-safe spatial avatar sync DO handler tests.
//
// Coverage:
//   - flag OFF → inbound xr_avatar_sync is ignored (no broadcast, no AE).
//   - ZK session → ignored even with flag ON (R3 — ZK excludes XR).
//   - flag ON + non-ZK → avatar state merges and broadcasts with monotonic rev.
//   - transient state cleared on disconnect (R2 — no persistence to unwind).
//   - AE event carries NO PII (no voterId / coordinates in any blob).

import { describe, expect, it, vi } from 'vitest'
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
  sessionId: 'sess-xr-1',
  ownerId: 'owner-1',
  teamId: 'team-1',
  code: 'XR1234',
  title: 'Spatial Demo',
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

describe('XrAvatarHandler — flag gate', () => {
  it('ignores inbound xr_avatar_sync when BETA_XR_ENABLED is off (no broadcast, no AE)', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const ae = mkAe()
    const handler = new XrAvatarHandler(state as never, makeEnv('false', ae))

    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    handler.flushTick()
    await Promise.resolve()

    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws1)).toHaveLength(0)
    expect(deltas(ws2)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

describe('XrAvatarHandler — zero_knowledge exclusion', () => {
  it('ignores inbound xr_avatar_sync in a ZK session even with the flag on', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, { ...baseMeta, anonymity: 'zero_knowledge' })
    const ae = mkAe()
    const handler = new XrAvatarHandler(state as never, makeEnv('true', ae))

    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    handler.flushTick()
    await Promise.resolve()

    expect(handler.activeAvatarCount()).toBe(0)
    expect(deltas(ws1)).toHaveLength(0)
    expect(deltas(ws2)).toHaveLength(0)
    expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

describe('XrAvatarHandler — flag on + non-ZK', () => {
  it('merges avatar state and broadcasts to all sockets', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const handler = new XrAvatarHandler(state as never, makeEnv('true'))

    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws2), att('v2'), { p: [0.5, 0.5, 0.5], q: Q })
    handler.flushTick()

    expect(handler.activeAvatarCount()).toBe(2)
    for (const ws of [ws1, ws2]) {
      const d = deltas(ws)
      expect(d.length).toBe(1)
      expect(d[0].data.avatars).toHaveLength(2)
    }
  })

  it('emits a monotonically increasing scene rev across batches', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const handler = new XrAvatarHandler(state as never, makeEnv('true'))

    const ws1 = connect(state, att('v1'))

    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    handler.flushTick()
    await handler.handleSync(asWs(ws1), att('v1'), { p: [0.2, 0.2, 0.2], q: Q })
    handler.flushTick()

    const revs = deltas(ws1).map((d) => d.data.rev)
    expect(revs).toHaveLength(2)
    expect(revs[1]).toBeGreaterThan(revs[0])
  })

  it('uses an ephemeral avatar id that is NOT the voterId', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const handler = new XrAvatarHandler(state as never, makeEnv('true'))

    const ws1 = connect(state, att('voter-secret-123'))
    await handler.handleSync(asWs(ws1), att('voter-secret-123'), { p: P, q: Q })
    handler.flushTick()

    const avatar = deltas(ws1)[0].data.avatars[0] as { a: string }
    expect(avatar.a).not.toBe('voter-secret-123')
    expect(avatar.a).not.toContain('voter-secret-123')
  })
})

describe('XrAvatarHandler — transient state lifecycle', () => {
  it('clears a socket avatar pose on disconnect (forget) with no persistence', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const handler = new XrAvatarHandler(state as never, makeEnv('true'))

    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))
    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    await handler.handleSync(asWs(ws2), att('v2'), { p: P, q: Q })
    expect(handler.activeAvatarCount()).toBe(2)

    handler.forget(asWs(ws1))
    expect(handler.activeAvatarCount()).toBe(1)

    // Nothing about avatars was ever written to DO storage.
    const keys = [...(await state.storage.list()).keys()]
    expect(keys.some((k) => k.toLowerCase().includes('avatar') || k.toLowerCase().includes('xr'))).toBe(false)
  })

  it('prunes a closed socket from the broadcast set', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const handler = new XrAvatarHandler(state as never, makeEnv('true'))

    const ws1 = connect(state, att('v1'))
    await handler.handleSync(asWs(ws1), att('v1'), { p: P, q: Q })
    ws1.close()

    handler.flushTick()
    expect(handler.activeAvatarCount()).toBe(0)
  })
})

describe('XrAvatarHandler — AE event privacy', () => {
  it('emits xr.avatar_sync_latency with timing + count only, no PII', async () => {
    const state = new MockDurableObjectState()
    await state.storage.put(K_META, baseMeta)
    const ae = mkAe()
    const handler = new XrAvatarHandler(state as never, makeEnv('true', ae))

    const ws1 = connect(state, att('voter-secret-123'))
    await handler.handleSync(asWs(ws1), att('voter-secret-123'), { p: [0.42, 0.13, -0.7], q: [0.1, 0.2, 0.3, 0.9] })
    handler.flushTick()

    // emitLatency awaits a storage.get microtask before writing.
    await vi.waitFor(() =>
      expect((ae.writeDataPoint as ReturnType<typeof vi.fn>)).toHaveBeenCalled(),
    )

    const dp = (ae.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
      doubles: number[]
    }
    // blob1 = event name; blob2 = sessionId; blob3 = teamId.
    expect(dp.blobs[0]).toBe('xr.avatar_sync_latency')
    expect(dp.blobs[1]).toBe('sess-xr-1')
    expect(dp.blobs[2]).toBe('team-1')
    // double1 = durationMs (>=0); double2 = batch avatar count.
    expect(dp.doubles[0]).toBeGreaterThanOrEqual(0)
    expect(dp.doubles[1]).toBe(1)

    // No PII anywhere: no voterId, no coordinates.
    const serialized = JSON.stringify(dp)
    expect(serialized).not.toContain('voter-secret-123')
    expect(serialized).not.toContain('0.42')
    expect(serialized).not.toContain('0.13')
  })
})
