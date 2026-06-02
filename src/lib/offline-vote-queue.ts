/**
 * MOBILE-OFFLINE-SYNC-01 / FE-NATIVE-OFFLINE-01 — queue vote frames when WebSocket is down.
 * Uses localStorage in browser; Capacitor shell uses the same key (Preferences bridge in S82).
 */
import { isNativeShell } from './native-shell'

const QUEUE_KEY = 'qesto:offline-votes'

export function offlineQueueStorageKind(): 'localStorage' | 'native-shell' {
  return isNativeShell() ? 'native-shell' : 'localStorage'
}

type QueuedVote = {
  sessionId: string
  payload: Record<string, unknown>
  queuedAt: number
}

function readAll(): QueuedVote[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown as QueuedVote[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: QueuedVote[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)))
  } catch {
    /* quota */
  }
}

export function enqueueOfflineVote(sessionId: string, payload: Record<string, unknown>): void {
  const items = readAll()
  items.push({ sessionId, payload, queuedAt: Date.now() })
  writeAll(items)
}

export function flushOfflineVoteQueue(
  sessionId: string,
  send: (payload: Record<string, unknown>) => boolean,
): number {
  const items = readAll()
  const rest: QueuedVote[] = []
  let sent = 0
  for (const item of items) {
    if (item.sessionId !== sessionId) {
      rest.push(item)
      continue
    }
    if (send(item.payload)) sent += 1
    else rest.push(item)
  }
  writeAll(rest)
  return sent
}

export function pendingOfflineVoteCount(sessionId: string): number {
  return readAll().filter((i) => i.sessionId === sessionId).length
}
