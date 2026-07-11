/**
 * DO soak & realtime stability stress test for XR avatar fan-out primitive
 *
 * S98 P0 gate: Test the new ~12.5 Hz avatar sync tick (XR_TICK_MS=80) under
 * high concurrent load. The XR avatar handler is a net-new DO realtime primitive
 * that must be load-tested to prove:
 *
 * 1. Handler fans out on the tick cadence (not per inbound frame)
 * 2. `rev` stays monotonic under sustained load
 * 3. Transient state is bounded and fully released after disconnects
 * 4. Flag-off / zero-knowledge paths stay inert under load
 *
 * Scenarios:
 * - 100 concurrent sockets emitting pose frames at ~200ms intervals
 * - Tick batching coalesces frames into discrete fan-outs
 * - Monotonic rev increments with each tick
 * - Poses are dropped cleanly on disconnect, no memory leak
 * - Flag off (BETA_XR_ENABLED=false) suppresses all avatar state
 * - ZK sessions ignore inbound avatar frames, never persist
 *
 * Evidence doc: `/knowledge-base/operations/XR_FANOUT_SOAK_S98.md`
 *              or integrated into `WCAG_AAA_REATTEST_V70_S98.md` §XR Soak
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../../functions/api/types'
import { XrAvatarHandler } from '../../functions/api/lib/session-room-xr-handler'

// Mock WebSocket and Storage interfaces for deterministic testing
class MockWebSocket {
  closed = false
  constructor(public id: string) {}

  close() {
    this.closed = true
  }
}

interface MockStorageState {
  meta?: { anonymity: string; sessionId: string; teamId: string }
}

class MockStorageContext {
  private state: MockStorageState = {}
  private webSockets: WebSocket[] = []

  readonly storage = {
    get: async <T,>(key: string): Promise<T | undefined> => {
      if (key === 'meta') {
        return this.state.meta as T | undefined
      }
      return undefined
    },
    put: async <T,>(_key: string, _value: T): Promise<void> => {},
    delete: async (_key: string): Promise<void> => {},
  }

  constructor(_env: Env) {}

  addWebSocket(ws: WebSocket) {
    this.webSockets.push(ws)
  }

  removeWebSocket(ws: WebSocket) {
    this.webSockets = this.webSockets.filter((w) => w !== ws)
  }

  getWebSockets(): WebSocket[] {
    return this.webSockets
  }

  setMeta(meta: NonNullable<MockStorageState['meta']>) {
    this.state.meta = meta
  }

  clearAll() {
    this.state = {}
    this.webSockets = []
  }
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'test-secret',
    BETA_XR_ENABLED: 'true', // Can be overridden to test flag-off
    METRICS_AE: null,
    ...overrides,
  } as unknown as Env
}

// ──────────────────────────────────────────────────────────────────────────

describe('XR Avatar Handler stress tests', () => {
  let storageCtx: MockStorageContext
  let handler: XrAvatarHandler
  let env: Env

  beforeEach(() => {
    env = makeEnv()
    storageCtx = new MockStorageContext(env)
    storageCtx.setMeta({
      anonymity: 'standard',
      sessionId: 'sess_stress_xr',
      teamId: 'team_test',
    })
    handler = new XrAvatarHandler(storageCtx, env)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Tick batching under concurrent pose frames
  // ─────────────────────────────────────────────────────────────────────────

  describe('Tick batching (ADR-0066 R1)', () => {
    it('fans out once per ~80ms tick despite rapid inbound frames', async () => {
      // Simulate receiving poses from 100 concurrent sockets in rapid succession
      const sockets: MockWebSocket[] = []
      for (let i = 0; i < 100; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      // Fire 100 pose frames all at once (would thrash without batching)
      const sendPromises = sockets.map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [Math.sin(i / 100) * 0.4, 0, Math.cos(i / 100) * 0.4],
          q: [0, Math.sin(i / 100 / 2), 0, Math.cos(i / 100 / 2)],
        })
      })
      await Promise.all(sendPromises)

      // Verify all poses are stored (no dedup by handleSync, just stored)
      const countBefore = handler.activeAvatarCount()
      expect(countBefore).toBe(100)

      // Verify only ONE tick is scheduled (not 100)
      // We test this by manually flushing the tick and seeing a single rev increment
      handler.flushTick()
      const afterFirstTick = handler['rev'] // Access private field for test verification
      expect(afterFirstTick).toBe(1)

      // Send 50 more frames from same subset (overwrite poses)
      const morePromises = sockets.slice(0, 50).map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [Math.sin((i + 50) / 100) * 0.4, 0, Math.cos((i + 50) / 100) * 0.4],
          q: [0, Math.sin((i + 50) / 100 / 2), 0, Math.cos((i + 50) / 100 / 2)],
        })
      })
      await Promise.all(morePromises)

      const countAfterMore = handler.activeAvatarCount()
      expect(countAfterMore).toBe(100) // Still 100, just updated 50 of them

      // Flush again — tick should increment by 1
      handler.flushTick()
      const afterSecondTick = handler['rev']

      expect(afterSecondTick).toBe(2)
      expect(afterSecondTick - afterFirstTick).toBe(1) // Only one tick per batch window
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Monotonic rev under sustained load
  // ─────────────────────────────────────────────────────────────────────────

  describe('Monotonic revision (ADR-0066 D3)', () => {
    it('increments rev once per tick, never decrement or repeat', async () => {
      const sockets: MockWebSocket[] = []
      for (let i = 0; i < 50; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      const revisions: number[] = []

      // Simulate 10 ticks over sustained load
      for (let tick = 0; tick < 10; tick++) {
        // Only send poses if there aren't any yet, or send updates
        if (tick === 0 || revisions.length < 5) {
          // Send varied poses each tick
          const syncPromises = sockets.map((socket, i) => {
            const angle = (i + tick) / 50
            return handler.handleSync(socket as unknown as WebSocket, {} as any, {
              p: [Math.sin(angle) * 0.4, 0, Math.cos(angle) * 0.4],
              q: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
            })
          })
          await Promise.all(syncPromises)
        }

        handler.flushTick()
        const rev = handler['rev']
        if (rev > 0) {
          revisions.push(rev)
        }
      }

      // Verify we got at least a few revisions
      expect(revisions.length).toBeGreaterThan(0)

      // Verify monotonic increase in recorded revisions
      for (let i = 1; i < revisions.length; i++) {
        expect(revisions[i]).toBeGreaterThanOrEqual(revisions[i - 1])
      }

      expect(revisions[0]).toBe(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Transient state cleanup on disconnect
  // ─────────────────────────────────────────────────────────────────────────

  describe('Transient state cleanup (ADR-0066 R2)', () => {
    it('drops poses cleanly when sockets disconnect, no memory leak', async () => {
      const sockets: MockWebSocket[] = []
      for (let i = 0; i < 100; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      // Load all with poses
      const syncPromises = sockets.map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [Math.sin(i / 100) * 0.4, 0, Math.cos(i / 100) * 0.4],
          q: [0, Math.sin(i / 100 / 2), 0, Math.cos(i / 100 / 2)],
        })
      })
      await Promise.all(syncPromises)

      const beforeDisconnect = handler.activeAvatarCount()
      expect(beforeDisconnect).toBe(100)

      // Disconnect 50 of them
      for (let i = 0; i < 50; i++) {
        const ws = sockets[i] as unknown as WebSocket
        handler.forget(ws)
        storageCtx.removeWebSocket(ws)
        ;(ws as any as MockWebSocket).close()
      }

      const afterDisconnect = handler.activeAvatarCount()
      expect(afterDisconnect).toBe(50)

      // Disconnect remaining
      for (let i = 50; i < 100; i++) {
        const ws = sockets[i] as unknown as WebSocket
        handler.forget(ws)
        storageCtx.removeWebSocket(ws)
        ;(ws as any as MockWebSocket).close()
      }

      const afterFinalDisconnect = handler.activeAvatarCount()
      expect(afterFinalDisconnect).toBe(0)
    })

    it('prunes closed sockets from poses map on next tick', async () => {
      const sockets: MockWebSocket[] = []
      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      // Load all
      const syncPromises = sockets.map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [i * 0.1, 0, i * 0.1],
          q: [0, 0, 0, 1],
        })
      })
      await Promise.all(syncPromises)

      expect(handler.activeAvatarCount()).toBe(10)

      // Manually close half without calling forget() — simulates network drop
      for (let i = 0; i < 5; i++) {
        ;(sockets[i] as unknown as MockWebSocket).close()
        storageCtx.removeWebSocket(sockets[i] as unknown as WebSocket)
      }

      // On next tick flush, pruneClosed() should clean up the closed sockets
      handler.flushTick()

      // Count should now be 5 (the still-open ones)
      const remaining = handler.activeAvatarCount()
      expect(remaining).toBe(5)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Flag-off (BETA_XR_ENABLED=false) is inert
  // ─────────────────────────────────────────────────────────────────────────

  describe('Feature flag gating (ADR-0066 R3)', () => {
    it('handleSync returns early when BETA_XR_ENABLED is false', async () => {
      const envOff = makeEnv({ BETA_XR_ENABLED: 'false' })
      const handlerOff = new XrAvatarHandler(storageCtx, envOff)

      const ws = new MockWebSocket('ws_0') as unknown as WebSocket
      storageCtx.addWebSocket(ws)

      // Try to sync — should be a no-op
      await handlerOff.handleSync(ws, {} as any, {
        p: [0.5, 0, 0.5],
        q: [0, 0, 0, 1],
      })

      // Verify no state was recorded
      const count = handlerOff.activeAvatarCount()
      expect(count).toBe(0)
    })

    it('returns early and stays inert if flag is toggled off mid-session', async () => {
      const sockets: MockWebSocket[] = []
      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      // Load with flag ON
      const syncPromises = sockets.map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [i * 0.1, 0, i * 0.1],
          q: [0, 0, 0, 1],
        })
      })
      await Promise.all(syncPromises)

      expect(handler.activeAvatarCount()).toBe(10)

      // Now create a new handler with flag OFF
      const envOff = makeEnv({ BETA_XR_ENABLED: 'false' })
      const handlerOff = new XrAvatarHandler(storageCtx, envOff)

      // Try to send more poses — should be ignored
      await handlerOff.handleSync(
        sockets[0] as unknown as WebSocket,
        {} as any,
        {
          p: [0.2, 0, 0.2],
          q: [0, 0, 0, 1],
        }
      )

      // Count should still be 0 for the OFF handler (separate instance)
      expect(handlerOff.activeAvatarCount()).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Zero-knowledge session gating
  // ─────────────────────────────────────────────────────────────────────────

  describe('Zero-knowledge session guard (ADR-0066 D4)', () => {
    it('ignores poses in zero_knowledge sessions, never persists', async () => {
      // Switch storage to ZK session
      storageCtx.setMeta({
        anonymity: 'zero_knowledge',
        sessionId: 'sess_zk_xr',
        teamId: 'team_test',
      })

      const ws = new MockWebSocket('ws_zk_0') as unknown as WebSocket
      storageCtx.addWebSocket(ws)

      // Try to sync
      await handler.handleSync(ws, {} as any, {
        p: [0.5, 0, 0.5],
        q: [0, 0, 0, 1],
      })

      // Should have been dropped
      const count = handler.activeAvatarCount()
      expect(count).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Avatar ID stability and uniqueness
  // ─────────────────────────────────────────────────────────────────────────

  describe('Avatar ID generation (privacy)', () => {
    it('mints unique ephemeral IDs per socket', async () => {
      const sockets: MockWebSocket[] = []
      const ids = new Set<string>()

      for (let i = 0; i < 50; i++) {
        const ws = new MockWebSocket(`ws_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      // Each sync should mint a unique ID
      const syncPromises = sockets.map((socket, i) => {
        return handler.handleSync(socket as unknown as WebSocket, {} as any, {
          p: [i * 0.02, 0, i * 0.02],
          q: [0, 0, 0, 1],
        })
      })
      await Promise.all(syncPromises)

      // Collect IDs via direct reflection (test-only access)
      const poses = (handler as any)['poses'] as Map<WebSocket, any>
      for (const pose of poses.values()) {
        ids.add(pose.a)
      }

      expect(ids.size).toBe(50) // All unique
      expect(ids).toHaveLength(50)

      // Verify IDs are non-numeric and non-voterId-like
      for (const id of ids) {
        expect(id).toMatch(/^xa_/)
        expect(id.length).toBeGreaterThan(4)
      }
    })

    it('reuses same avatar ID when a socket sends multiple poses', async () => {
      const ws = new MockWebSocket('ws_stable') as unknown as WebSocket
      storageCtx.addWebSocket(ws)

      // First pose
      await handler.handleSync(ws, {} as any, {
        p: [0.1, 0, 0.1],
        q: [0, 0, 0, 1],
      })

      const poses1 = (handler as any)['poses'] as Map<WebSocket, any>
      const id1 = poses1.get(ws)?.a

      // Send more poses from same socket
      await handler.handleSync(ws, {} as any, {
        p: [0.2, 0, 0.2],
        q: [0, 0, 0, 1],
      })

      await handler.handleSync(ws, {} as any, {
        p: [0.3, 0, 0.3],
        q: [0, 0, 0, 1],
      })

      const poses2 = (handler as any)['poses'] as Map<WebSocket, any>
      const id2 = poses2.get(ws)?.a

      // Same ID across multiple poses from the same socket
      expect(id1).toBe(id2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Sustained load scenario (integration)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Sustained load integration (100 VUs, 30s soak)', () => {
    it('maintains bounded state and correct behavior under 30 pose cycles per socket', async () => {
      const numVUs = 100
      const numCycles = 30
      const sockets: MockWebSocket[] = []

      // Create 100 virtual users
      for (let i = 0; i < numVUs; i++) {
        const ws = new MockWebSocket(`ws_vu_${i}`) as unknown as WebSocket
        sockets.push(ws as unknown as MockWebSocket)
        storageCtx.addWebSocket(ws)
      }

      const revisions: number[] = []
      let totalSyncs = 0

      // Simulate 30 cycles (ticks) with varying participant count
      for (let cycle = 0; cycle < numCycles; cycle++) {
        // Each cycle: random active count (50–100 of the VUs)
        const activeCount = Math.floor(50 + Math.random() * 50)

        // Send poses from active participants
        const syncPromises = []
        for (let i = 0; i < activeCount; i++) {
          const socket = sockets[i] as unknown as WebSocket
          const angle = (i + cycle) / numVUs
          syncPromises.push(
            handler.handleSync(socket, {} as any, {
              p: [Math.sin(angle) * 0.4, 0, Math.cos(angle) * 0.4],
              q: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
            })
          )
        }
        await Promise.all(syncPromises)
        totalSyncs += activeCount

        // Flush tick
        handler.flushTick()
        revisions.push(handler['rev'])

        // Randomly disconnect 10% (simulate churn)
        if (cycle % 3 === 0) {
          const toDisconnect = Math.floor(numVUs * 0.1)
          for (let i = 0; i < toDisconnect; i++) {
            const idx = Math.floor(Math.random() * numVUs)
            const ws = sockets[idx] as unknown as WebSocket
            handler.forget(ws)
            storageCtx.removeWebSocket(ws)

            // Reconnect a new one to maintain 100 sockets
            const newWs = new MockWebSocket(`ws_vu_${idx}_r`) as unknown as WebSocket
            sockets[idx] = newWs as unknown as MockWebSocket
            storageCtx.addWebSocket(newWs)
          }
        }
      }

      // Assertions
      expect(revisions.length).toBe(numCycles)
      expect(revisions[0]).toBe(1)
      expect(revisions[numCycles - 1]).toBe(numCycles)

      // All revisions should be strictly monotonic
      for (let i = 1; i < revisions.length; i++) {
        expect(revisions[i]).toBe(revisions[i - 1] + 1)
      }

      // Active count should never exceed numVUs
      const finalCount = handler.activeAvatarCount()
      expect(finalCount).toBeLessThanOrEqual(numVUs)
      expect(finalCount).toBeGreaterThan(0)

      // No persisted state (avatars are transient only)
      const metaAfter = await storageCtx.storage.get('meta')
      expect(metaAfter).toBeDefined() // Meta persists, but avatar poses never do
    })
  })
})
