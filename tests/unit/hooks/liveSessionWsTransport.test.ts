import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createReconnectingWs,
  buildLiveSessionSubprotocols,
  wsReconnectDelayMs,
  WS_MAX_RECONNECT_ATTEMPTS,
  type ReconnectingWsStatus,
} from '../../../src/hooks/liveSessionWsTransport'

type Listener = (ev: unknown) => void

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static OPEN = 1
  readyState = 0
  url: string
  protocols: string[]
  closedWith: { code: number | undefined; reason: string | undefined } | null = null
  private listeners = new Map<string, Listener[]>()

  constructor(url: string, protocols?: string[]) {
    this.url = url
    this.protocols = protocols ?? []
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, fn: Listener) {
    const arr = this.listeners.get(type) ?? []
    arr.push(fn)
    this.listeners.set(type, arr)
  }

  send(_data: string) {}

  close(code?: number, reason?: string) {
    this.closedWith = { code, reason }
  }

  emit(type: string, ev: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(ev)
  }
}

describe('liveSessionWsTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('builds subprotocols with and without a presenter token', () => {
    expect(buildLiveSessionSubprotocols()).toEqual(['qesto-v1'])
    expect(buildLiveSessionSubprotocols('tok')).toEqual(['qesto.bearer.tok', 'qesto-v1'])
  })

  it('backoff is 1s, 2s, 4s, 8s, capped at 16s', () => {
    expect([1, 2, 3, 4, 5, 6].map(wsReconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 16000])
  })

  it('emits connecting then open, and delivers messages', () => {
    const statuses: ReconnectingWsStatus[] = []
    const messages: unknown[] = []
    createReconnectingWs({
      url: 'ws://x/api/sessions/s/ws',
      subprotocols: ['qesto-v1'],
      onMessage: (ev) => messages.push((ev as { data: string }).data),
      onStatus: (s) => statuses.push(s),
    })
    const ws = FakeWebSocket.instances[0]
    ws.emit('open', {})
    ws.emit('message', { data: '{"type":"x","data":{}}' })
    expect(statuses.map((s) => s.kind)).toEqual(['connecting', 'open'])
    expect(messages).toEqual(['{"type":"x","data":{}}'])
  })

  it('reconnects with exponential backoff on abnormal close and fails after max attempts', () => {
    const statuses: ReconnectingWsStatus[] = []
    createReconnectingWs({
      url: 'ws://x',
      subprotocols: ['qesto-v1'],
      onMessage: () => {},
      onStatus: (s) => statuses.push(s),
    })
    for (let attempt = 1; attempt <= WS_MAX_RECONNECT_ATTEMPTS; attempt++) {
      const ws = FakeWebSocket.instances.at(-1)!
      ws.emit('close', { code: 1006 })
      const last = statuses.at(-1)!
      expect(last).toEqual({ kind: 'reconnecting', attempt, delayMs: wsReconnectDelayMs(attempt) })
      vi.advanceTimersByTime(wsReconnectDelayMs(attempt))
    }
    expect(FakeWebSocket.instances).toHaveLength(WS_MAX_RECONNECT_ATTEMPTS + 1)
    FakeWebSocket.instances.at(-1)!.emit('close', { code: 1006 })
    expect(statuses.at(-1)).toEqual({ kind: 'failed' })
  })

  it('clean server close (1000) emits closed without reconnecting', () => {
    const statuses: ReconnectingWsStatus[] = []
    createReconnectingWs({
      url: 'ws://x',
      subprotocols: ['qesto-v1'],
      onMessage: () => {},
      onStatus: (s) => statuses.push(s),
    })
    FakeWebSocket.instances[0].emit('close', { code: 1000 })
    expect(statuses.at(-1)).toEqual({ kind: 'closed' })
    vi.runAllTimers()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('client close() stops retries, closes with 1000, and emits no further status', () => {
    const statuses: ReconnectingWsStatus[] = []
    const sockets: Array<WebSocket | null> = []
    const handle = createReconnectingWs({
      url: 'ws://x',
      subprotocols: ['qesto-v1'],
      onMessage: () => {},
      onStatus: (s) => statuses.push(s),
      onSocket: (ws) => sockets.push(ws),
    })
    // Trigger one abnormal close so a retry timer is pending.
    FakeWebSocket.instances[0].emit('close', { code: 1006 })
    handle.close()
    const countAfterClose = statuses.length
    vi.runAllTimers()
    // No new socket was created and no further status emitted.
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(statuses.length).toBe(countAfterClose)
    expect(handle.socket()).toBeNull()
    expect(sockets.at(-1)).toBeNull()
  })

  it('close() during an open connection closes the socket with code 1000', () => {
    const handle = createReconnectingWs({
      url: 'ws://x',
      subprotocols: ['qesto-v1'],
      onMessage: () => {},
      onStatus: () => {},
    })
    const ws = FakeWebSocket.instances[0]
    ws.emit('open', {})
    handle.close()
    expect(ws.closedWith).toEqual({ code: 1000, reason: 'unmount' })
    // A close event arriving after client close emits nothing / does not retry.
    ws.emit('close', { code: 1006 })
    vi.runAllTimers()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('calls onOpen with the socket before reporting open', () => {
    const order: string[] = []
    createReconnectingWs({
      url: 'ws://x',
      subprotocols: ['qesto-v1'],
      onMessage: () => {},
      onOpen: () => order.push('onOpen'),
      onStatus: (s) => order.push(s.kind),
    })
    FakeWebSocket.instances[0].emit('open', {})
    expect(order).toEqual(['connecting', 'onOpen', 'open'])
  })
})
