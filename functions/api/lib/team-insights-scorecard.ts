/**
 * INSIGHTS-05 — facilitator scorecard from insights_daily rollups (ADR-0045).
 * Non-ZK sessions only (ZK rows are structurally absent; query excludes zero_knowledge defensively).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { upsertTeamInsightRollup } from './team-insights'
import { cutoffDayForWindow, type InsightTrendWindow } from './team-insights-recurring'
import { InsightThemesJsonSchema, decodeKvJson } from './boundary-decode'

// Audit 2026-07-14 M-1: this trend is derived from insights_daily.confidence —
// the AI's theme-extraction confidence — NOT participant sentiment. It was
// previously named "moodTrend" with positive/neutral/concerning buckets, which
// read as team mood. Renamed to confidence semantics until the sentiment
// pipeline (lib/ai/sentiment.ts) is wired into insights_daily at close time.
export type ConfidenceBucket = 'high' | 'medium' | 'low'

export type ConfidenceTrendPoint = {
  day: string
  level: ConfidenceBucket
  sampleSize: number
}

export type FacilitatorScorecardEntry = {
  facilitatorId: string
  sessionsRun: number
  avgParticipation: number
  responseRate: number
  themeDiversity: number
  /** Daily insight-extraction confidence — not a sentiment/mood signal. */
  confidenceTrend: ConfidenceTrendPoint[]
}

export type FacilitatorScorecardPayload = {
  window: InsightTrendWindow
  facilitators: FacilitatorScorecardEntry[]
  teamSummary: {
    sessionsRun: number
    avgParticipation: number
    responseRate: number
    themeDiversity: number
  }
  computedAt: number
}

export const FacilitatorScorecardPayloadSchema = z.object({
  window: z.enum(['30d', '90d', '180d']),
  facilitators: z.array(
    z.object({
      facilitatorId: z.string(),
      sessionsRun: z.number(),
      avgParticipation: z.number(),
      responseRate: z.number(),
      themeDiversity: z.number(),
      confidenceTrend: z.array(
        z.object({
          day: z.string(),
          level: z.enum(['high', 'medium', 'low']),
          sampleSize: z.number(),
        }),
      ),
    }),
  ),
  teamSummary: z.object({
    sessionsRun: z.number(),
    avgParticipation: z.number(),
    responseRate: z.number(),
    themeDiversity: z.number(),
  }),
  computedAt: z.number(),
})

type ScorecardRow = {
  session_id: string
  day: string
  confidence: number
  n_votes: number
  themes_json: string
  owner_id: string
}

function bucketFromConfidence(confidence: number): ConfidenceBucket {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.4) return 'medium'
  return 'low'
}

function parseThemeLabels(themesJson: string): string[] {
  const parsed = decodeKvJson(themesJson, InsightThemesJsonSchema)
  if (!parsed) return []
  return parsed
    .map((t) => (typeof t.theme === 'string' ? t.theme.trim().toLowerCase() : ''))
    .filter(Boolean)
}

export async function listScorecardSourceRows(
  db: D1Database,
  teamId: string,
  sinceDay: string,
): Promise<ScorecardRow[]> {
  const result = await db
    .prepare(
      `SELECT i.session_id, i.day, i.confidence, i.n_votes, i.themes_json, s.owner_id
         FROM insights_daily i
         JOIN sessions s ON s.id = i.session_id
        WHERE i.team_id = ?1
          AND i.day >= ?2
          AND s.anonymity != 'zero_knowledge'`,
    )
    .bind(teamId, sinceDay)
    .all<ScorecardRow>()
  return result.results ?? []
}

export function computeFacilitatorScorecard(
  rows: ScorecardRow[],
  window: InsightTrendWindow,
): FacilitatorScorecardPayload {
  const byFacilitator = new Map<string, ScorecardRow[]>()
  for (const row of rows) {
    const bucket = byFacilitator.get(row.owner_id) ?? []
    bucket.push(row)
    byFacilitator.set(row.owner_id, bucket)
  }

  const facilitators: FacilitatorScorecardEntry[] = []
  let totalSessions = 0
  let totalVotes = 0
  let respondedSessions = 0
  const allThemes = new Set<string>()

  for (const [facilitatorId, facRows] of byFacilitator) {
    const sessionIds = new Set(facRows.map((r) => r.session_id))
    const sessionsRun = sessionIds.size
    const voteSum = facRows.reduce((s, r) => s + r.n_votes, 0)
    const withVotes = facRows.filter((r) => r.n_votes > 0).length
    const themes = new Set<string>()
    for (const r of facRows) {
      for (const label of parseThemeLabels(r.themes_json)) themes.add(label)
    }

    const confidenceByDay = new Map<string, { sum: number; n: number }>()
    for (const r of facRows) {
      const bucket = confidenceByDay.get(r.day) ?? { sum: 0, n: 0 }
      bucket.sum += r.confidence
      bucket.n += 1
      confidenceByDay.set(r.day, bucket)
    }
    const confidenceTrend: ConfidenceTrendPoint[] = [...confidenceByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, b]) => {
        const avg = b.n > 0 ? b.sum / b.n : 0
        return { day, level: bucketFromConfidence(avg), sampleSize: b.n }
      })

    facilitators.push({
      facilitatorId,
      sessionsRun,
      avgParticipation: sessionsRun > 0 ? Math.round((voteSum / sessionsRun) * 10) / 10 : 0,
      responseRate: sessionsRun > 0 ? Math.round((withVotes / sessionsRun) * 100) / 100 : 0,
      themeDiversity: themes.size,
      confidenceTrend,
    })

    totalSessions += sessionsRun
    totalVotes += voteSum
    respondedSessions += withVotes
    for (const t of themes) allThemes.add(t)
  }

  facilitators.sort((a, b) => b.sessionsRun - a.sessionsRun)

  return {
    window,
    facilitators,
    teamSummary: {
      sessionsRun: totalSessions,
      avgParticipation: totalSessions > 0 ? Math.round((totalVotes / totalSessions) * 10) / 10 : 0,
      responseRate: totalSessions > 0 ? Math.round((respondedSessions / totalSessions) * 100) / 100 : 0,
      themeDiversity: allThemes.size,
    },
    computedAt: Date.now(),
  }
}

/** Materialise facilitator_scorecard rollup for one window. */
export async function recomputeFacilitatorScorecard(
  db: D1Database,
  teamId: string,
  window: InsightTrendWindow,
): Promise<FacilitatorScorecardPayload> {
  const sinceDay = cutoffDayForWindow(window)
  const rows = await listScorecardSourceRows(db, teamId, sinceDay)
  const payload = computeFacilitatorScorecard(rows, window)
  await upsertTeamInsightRollup(db, {
    team_id: teamId,
    kind: 'facilitator_scorecard',
    window,
    payload_json: JSON.stringify(payload),
    computed_at: payload.computedAt,
  })
  return payload
}
