import { useCallback, useEffect, useReducer, useRef } from 'react'
import { parseServerEnvelope } from '../lib/live-session-protocol'
import { buildLiveSessionWsUrl, sendWsJson } from './liveSessionWsTransport'

const LIVE_PROTOCOL_VERSION = 1

export type RetroColumn = 'went_well' | 'didnt_go_well' | 'actions'

export type RetroItem = {
  id: string
  column: RetroColumn
  body: string
  upvotes: number
  createdAt: number
  carried?: boolean
}

export type RetroConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed'

export type RetroState = {
  connection: RetroConnection
  items: RetroItem[]
  rev: number
  dotVoteLimit: number
  myUpvotes: string[]
  dotsUsed: number
  error: string | null
}

type RetroAction =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting' }
  | { kind: 'closed' }
  | { kind: 'failed'; error: string }
  | {
      kind: 'snapshot'
      items: RetroItem[]
      rev: number
      dotVoteLimit: number
      myUpvotes?: string[]
      dotsUsed?: number
    }
  | { kind: 'added'; item: RetroItem; rev: number }
  | { kind: 'updated'; item: RetroItem; rev: number }
  | { kind: 'upvote_optimistic'; itemId: string }
  | { kind: 'upvote_rollback'; itemId: string }
  | { kind: 'error'; message: string }

export const RETRO_INITIAL: RetroState = {
  connection: 'idle',
  items: [],
  rev: 0,
  dotVoteLimit: 3,
  myUpvotes: [],
  dotsUsed: 0,
  error: null,
}

function upsert(items: RetroItem[], item: RetroItem): RetroItem[] {
  const idx = items.findIndex((i) => i.id === item.id)
  if (idx === -1) return [...items, item]
  const next = items.slice()
  next[idx] = item
  return next
}

export function sortActionsByUpvotes(items: RetroItem[]): RetroItem[] {
  return [...items].sort((a, b) => {
    if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes
    return a.createdAt - b.createdAt
  })
}

export function retroReducer(state: RetroState, action: RetroAction): RetroState {
  switch (action.kind) {
    case 'connecting':
      return { ...state, connection: 'connecting', error: null }
    case 'open':
      return { ...state, connection: 'open' }
    case 'reconnecting':
      return { ...state, connection: 'reconnecting' }
    case 'closed':
      return { ...state, connection: 'closed' }
    case 'failed':
      return { ...state, connection: 'failed', error: action.error }
    case 'snapshot':
      return {
        ...state,
        items: action.items,
        rev: action.rev,
        dotVoteLimit: action.dotVoteLimit,
        myUpvotes: action.myUpvotes ?? state.myUpvotes,
        dotsUsed: action.dotsUsed ?? state.dotsUsed,
      }
    case 'added':
      return { ...state, items: upsert(state.items, action.item), rev: action.rev }
    case 'updated':
      return { ...state, items: upsert(state.items, action.item), rev: action.rev }
    case 'upvote_optimistic':
      if (state.myUpvotes.includes(action.itemId)) return state
      return {
        ...state,
        myUpvotes: [...state.myUpvotes, action.itemId],
        dotsUsed: state.dotsUsed + 1,
        items: state.items.map((i) =>
          i.id === action.itemId ? { ...i, upvotes: i.upvotes + 1 } : i,
        ),
      }
    case 'upvote_rollback': {
      if (!state.myUpvotes.includes(action.itemId)) return state
      return {
        ...state,
        myUpvotes: state.myUpvotes.filter((id) => id !== action.itemId),
        dotsUsed: Math.max(0, state.dotsUsed - 1),
        items: state.items.map((i) =>
          i.id === action.itemId ? { ...i, upvotes: Math.max(0, i.upvotes - 1) } : i,
        ),
      }
    }
    case 'error':
      return { ...state, error: action.message }
    default:
      return state
  }
}

function toItem(raw: Record<string, unknown>): RetroItem | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.column !== 'string') return null
  return {
    id: raw.id,
    column: raw.column as RetroColumn,
    body: typeof raw.body === 'string' ? raw.body : '',
    upvotes: typeof raw.upvotes === 'number' ? raw.upvotes : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    carried: raw.carried === true,
  }
}

