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
  /** Weekly session counts over the last 30 days, oldest → newest (4 buckets) */
  trend30d: number[]
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

/**
 * Coerce an insights payload into RawInsights. Themes may arrive as strings
 * (analyze payload) or `{ theme }` objects (older cached GET payloads). A
 * non-string theme used to throw in aggregateThemes (`theme.toLowerCase`),
 * which left the dashboard spinner stuck and poisoned sessionStorage.
 */
export function normaliseRaw(sessionId: string, value: unknown): RawInsights | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.themes)) return null
  const themes = v.themes
    .map((t) => (typeof t === 'string' ? t : t && typeof t === 'object' ? (t as { theme?: unknown }).theme : null))
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  return {
    session_id: typeof v.session_id === 'string' ? v.session_id : sessionId,
    themes,
    follow_ups: Array.isArray(v.follow_ups) ? v.follow_ups.filter((f): f is string => typeof f === 'string') : [],
    generated_at: typeof v.generated_at === 'number' ? v.generated_at : Date.now(),
    model: typeof v.model === 'string' ? v.model : '',
  }
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!
      await fn(item)
    }
  })
  await Promise.all(workers)
}

function deriveConfidence(sessionCount: number): InsightConfidence {
  if (sessionCount >= 3) return 'high'
  if (sessionCount >= 2) return 'medium'
  return 'low'
}

function buildTrend30d(timestamps: number[]): number[] {
  const now = Date.now()
  const buckets = [0, 0, 0, 0]
  for (const ts of timestamps) {
    const daysAgo = (now - ts) / 86400000
    if (daysAgo <= 7) buckets[3]++
    else if (daysAgo <= 14) buckets[2]++
    else if (daysAgo <= 21) buckets[1]++
    else if (daysAgo <= 30) buckets[0]++
  }
  return buckets
}

function makeTitle(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.length > 64 ? trimmed.slice(0, 61) + '…' : trimmed
}

function aggregateThemes(perSession: Map<string, RawInsights>): AggregatedTheme[] {
  const counts = new Map<string, { sessionIds: Set<string>; raw: string; timestamps: number[] }>()

  for (const [sessionId, insights] of perSession) {
    for (const theme of insights.themes) {
      const key = theme.toLowerCase().slice(0, 48)
      const existing = counts.get(key)
      if (existing) {
        existing.sessionIds.add(sessionId)
        existing.timestamps.push(insights.generated_at)
      } else {
        counts.set(key, { sessionIds: new Set([sessionId]), raw: theme, timestamps: [insights.generated_at] })
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.sessionIds.size - a.sessionIds.size)
    .slice(0, 5)
    .map(({ raw, sessionIds, timestamps }, idx) => ({
      id: String(idx),
      title: makeTitle(raw),
      description: raw,
      sessionCount: sessionIds.size,
      confidence: deriveConfidence(sessionIds.size),
      trend30d: buildTrend30d(timestamps),
    }))
}

// Audit 2026-07-14 H-4: previously every closed session got its own GET on
// every dashboard mount (unbounded Promise.all) and the cache died with the
// component. Cap the fan-out to the most recent sessions and persist the
// per-session cache in sessionStorage so returning to the dashboard is free.
const INSIGHTS_FETCH_CAP = 20
const INSIGHTS_FETCH_CONCURRENCY = 4
// v2: v1 entries could hold `{ theme }` objects that crashed aggregation.
const INSIGHTS_STORAGE_KEY = 'qesto:insights:v2'

function loadPersistedCache(): Map<string, RawInsights> {
  try {
    // jankurai:allow websec.storage.token (HLT-039) reason=insights themes cache holds no credential material; detector keyword 'session' self-matches the sessionStorage API name expires=2027-06-30
    const raw = sessionStorage.getItem(INSIGHTS_STORAGE_KEY)
    if (!raw) return new Map()
    const entries = JSON.parse(raw) as unknown
    if (!Array.isArray(entries)) return new Map()
    const out = new Map<string, RawInsights>()
    for (const entry of entries) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue
      const parsed = normaliseRaw(entry[0], entry[1])
      if (parsed) out.set(entry[0], parsed)
    }
    return out
  } catch {
    return new Map()
  }
}

function persistCache(cache: Map<string, RawInsights>): void {
  try {
    // jankurai:allow websec.storage.token (HLT-039) reason=insights themes cache holds no credential material; detector keyword 'session' self-matches the sessionStorage API name expires=2027-06-30
    sessionStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify([...cache]))
  } catch {
    // sessionStorage full/unavailable — in-memory cache still works.
  }
}

