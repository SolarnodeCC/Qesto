import { useCallback, useEffect, useReducer, useRef } from 'react'
import { parseServerEnvelope } from '../lib/live-session-protocol'
import {
  buildLiveSessionWsUrl,
  buildLiveSessionSubprotocols,
  createReconnectingWs,
  sendWsJson,
} from './liveSessionWsTransport'

const LIVE_PROTOCOL_VERSION = 1

export type IdeateIdea = {
  id: string
  body: string
  upvotes: number
  clusterId: string | null
  status: 'active' | 'dismissed'
  createdAt: number
}

export type IdeateCluster = {
  id: string
  label: string
  ideaIds: string[]
  updatedAt: number
}

export type IdeateConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed'

export type IdeateRankingEntry = {
  rank: number
  ideaId: string
  body: string
  upvotes: number
}

export type IdeateState = {
  connection: IdeateConnection
  ideas: IdeateIdea[]
  clusters: IdeateCluster[]
  rev: number
  dotVoteLimit: number
  rankingRevealed: boolean
  ranking: IdeateRankingEntry[]
  myUpvotes: string[]
  dotsUsed: number
  error: string | null
}

type IdeateAction =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting' }
  | { kind: 'closed' }
  | { kind: 'failed'; error: string }
  | {
      kind: 'snapshot'
      ideas: IdeateIdea[]
      clusters: IdeateCluster[]
      rev: number
      dotVoteLimit: number
      rankingRevealed: boolean
      ranking: IdeateRankingEntry[]
      myUpvotes?: string[]
      dotsUsed?: number
    }
  | { kind: 'ranking_revealed'; ranking: IdeateRankingEntry[]; rev: number }
  | { kind: 'idea_added'; idea: IdeateIdea; rev: number }
  | { kind: 'idea_updated'; idea: IdeateIdea; rev: number }
  | { kind: 'clusters_updated'; ideas: IdeateIdea[]; clusters: IdeateCluster[]; rev: number }
  | { kind: 'upvote_optimistic'; itemId: string }
  | { kind: 'upvote_rollback'; itemId: string }
  | { kind: 'error'; message: string }

export const IDEATE_INITIAL: IdeateState = {
  connection: 'idle',
  ideas: [],
  clusters: [],
  rev: 0,
  dotVoteLimit: 5,
  rankingRevealed: false,
  ranking: [],
  myUpvotes: [],
  dotsUsed: 0,
  error: null,
}

function upsertIdea(ideas: IdeateIdea[], idea: IdeateIdea): IdeateIdea[] {
  const idx = ideas.findIndex((i) => i.id === idea.id)
  if (idx === -1) return [...ideas, idea]
  const next = ideas.slice()
  next[idx] = idea
  return next
}

