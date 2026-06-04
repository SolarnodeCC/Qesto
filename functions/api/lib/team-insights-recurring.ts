/**
 * INSIGHTS-03 — recurring-topic clustering across team sessions (ADR-0045 Tier-2).
 * Vectorize metadata-filtered similarity + k-anonymity floor (≥3 sessions).
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  DECISIONS_EMBED_DIM,
  DECISIONS_EMBED_MODEL,
  DECISIONS_VECTORIZE_TIMEOUT_MS,
  type InsightsVectorizeBindings,
} from './insights-vectorize'
import { upsertTeamInsightRollup, type TeamInsightKind } from './team-insights'
import { withTimeout } from './shared/async'

export const INSIGHT_TREND_WINDOWS = ['30d', '90d', '180d'] as const
export type InsightTrendWindow = (typeof INSIGHT_TREND_WINDOWS)[number]

/** k-anonymity floor: recurring themes must span at least this many distinct sessions (ADR-0045 §4). */
export const RECURRING_K_ANON_SESSIONS = 3

export type RecurringTheme = {
  label: string
  sessionCount: number
  firstSeen: string
  lastSeen: string
  score: number
}

export type EngagementTrendPoint = {
  day: string
  sessions: number
  avgVotes: number
  avgConfidence: number
}

export type EngagementTrendPayload = {
  points: EngagementTrendPoint[]
  summary: { sessionCount: number; avgConfidence: number; avgVotes: number }
}

function windowDays(window: InsightTrendWindow): number {
  if (window === '90d') return 90
  if (window === '180d') return 180
  return 30
}

export function cutoffDayForWindow(window: InsightTrendWindow, now = Date.now()): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - windowDays(window))
  return d.toISOString().slice(0, 10)
}

type DailyRow = {
  session_id: string
  day: string
  themes_json: string
  confidence: number
  n_votes: number
  embedding_ref: number
}

export async function listTeamInsightsDaily(
  db: D1Database,
  teamId: string,
  sinceDay: string,
): Promise<DailyRow[]> {
  const result = await db
    .prepare(
      `SELECT session_id, day, themes_json, confidence, n_votes, embedding_ref
         FROM insights_daily
        WHERE team_id = ?1 AND day >= ?2
        ORDER BY day ASC`,
    )
    .bind(teamId, sinceDay)
    .all<DailyRow>()
  return result.results ?? []
}

