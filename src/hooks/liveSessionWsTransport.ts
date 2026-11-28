import { API_BASE_URL } from '../config/api'

/** Build `/api/sessions/:id/ws` URL with optional voter fingerprint query param. */
export function buildLiveSessionWsUrl(sessionId: string, fingerprint?: string): string {
  const wsBase = API_BASE_URL
    ? API_BASE_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  return `${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/ws${
    fingerprint ? `?fp=${encodeURIComponent(fingerprint)}` : ''
  }`
}

/**
 * Subprotocol offer for the SessionRoom DO. Always offers 'qesto-v1' so the
 * server can legally echo it back (RFC 6455 requires the server to choose from
 * the offered list); the bearer token is offered alongside it so the server can
 * identify the presenter role.
 */
export function buildLiveSessionSubprotocols(presenterToken?: string): string[] {
  return presenterToken ? [`qesto.bearer.${presenterToken}`, 'qesto-v1'] : ['qesto-v1']
}

/** Send a JSON frame when the socket is OPEN. */
export function sendWsJson(ws: WebSocket | null, payload: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(payload))
  return true
}

export const WS_MAX_RECONNECT_ATTEMPTS = 5
/** A connection open this long resets the reconnect budget. */
export const WS_STABLE_RESET_MS = 30_000
/** App-level keepalive interval (DO replies `pong` via setWebSocketAutoResponse). */
export const WS_PING_INTERVAL_MS = 25_000

/** Exponential backoff: 1s, 2s, 4s, 8s, capped at 16s. */
export function wsReconnectDelayMs(attempt: number): number {
  return Math.min(16000, 1000 * Math.pow(2, attempt - 1))
}

export type ReconnectingWsStatus =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting'; attempt: number; delayMs: number }
  /** Clean server-side close (code 1000). Client-initiated close() emits nothing. */
  | { kind: 'closed' }
  /** Gave up after WS_MAX_RECONNECT_ATTEMPTS reconnects. */
  | { kind: 'failed' }

export type ReconnectingWsOptions = {
  url: string
  subprotocols: string[]
  /** Raw frame handler — parsing/dispatch stays with the caller. */
  onMessage: (ev: MessageEvent) => void
  /** Connection lifecycle events, mapped to hook-specific reducer actions by the caller. */
  onStatus: (status: ReconnectingWsStatus) => void
  /** Called with each new socket (and null after close) — keeps the caller's send ref current. */
  onSocket?: (ws: WebSocket | null) => void
  /** Called on every successful open, before onStatus('open') (e.g. offline-queue flush). */
  onOpen?: (ws: WebSocket) => void
}

export type ReconnectingWsHandle = {
  socket: () => WebSocket | null
  /** Client-initiated shutdown: stops retries, closes with 1000, emits no further status. */
  close: () => void
}

/**
 * Reconnecting WebSocket lifecycle shared by the live/townhall/retro/ideate
 * session hooks — previously each hook hand-rolled the same connect / close /
 * exponential-backoff machinery (audit 2026-07-08, High).
 *
 * Reconnect budget: the attempt counter resets once a connection has stayed
 * open for WS_STABLE_RESET_MS. It used to never reset, so a long session with
 * five transient drops (Wi-Fi roaming, laptop sleep) went permanently `failed`.
 * After giving up, the socket is retried when the browser comes back `online`
 * or the tab becomes visible. An app-level ping every WS_PING_INTERVAL_MS
 * keeps idle connections from being reaped by proxies/NATs; the DO answers it
 * with a hibernation auto-response, so it never wakes the room.
 */
export function createReconnectingWs(opts: ReconnectingWsOptions): ReconnectingWsHandle {
  let ws: WebSocket | null = null
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let closedByClient = false
  let gaveUp = false
  let stableTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null

  const clearLiveTimers = () => {
    if (stableTimer) { clearTimeout(stableTimer); stableTimer = null }
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
  }

  const connect = () => {
    gaveUp = false
    opts.onStatus({ kind: 'connecting' })
    const socket = new WebSocket(opts.url, opts.subprotocols)
    ws = socket
    opts.onSocket?.(socket)

    socket.addEventListener('open', () => {
      stableTimer = setTimeout(() => { attempt = 0 }, WS_STABLE_RESET_MS)
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try { socket.send('ping') } catch { /* close handler takes over */ }
        }
      }, WS_PING_INTERVAL_MS)
      opts.onOpen?.(socket)
      opts.onStatus({ kind: 'open' })
    })
    socket.addEventListener('message', (ev) => {
      if (ev.data === 'pong') return // keepalive reply, not a protocol frame
      opts.onMessage(ev)
    })
    socket.addEventListener('close', (ev) => {
      clearLiveTimers()
      if (closedByClient) return
      if (ev.code === 1000) {
        opts.onStatus({ kind: 'closed' })
        return
      }
      attempt += 1
      if (attempt > WS_MAX_RECONNECT_ATTEMPTS) {
        gaveUp = true
        opts.onStatus({ kind: 'failed' })
        return
      }
      const delayMs = wsReconnectDelayMs(attempt)
      opts.onStatus({ kind: 'reconnecting', attempt, delayMs })
      retryTimer = setTimeout(connect, delayMs)
    })
    socket.addEventListener('error', () => {
      /* close handler drives reconnect */
    })
  }

  // After giving up, try again as soon as the network/tab is back.
  const revive = () => {
    if (closedByClient || !gaveUp) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    attempt = 0
    connect()
  }
  const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function'
  if (hasWindow) {
    window.addEventListener('online', revive)
    document.addEventListener('visibilitychange', revive)
  }

  connect()

  return {
    socket: () => ws,
    close: () => {
      closedByClient = true
      clearLiveTimers()
      if (hasWindow) {
        window.removeEventListener('online', revive)
        document.removeEventListener('visibilitychange', revive)
      }
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      ws?.close(1000, 'unmount')
      ws = null
      opts.onSocket?.(null)
    },
  }
}