export function useInsights(closedSessions: SessionSummary[], enabled = false): InsightsState {
  const [themes, setThemes] = useState<AggregatedTheme[]>([])
  const [loading, setLoading] = useState(false)
  const [planGated, setPlanGated] = useState(false)
  // Track fetched insights by session ID to avoid re-fetching. Seeded from
  // sessionStorage so a return to the dashboard replays nothing. The Map
  // identity is stable for the component's lifetime, so the useCallback
  // closures below can capture it directly.
  const cacheRef = useRef<Map<string, RawInsights> | null>(null)
  const cache = cacheRef.current ?? (cacheRef.current = loadPersistedCache())
  // Track sessions that failed to fetch so we don't retry them in a loop.
  const failed = useRef<Set<string>>(new Set())
  // Prevent concurrent fetches when closedSessions reference changes mid-flight.
  const fetching = useRef(false)

  const fetchAll = useCallback(async (allSessions: SessionSummary[]) => {
    if (allSessions.length === 0) {
      setThemes([])
      return
    }
    if (fetching.current) return
    fetching.current = true
    setLoading(true)
    let hitPlanGate = false

    const sessions = [...allSessions]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, INSIGHTS_FETCH_CAP)

    try {
      await mapLimited(sessions, INSIGHTS_FETCH_CONCURRENCY, async (s) => {
        if (cache.has(s.id) || failed.current.has(s.id)) return
        const res = await api<Record<string, unknown>>(
          `/api/sessions/${encodeURIComponent(s.id)}/insights`,
        )
        if (!res.ok) {
          // Governance 403s (consent_required / zk_not_supported) are not
          // plan gating — don't show the upgrade prompt for them.
          if (res.status === 403 && res.error.code !== 'consent_required' && res.error.code !== 'zk_not_supported') {
            hitPlanGate = true
          }
          failed.current.add(s.id)
          return
        }
        // GET returns the analyze payload ({ themes: string[], ... }) or
        // { insights: null } when the session hasn't been analyzed yet.
        const d = res.data
        if (d?.insights === null) return // not analyzed yet — don't cache an empty entry
        const raw = normaliseRaw(s.id, d)
        if (raw) cache.set(s.id, raw)
      })
      persistCache(cache)
      setPlanGated(hitPlanGate)
      setThemes(aggregateThemes(cache))
    } catch {
      // Aggregation/network failure must never leave the spinner stuck.
      setThemes([])
    } finally {
      setLoading(false)
      fetching.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache Map identity is stable
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void fetchAll(closedSessions).finally(() => {
      if (cancelled) fetching.current = false
    })
    return () => { cancelled = true }
  }, [closedSessions, fetchAll, enabled])

  const analyzeSession = useCallback(async (sessionId: string) => {
    const res = await api<{ session_id: string; themes: string[]; follow_ups: string[]; generated_at: number; model: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/insights/analyze`,
      { method: 'POST' },
    )
    if (!res.ok) {
      if (res.status === 403 && res.error.code !== 'consent_required' && res.error.code !== 'zk_not_supported') {
        setPlanGated(true)
      }
      return
    }
    const raw = normaliseRaw(sessionId, res.data)
    if (!raw) return
    cache.set(sessionId, raw)
    persistCache(cache)
    setThemes(aggregateThemes(cache))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache Map identity is stable
  }, [])

  return { themes, loading, planGated, analyzeSession }
}