export function ideateReducer(state: IdeateState, action: IdeateAction): IdeateState {
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
        ideas: action.ideas,
        clusters: action.clusters,
        rev: action.rev,
        dotVoteLimit: action.dotVoteLimit,
        rankingRevealed: action.rankingRevealed,
        ranking: action.ranking,
        myUpvotes: action.myUpvotes ?? state.myUpvotes,
        dotsUsed: action.dotsUsed ?? state.dotsUsed,
      }
    case 'ranking_revealed':
      return { ...state, rankingRevealed: true, ranking: action.ranking, rev: action.rev }
    case 'idea_added':
      return { ...state, ideas: upsertIdea(state.ideas, action.idea), rev: action.rev }
    case 'idea_updated':
      return { ...state, ideas: upsertIdea(state.ideas, action.idea), rev: action.rev }
    case 'clusters_updated':
      return { ...state, ideas: action.ideas, clusters: action.clusters, rev: action.rev }
    case 'upvote_optimistic':
      if (state.myUpvotes.includes(action.itemId)) return state
      return {
        ...state,
        myUpvotes: [...state.myUpvotes, action.itemId],
        dotsUsed: state.dotsUsed + 1,
        ideas: state.ideas.map((i) =>
          i.id === action.itemId ? { ...i, upvotes: i.upvotes + 1 } : i,
        ),
      }
    case 'upvote_rollback': {
      if (!state.myUpvotes.includes(action.itemId)) return state
      return {
        ...state,
        myUpvotes: state.myUpvotes.filter((id) => id !== action.itemId),
        dotsUsed: Math.max(0, state.dotsUsed - 1),
        ideas: state.ideas.map((i) =>
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

function toIdea(raw: Record<string, unknown>): IdeateIdea | null {
  if (!raw || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    body: typeof raw.body === 'string' ? raw.body : '',
    upvotes: typeof raw.upvotes === 'number' ? raw.upvotes : 0,
    clusterId: typeof raw.clusterId === 'string' ? raw.clusterId : null,
    status: raw.status === 'dismissed' ? 'dismissed' : 'active',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  }
}

function toCluster(raw: Record<string, unknown>): IdeateCluster | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.label !== 'string') return null
  return {
    id: raw.id,
    label: raw.label,
    ideaIds: Array.isArray(raw.ideaIds) ? (raw.ideaIds as string[]) : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  }
}

type Options = { fingerprint?: string; presenterToken?: string; enabled?: boolean }

export function useIdeateSession(sessionId: string | undefined, opts: Options = {}) {
  const [state, dispatch] = useReducer(ideateReducer, IDEATE_INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const pendingUpvoteRef = useRef<string | null>(null)
  const { fingerprint, presenterToken, enabled = true } = opts

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const msg = parseServerEnvelope(JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)))
        if (!msg) return
        const d = msg.data as Record<string, unknown>
        switch (msg.type) {
          case 'ideate_state': {
            const ideas = Array.isArray(d.ideas)
              ? (d.ideas as Record<string, unknown>[]).map(toIdea).filter(Boolean)
              : []
            const clusters = Array.isArray(d.clusters)
              ? (d.clusters as Record<string, unknown>[]).map(toCluster).filter(Boolean)
              : []
            const ranking = Array.isArray(d.ranking)
              ? (d.ranking as Record<string, unknown>[]).map((r) => ({
                  rank: typeof r.rank === 'number' ? r.rank : 0,
                  ideaId: typeof r.ideaId === 'string' ? r.ideaId : '',
                  body: typeof r.body === 'string' ? r.body : '',
                  upvotes: typeof r.upvotes === 'number' ? r.upvotes : 0,
                }))
              : []
            const snapshot: Extract<IdeateAction, { kind: 'snapshot' }> = {
              kind: 'snapshot',
              ideas: ideas as IdeateIdea[],
              clusters: clusters as IdeateCluster[],
              rev: typeof d.rev === 'number' ? d.rev : 0,
              dotVoteLimit: typeof d.dotVoteLimit === 'number' ? d.dotVoteLimit : 5,
              rankingRevealed: d.rankingRevealed === true,
              ranking,
            }
            if (Array.isArray(d.myUpvotes)) snapshot.myUpvotes = d.myUpvotes as string[]
            if (typeof d.dotsUsed === 'number') snapshot.dotsUsed = d.dotsUsed
            dispatch(snapshot)
            break
          }
          case 'ideate_idea_added': {
            const idea = toIdea(d.idea as Record<string, unknown>)
            if (idea) dispatch({ kind: 'idea_added', idea, rev: d.rev as number })
            break
          }
          case 'ideate_idea_updated': {
            const idea = toIdea(d.idea as Record<string, unknown>)
            if (idea) {
              if (pendingUpvoteRef.current === idea.id) pendingUpvoteRef.current = null
              dispatch({ kind: 'idea_updated', idea, rev: d.rev as number })
            }
            break
          }
          case 'ideate_ranking_revealed': {
            const ranking = Array.isArray(d.ranking)
              ? (d.ranking as Record<string, unknown>[]).map((r) => ({
                  rank: typeof r.rank === 'number' ? r.rank : 0,
                  ideaId: typeof r.ideaId === 'string' ? r.ideaId : '',
                  body: typeof r.body === 'string' ? r.body : '',
                  upvotes: typeof r.upvotes === 'number' ? r.upvotes : 0,
                }))
              : []
            dispatch({ kind: 'ranking_revealed', ranking, rev: d.rev as number })
            break
          }
          case 'ideate_clusters_updated': {
            const ideas = Array.isArray(d.ideas)
              ? (d.ideas as Record<string, unknown>[]).map(toIdea).filter(Boolean)
              : []
            const clusters = Array.isArray(d.clusters)
              ? (d.clusters as Record<string, unknown>[]).map(toCluster).filter(Boolean)
              : []
            dispatch({
              kind: 'clusters_updated',
              ideas: ideas as IdeateIdea[],
              clusters: clusters as IdeateCluster[],
              rev: d.rev as number,
            })
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
            dispatch({ kind: 'reconnecting' })
            break
          case 'closed':
            dispatch({ kind: 'closed' })
            break
          case 'failed':
            dispatch({ kind: 'failed', error: 'Connection lost' })
            break
        }
      },
    })
    return () => {
      handle.close()
    }
  }, [sessionId, enabled, fingerprint, presenterToken, handleMessage])

  const submit = useCallback((body: string) => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'ideate_submit',
      data: { body },
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
        type: 'ideate_upvote',
        data: { itemId },
        timestamp: Date.now(),
      })
    },
    [state.myUpvotes, state.dotsUsed, state.dotVoteLimit],
  )

  const revealRanking = useCallback(() => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'ideate_reveal',
      data: {},
      timestamp: Date.now(),
    })
  }, [])

  const dismiss = useCallback((itemId: string) => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'ideate_dismiss',
      data: { itemId },
      timestamp: Date.now(),
    })
  }, [])

  const merge = useCallback((targetId: string, sourceId: string) => {
    return sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'ideate_merge',
      data: { targetId, sourceId },
      timestamp: Date.now(),
    })
  }, [])

  return { state, submit, upvote, revealRanking, dismiss, merge }
}

export function ideasForCluster(ideas: IdeateIdea[], clusterId: string): IdeateIdea[] {
  return ideas.filter((i) => i.status === 'active' && i.clusterId === clusterId)
}

export function unclusteredIdeas(ideas: IdeateIdea[]): IdeateIdea[] {
  return ideas.filter((i) => i.status === 'active' && !i.clusterId)
}
