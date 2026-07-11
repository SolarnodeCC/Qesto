// Client-side WebSocket state machine for TOWNHALL Q&A boards (ADR-0044).
//
// Distinct from useLiveSession (single active question) — the board is a persistent
// collection updated by deltas. The server sends a full `townhall_state` snapshot on
// connect/resync, then incremental add/update/remove/spotlight deltas carrying a
// monotonic `rev`. A rev gap triggers a `request_state` resync. Reuses the live-session
// transport + exponential-backoff reconnect.

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { parseServerEnvelope } from '../lib/live-session-protocol'
import {
  buildLiveSessionWsUrl,
  buildLiveSessionSubprotocols,
  createReconnectingWs,
  sendWsJson,
} from './liveSessionWsTransport'

const LIVE_PROTOCOL_VERSION = 1

export type TownhallModeration = 'pre' | 'post'
export type TownhallItemStatus = 'pending' | 'approved' | 'dismissed' | 'answered'

export type TownhallBoardItem = {
  id: string
  body: string
  displayName: string | null
  upvotes: number
  status: TownhallItemStatus
  isSpotlit: boolean
  groupedCount: number
  createdAt: number
}

export type TownhallConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed'

export type TownhallState = {
  connection: TownhallConnection
  role: 'presenter' | 'voter' | null
  voterId: string | null
  moderation: TownhallModeration | null
  items: TownhallBoardItem[]
  spotlightId: string | null
  rev: number
  error: string | null
  reconnectAttempts: number
  /** Set when a rev gap is detected; the hook reacts by requesting a fresh snapshot. */
  needsResync: boolean
  /** Item ids this client has upvoted (optimistic + confirmed) — disables re-upvote. */
  myUpvotes: string[]
}

export type TownhallAction =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'closed' }
  | { kind: 'failed'; error: string }
  | { kind: 'identity'; role: 'presenter' | 'voter'; voterId: string }
  | { kind: 'snapshot'; moderation: TownhallModeration; items: TownhallBoardItem[]; spotlightId: string | null; rev: number }
  | { kind: 'added'; item: TownhallBoardItem; rev: number }
  | { kind: 'updated'; item: TownhallBoardItem; rev: number }
  | { kind: 'removed'; itemId: string; rev: number }
  | { kind: 'spotlight'; spotlightId: string | null; rev: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'resynced' }
  | { kind: 'upvote_optimistic'; itemId: string }

export const TOWNHALL_INITIAL: TownhallState = {
  connection: 'idle',
  role: null,
  voterId: null,
  moderation: null,
  items: [],
  spotlightId: null,
  rev: 0,
  error: null,
  reconnectAttempts: 0,
  needsResync: false,
  myUpvotes: [],
}

/** Display order: highest upvotes first, then oldest first (stable). */
export function sortBoard(items: TownhallBoardItem[]): TownhallBoardItem[] {
  return [...items].sort((a, b) => (b.upvotes !== a.upvotes ? b.upvotes - a.upvotes : a.createdAt - b.createdAt))
}

function withSpotlight(items: TownhallBoardItem[], spotlightId: string | null): TownhallBoardItem[] {
  return items.map((i) => ({ ...i, isSpotlit: i.id === spotlightId }))
}

function upsert(items: TownhallBoardItem[], item: TownhallBoardItem): TownhallBoardItem[] {
  const idx = items.findIndex((i) => i.id === item.id)
  if (idx === -1) return [...items, item]
  const next = items.slice()
  next[idx] = item
  return next
}

// Apply a delta only if it is the next expected revision. Stale/duplicate (rev <= current)
// is ignored; a forward gap (rev > current+1) is applied best-effort but flags a resync.
function gate(state: TownhallState, rev: number): 'behind' | 'apply' | 'gap' {
  if (rev <= state.rev) return 'behind'
  if (rev === state.rev + 1) return 'apply'
  return 'gap'
}

export function townhallReducer(state: TownhallState, action: TownhallAction): TownhallState {
  switch (action.kind) {
    case 'connecting':
      return { ...state, connection: 'connecting', error: null }
    case 'open':
      return { ...state, connection: 'open' }
    case 'reconnecting':
      return { ...state, connection: 'reconnecting', reconnectAttempts: action.attempt }
    case 'closed':
      return { ...state, connection: 'closed' }
    case 'failed':
      return { ...state, connection: 'failed', error: action.error }
    case 'identity':
      return { ...state, role: action.role, voterId: action.voterId }
    case 'snapshot':
      return {
        ...state,
        moderation: action.moderation,
        items: sortBoard(withSpotlight(action.items, action.spotlightId)),
        spotlightId: action.spotlightId,
        rev: action.rev,
        needsResync: false,
        reconnectAttempts: 0,
        error: null,
      }
    case 'added':
    case 'updated': {
      const g = gate(state, action.rev)
      if (g === 'behind') return state
      const merged = upsert(state.items, { ...action.item, isSpotlit: action.item.id === state.spotlightId })
      return {
        ...state,
        items: sortBoard(merged),
        rev: action.rev,
        needsResync: state.needsResync || g === 'gap',
      }
    }
    case 'removed': {
      const g = gate(state, action.rev)
      if (g === 'behind') return state
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.itemId),
        rev: action.rev,
        needsResync: state.needsResync || g === 'gap',
      }
    }
    case 'spotlight': {
      const g = gate(state, action.rev)
      if (g === 'behind') return state
      return {
        ...state,
        spotlightId: action.spotlightId,
        items: withSpotlight(state.items, action.spotlightId),
        rev: action.rev,
        needsResync: state.needsResync || g === 'gap',
      }
    }
    case 'error':
      return { ...state, error: `${action.code}: ${action.message}` }
    case 'resynced':
      return { ...state, needsResync: false }
    case 'upvote_optimistic': {
      if (state.myUpvotes.includes(action.itemId)) return state
      return {
        ...state,
        myUpvotes: [...state.myUpvotes, action.itemId],
        items: sortBoard(
          state.items.map((i) => (i.id === action.itemId ? { ...i, upvotes: i.upvotes + 1 } : i)),
        ),
      }
    }
  }
}