type Options = { fingerprint?: string; presenterToken?: string; enabled?: boolean }

export function useRetroSession(sessionId: string | undefined, opts: Options = {}) {
  const [state, dispatch] = useReducer(retroReducer, RETRO_INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const pendingUpvoteRef = useRef<string | null>(null)
  const { fingerprint, presenterToken, enabled = true } = opts

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return
    dispatch({ kind: 'connecting' })
    const url = buildLiveSessionWsUrl(sessionId, fingerprint)
    const subprotocols = presenterToken ? [`qesto.bearer.${presenterToken}`, 'qesto-v1'] : ['qesto-v1']
    const ws = new WebSocket(url, subprotocols)
    wsRef.current = ws

    ws.addEventListener('open', () => dispatch({ kind: 'open' }))
    ws.addEventListener('message', (ev) => {
      try {
        const msg = parseServerEnvelope(JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)))
        if (!msg) return
        const d = msg.data as Record<string, unknown>
        switch (msg.type) {
          case 'retro_state': {
            const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]).map(toItem).filter(Boolean) : []
            const snapshot: Extract<RetroAction, { kind: 'snapshot' }> = {
              kind: 'snapshot',
              items: items as RetroItem[],
              rev: typeof d.rev === 'number' ? d.rev : 0,
              dotVoteLimit: typeof d.dotVoteLimit === 'number' ? d.dotVoteLimit : 3,
            }
            if (Array.isArray(d.myUpvotes)) snapshot.myUpvotes = d.myUpvotes as string[]
            if (typeof d.dotsUsed === 'number') snapshot.dotsUsed = d.dotsUsed
            dispatch(snapshot)
            break
          }
          case 'retro_item_added': {
            const item = toItem(d.item as Record<string, unknown>)
            if (item) dispatch({ kind: 'added', item, rev: d.rev as number })
            break
          }
          case 'retro_item_updated': {
            const item = toItem(d.item as Record<string, unknown>)
            if (item) {
              if (pendingUpvoteRef.current === item.id) pendingUpvoteRef.current = null
              dispatch({ kind: 'updated', item, rev: d.rev as number })
            }
            break
          }
          case 'error': {
            const pending = pendingUpvoteRef.current
            if (pending) {
              pendingUpvoteRef.current = null
              dispatch({ kind: 'upvote_rollback', itemId: pending })
            }
            dispatch({ kind: 'error', message: (d.message as string) ?? 'Error' })
            break
          }
        }
      } catch {
        /* ignore */
      }
    })
    ws.addEventListener('close', (ev) => {
      if (ev.code === 1000) {
        dispatch({ kind: 'closed' })
        return
      }
      const attempt = attemptRef.current + 1
      attemptRef.current = attempt
      if (attempt > 5) {
        dispatch({ kind: 'failed', error: 'Connection lost' })
        return
      }
      dispatch({ kind: 'reconnecting' })
      setTimeout(connect, Math.min(16000, 1000 * Math.pow(2, attempt - 1)))
    })
  }, [sessionId, enabled, fingerprint, presenterToken])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close(1000, 'unmount')
      wsRef.current = null
    }
  }, [connect])

  const submit = useCallback((column: RetroColumn, body: string) => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'retro_submit',
      data: { column, body },
      timestamp: Date.now(),
    })
  }, [])

  const upvote = useCallback(
    (itemId: string) => {
      if (state.myUpvotes.includes(itemId) || state.dotsUsed >= state.dotVoteLimit) return
      pendingUpvoteRef.current = itemId
      dispatch({ kind: 'upvote_optimistic', itemId })
      sendWsJson(wsRef.current, {
        v: LIVE_PROTOCOL_VERSION,
        type: 'retro_upvote',
        data: { itemId },
        timestamp: Date.now(),
      })
    },
    [state.myUpvotes, state.dotsUsed, state.dotVoteLimit],
  )

  return { state, submit, upvote }
}

export function itemsByColumn(items: RetroItem[], column: RetroColumn): RetroItem[] {
  const filtered = items.filter((i) => i.column === column)
  return column === 'actions' ? sortActionsByUpvotes(filtered) : filtered
}
