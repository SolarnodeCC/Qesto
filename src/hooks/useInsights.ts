import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionSummary } from './useSessions'
import { api } from '../api/client'

export type InsightConfidence = 'high' | 'medium' | 'low'

export interface AggregatedTheme {
  id: string
  title: string
  description: string
  sessionCount: number
  confidence: InsightConfidence
}

interface RawInsights {
  session_id: string
  themes: string[]
  follow_ups: string[]
  generated_at: number
  model: string
}

interface InsightsState {
  themes: AggregatedTheme[]
  loading: boolean
  planGated: boolean
  analyzeSession: (sessionId: string) => Promise<void>
}

function deriveConfidence(sessionCount: number): InsightConfidence {
  if (sessionCount >= 3) return 'high'
  if (sessionCount >= 2) return 'medium'
  return 'low'
}

function makeTitle(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.length > 64 ? trimmed.slice(0, 61) + '…' : trimmed
}

function aggregateThemes(perSession: Map<string, RawInsights>): AggregatedTheme[] {
  // Count how many sessions mention a "similar" theme (exact normalized string match).
  const counts = new Map<string, { sessionIds: Set<string>; raw: string }>()

  for (const [sessionId, insights] of perSession) {
    for (const theme of insights.themes) {
      const key = theme.toLowerCase().slice(0, 48) // normalize for grouping
      const existing = counts.get(key)
      if (existing) {
        existing.sessionIds.add(sessionId)
      } else {
        counts.set(key, { sessionIds: new Set([sessionId]), raw: theme })
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.sessionIds.size - a.sessionIds.size)
    .slice(0, 5)
    .map(({ raw, sessionIds }, idx) => ({
      id: String(idx),
      title: makeTitle(raw),
      description: raw,
      sessionCount: sessionIds.size,
      confidence: deriveConfidence(sessionIds.size),
    }))
}

export function useInsights(closedSessions: SessionSummary[]): InsightsState {
  const [themes, setThemes] = useState<AggregatedTheme[]>([])
  const [loading, setLoading] = useState(false)
  const [planGated, setPlanGated] = useState(false)
  // Track fetched insights by session ID to avoid re-fetching.
  const cache = useRef<Map<string, RawInsights>>(new Map())

  const fetchAll = useCallback(async (sessions: SessionSummary[]) => {
    if (sessions.length === 0) {
      setThemes([])
      return
    }
    setLoading(true)
    let hitPlanGate = false

    await Promise.all(
      sessions.map(async (s) => {
        if (cache.current.has(s.id)) return
        const res = await api<{ session_id: string; themes?: string[]; follow_ups?: string[]; generated_at?: number; model?: string; insights: null | RawInsights; message?: string }>(
          `/api/sessions/${encodeURIComponent(s.id)}/insights`,
        )
        if (!res.ok) {
          if (res.status === 403) hitPlanGate = true
          return
        }
        const d = res.data
        // API returns either the cached insights object directly or { insights: null }
        const raw = (d as any)?.themes
          ? (d as unknown as RawInsights)
          : (d as any)?.insights ?? null
        if (raw && Array.isArray(raw.themes)) {
          cache.current.set(s.id, raw as RawInsights)
        }
      }),
    )

    setPlanGated(hitPlanGate)
    setThemes(aggregateThemes(cache.current))
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchAll(closedSessions)
  }, [closedSessions, fetchAll])

  const analyzeSession = useCallback(async (sessionId: string) => {
    const res = await api<{ session_id: string; themes: string[]; follow_ups: string[]; generated_at: number; model: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/insights/analyze`,
      { method: 'POST' },
    )
    if (!res.ok) {
      if (res.status === 403) setPlanGated(true)
      return
    }
    cache.current.set(sessionId, res.data as RawInsights)
    setThemes(aggregateThemes(cache.current))
  }, [])

  return { themes, loading, planGated, analyzeSession }
}