function toItem(raw: Record<string, unknown>): TownhallBoardItem | null {
  if (!raw || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    body: typeof raw.body === 'string' ? raw.body : '',
    displayName: typeof raw.displayName === 'string' ? raw.displayName : null,
    upvotes: typeof raw.upvotes === 'number' ? raw.upvotes : 0,
    status: (raw.status as TownhallItemStatus) ?? 'approved',
    isSpotlit: raw.isSpotlit === true,
    groupedCount: typeof raw.groupedCount === 'number' ? raw.groupedCount : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  }
}

type Options = { fingerprint?: string | undefined; presenterToken?: string | undefined; enabled?: boolean }

export function useTownhallSession(sessionId: string | undefined, opts: Options = {}) {
  const [state, dispatch] = useReducer(townhallReducer, TOWNHALL_INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const { fingerprint, presenterToken, enabled = true } = opts

  const requestState = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'request_state', data: {}, timestamp: Date.now() })
  }, [])

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const msg = parseServerEnvelope(JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)))
        if (!msg) return
        const d = msg.data as Record<string, unknown>
        switch (msg.type) {
          case 'init':
            dispatch({
              kind: 'identity',
              role: (d.role as 'presenter' | 'voter') ?? 'voter',
              voterId: (d.voterId as string) ?? '',
            })
            break
          case 'townhall_state': {
            const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]).map(toItem).filter(Boolean) : []
            dispatch({
              kind: 'snapshot',
              moderation: (d.moderation as TownhallModeration) ?? 'pre',
              items: items as TownhallBoardItem[],
              spotlightId: (d.spotlightId as string | null) ?? null,
              rev: typeof d.rev === 'number' ? d.rev : 0,
            })
            break
          }
          case 'townhall_question_added': {
            const item = toItem(d.item as Record<string, unknown>)
            if (item) dispatch({ kind: 'added', item, rev: d.rev as number })
            break
          }
          case 'townhall_question_updated': {
            const item = toItem(d.item as Record<string, unknown>)
            if (item) dispatch({ kind: 'updated', item, rev: d.rev as number })
            break
          }
          case 'townhall_question_removed':
            dispatch({ kind: 'removed', itemId: d.itemId as string, rev: d.rev as number })
            break
          case 'townhall_spotlight_changed':
            dispatch({ kind: 'spotlight', spotlightId: (d.spotlightId as string | null) ?? null, rev: d.rev as number })
            break
          case 'error':
            dispatch({ kind: 'error', code: d.code as string, message: d.message as string })
            break
        }
      } catch {
        /* ignore unparseable frames */
      }
    },
    [],
  )

  useEffect(() => {
    if (!sessionId || !enabled) return
    const handle = createReconnectingWs({
      url: buildLiveSessionWsUrl(sessionId, fingerprint),
      subprotocols: buildLiveSessionSubprotocols(presenterToken),
      onSocket: (ws) => {
        wsRef.current = ws
      },
      onMessage: handleMessage,
      onStatus: (s) => {
        switch (s.kind) {
          case 'connecting':
            dispatch({ kind: 'connecting' })
            break
          case 'open':
            dispatch({ kind: 'open' })
            break
          case 'reconnecting':
            dispatch({ kind: 'reconnecting', attempt: s.attempt })
            break
          case 'closed':
            dispatch({ kind: 'closed' })
            break
          case 'failed':
            dispatch({ kind: 'failed', error: 'Unable to connect to the Q&A session. Please refresh and try again.' })
            break
        }
      },
    })
    return () => {
      handle.close()
    }
  }, [sessionId, enabled, fingerprint, presenterToken, handleMessage])

  // On a detected rev gap, pull a fresh authoritative snapshot.
  useEffect(() => {
    if (state.needsResync && state.connection === 'open') {
      requestState()
      dispatch({ kind: 'resynced' })
    }
  }, [state.needsResync, state.connection, requestState])

  const submitQuestion = useCallback((body: string, displayName?: string) => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'townhall_submit',
      data: { body, ...(displayName ? { displayName } : {}) },
      timestamp: Date.now(),
    })
  }, [])

  const upvote = useCallback((itemId: string) => {
    if (state.myUpvotes.includes(itemId)) return
    dispatch({ kind: 'upvote_optimistic', itemId })
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'townhall_upvote', data: { itemId }, timestamp: Date.now() })
  }, [state.myUpvotes])

  const moderate = useCallback(
    (itemId: string, action: string, groupParentId?: string) =>
      sendWsJson(wsRef.current, {
        v: LIVE_PROTOCOL_VERSION,
        type: 'townhall_moderate',
        data: { itemId, action, ...(groupParentId ? { groupParentId } : {}) },
        timestamp: Date.now(),
      }),
    [],
  )

  return { state, submitQuestion, upvote, moderate, requestState }
}
