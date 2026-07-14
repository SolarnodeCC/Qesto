/**
 * INSIGHTS-03 — recurring-topic clustering across team sessions (ADR-0045 Tier-2).
 * Vectorize metadata-filtered similarity + k-anonymity floor (≥3 sessions).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { InsightsVectorizeBindings } from './insights-vectorize'
import { upsertTeamInsightRollup, type TeamInsightKind } from './team-insights'
import { InsightThemesJsonSchema, decodeKvJson } from './boundary-decode'
import { logEvent } from './log'

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
  const parsed = decodeKvJson(themesJson, InsightThemesJsonSchema)
  if (!parsed) return []
  return parsed
    .map((t) => (typeof t.theme === 'string' ? t.theme.trim() : ''))
    .filter(Boolean)
}

/**
 * Cluster recurring themes by label frequency over the team's insights_daily
 * rows, with the k-anonymity floor applied per label.
 *
 * Audit 2026-07-14 M-7: the previous Vectorize path embedded a single centroid
 * of the top labels and then grouped matches by the `title` metadata field —
 * i.e. *session titles* surfaced as "themes", and any failure silently fell
 * back to this frequency count anyway. The vector metadata carries no theme
 * labels, so the path could not be fixed in place; it was removed (saving an
 * embedding + query per cache miss) until per-theme embeddings exist at upsert
 * time. `env` stays in the signature for that reintroduction.
 */
export async function clusterRecurringThemes(
  _env: InsightsVectorizeBindings,
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
    .slice(0, 12)

  logEvent({
    event: 'insight.recurring_themes.computed',
    source: 'label_frequency',
    teamId,
    window,
    themeCount: frequencyThemes.length,
  })
  return frequencyThemes
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