function parseThemeLabels(themesJson: string): string[] {
  try {
    const parsed = JSON.parse(themesJson) as Array<{ theme?: string }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((t) => (typeof t.theme === 'string' ? t.theme.trim() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

function firstVector(result: unknown): number[] | undefined {
  const raw = result as { data?: unknown }
  const first = Array.isArray(raw?.data) ? raw.data[0] : undefined
  if (!Array.isArray(first) || first.length !== DECISIONS_EMBED_DIM) return undefined
  return first.every((v) => typeof v === 'number') ? (first as number[]) : undefined
}

/**
 * Cluster recurring themes via Vectorize over team-tagged embeddings, with a
 * label-frequency fallback when Vectorize is unavailable.
 */
export async function clusterRecurringThemes(
  env: InsightsVectorizeBindings,
  db: D1Database,
  teamId: string,
  window: InsightTrendWindow,
): Promise<RecurringTheme[]> {
  const sinceDay = cutoffDayForWindow(window)
  const rows = await listTeamInsightsDaily(db, teamId, sinceDay)
  const embeddedSessions = new Set(
    rows.filter((r) => r.embedding_ref === 1).map((r) => r.session_id),
  )
  if (embeddedSessions.size < RECURRING_K_ANON_SESSIONS) return []

  const labelSessions = new Map<string, Set<string>>()
  const labelDays = new Map<string, { first: string; last: string }>()
  for (const row of rows) {
    for (const label of parseThemeLabels(row.themes_json)) {
      const key = label.toLowerCase()
      if (!labelSessions.has(key)) labelSessions.set(key, new Set())
      labelSessions.get(key)!.add(row.session_id)
      const span = labelDays.get(key) ?? { first: row.day, last: row.day }
      if (row.day < span.first) span.first = row.day
      if (row.day > span.last) span.last = row.day
      labelDays.set(key, span)
    }
  }

  let vectorThemes: RecurringTheme[] = []
  try {
    const seedLabels = [...labelSessions.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5)
      .map(([k]) => k)
    const embedText = `Team recurring themes: ${seedLabels.join('; ')}`
    const embedResult = await withTimeout(
      env.AI.run(DECISIONS_EMBED_MODEL, { text: embedText }),
      10_000,
      'Team insight embedding',
    )
    const vector = firstVector(embedResult)
    if (vector) {
      const queryResult = await withTimeout(
        env.DECISIONS_VECTORIZE.query(vector, {
          topK: 40,
          returnMetadata: 'all',
          filter: { team_id: teamId },
        }),
        DECISIONS_VECTORIZE_TIMEOUT_MS,
        'Team recurring Vectorize query',
      )
      const byTitle = new Map<string, { sessions: Set<string>; score: number; days: string[] }>()
      for (const match of queryResult.matches) {
        const meta = match.metadata as Record<string, string> | undefined
        const sessionId = meta?.session_id
        const title = (meta?.title ?? 'theme').trim()
        if (!sessionId) continue
        const bucket = byTitle.get(title) ?? { sessions: new Set(), score: 0, days: [] }
        bucket.sessions.add(sessionId)
        bucket.score = Math.max(bucket.score, match.score ?? 0)
        if (meta?.ts) bucket.days.push(meta.ts)
        byTitle.set(title, bucket)
      }
      vectorThemes = [...byTitle.entries()]
        .filter(([, b]) => b.sessions.size >= RECURRING_K_ANON_SESSIONS)
        .map(([label, b]) => ({
          label,
          sessionCount: b.sessions.size,
          firstSeen: sinceDay,
          lastSeen: new Date().toISOString().slice(0, 10),
          score: Math.round(b.score * 100) / 100,
        }))
    }
  } catch {
    vectorThemes = []
  }

  const frequencyThemes: RecurringTheme[] = [...labelSessions.entries()]
    .filter(([, sessions]) => sessions.size >= RECURRING_K_ANON_SESSIONS)
    .map(([key, sessions]) => {
      const span = labelDays.get(key)!
      return {
        label: key,
        sessionCount: sessions.size,
        firstSeen: span.first,
        lastSeen: span.last,
        score: sessions.size / embeddedSessions.size,
      }
    })
    .sort((a, b) => b.sessionCount - a.sessionCount)

  const merged = new Map<string, RecurringTheme>()
  for (const t of [...vectorThemes, ...frequencyThemes]) {
    const existing = merged.get(t.label.toLowerCase())
    if (!existing || t.sessionCount > existing.sessionCount) {
      merged.set(t.label.toLowerCase(), t)
    }
  }
  return [...merged.values()].sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 12)
}

export function computeEngagementTrend(rows: DailyRow[]): EngagementTrendPayload {
  const byDay = new Map<string, { sessions: number; votes: number; confidence: number }>()
  for (const row of rows) {
    const bucket = byDay.get(row.day) ?? { sessions: 0, votes: 0, confidence: 0 }
    bucket.sessions += 1
    bucket.votes += row.n_votes
    bucket.confidence += row.confidence
    byDay.set(row.day, bucket)
  }
  const points: EngagementTrendPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, b]) => ({
      day,
      sessions: b.sessions,
      avgVotes: b.sessions > 0 ? Math.round((b.votes / b.sessions) * 10) / 10 : 0,
      avgConfidence: b.sessions > 0 ? Math.round((b.confidence / b.sessions) * 100) / 100 : 0,
    }))
  const sessionCount = rows.length
  const avgConfidence =
    sessionCount > 0
      ? Math.round((rows.reduce((s, r) => s + r.confidence, 0) / sessionCount) * 100) / 100
      : 0
  const avgVotes =
    sessionCount > 0
      ? Math.round((rows.reduce((s, r) => s + r.n_votes, 0) / sessionCount) * 10) / 10
      : 0
  return { points, summary: { sessionCount, avgConfidence, avgVotes } }
}

/** Materialise Tier-2 rollups for one window (recurring_themes + engagement_trend). */
export async function recomputeTeamInsightRollups(
  env: InsightsVectorizeBindings,
  db: D1Database,
  teamId: string,
  window: InsightTrendWindow,
): Promise<{ recurringThemes: RecurringTheme[]; engagement: EngagementTrendPayload }> {
  const sinceDay = cutoffDayForWindow(window)
  const rows = await listTeamInsightsDaily(db, teamId, sinceDay)
  const recurringThemes = await clusterRecurringThemes(env, db, teamId, window)
  const engagement = computeEngagementTrend(rows)
  const computedAt = Date.now()

  const kinds: Array<{ kind: TeamInsightKind; payload: unknown }> = [
    { kind: 'recurring_themes', payload: { themes: recurringThemes, window, kFloor: RECURRING_K_ANON_SESSIONS } },
    { kind: 'engagement_trend', payload: { ...engagement, window } },
  ]
  for (const { kind, payload } of kinds) {
    await upsertTeamInsightRollup(db, {
      team_id: teamId,
      kind,
      window,
      payload_json: JSON.stringify(payload),
      computed_at: computedAt,
    })
  }

  return { recurringThemes, engagement }
}
