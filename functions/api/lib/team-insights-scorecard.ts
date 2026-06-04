/**
 * INSIGHTS-05 — facilitator scorecard from insights_daily rollups (ADR-0045).
 * Non-ZK sessions only (ZK rows are structurally absent; query excludes zero_knowledge defensively).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { upsertTeamInsightRollup } from './team-insights'
import { cutoffDayForWindow, type InsightTrendWindow } from './team-insights-recurring'

export type MoodBucket = 'positive' | 'neutral' | 'concerning'

export type MoodTrendPoint = {
  day: string
  mood: MoodBucket
  sampleSize: number
}

export type FacilitatorScorecardEntry = {
  facilitatorId: string
  sessionsRun: number
  avgParticipation: number
  responseRate: number
  themeDiversity: number
  moodTrend: MoodTrendPoint[]
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

type ScorecardRow = {
  session_id: string
  day: string
  confidence: number
  n_votes: number
  themes_json: string
  owner_id: string
}

function moodFromConfidence(confidence: number): MoodBucket {
  if (confidence >= 0.7) return 'positive'
  if (confidence >= 0.4) return 'neutral'
  return 'concerning'
}

function parseThemeLabels(themesJson: string): string[] {
  try {
    const parsed = JSON.parse(themesJson) as Array<{ theme?: string }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((t) => (typeof t.theme === 'string' ? t.theme.trim().toLowerCase() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
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

    const moodByDay = new Map<string, { sum: number; n: number }>()
    for (const r of facRows) {
      const bucket = moodByDay.get(r.day) ?? { sum: 0, n: 0 }
      bucket.sum += r.confidence
      bucket.n += 1
      moodByDay.set(r.day, bucket)
    }
    const moodTrend: MoodTrendPoint[] = [...moodByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, b]) => {
        const avg = b.n > 0 ? b.sum / b.n : 0
        return { day, mood: moodFromConfidence(avg), sampleSize: b.n }
      })

    facilitators.push({
      facilitatorId,
      sessionsRun,
      avgParticipation: sessionsRun > 0 ? Math.round((voteSum / sessionsRun) * 10) / 10 : 0,
      responseRate: sessionsRun > 0 ? Math.round((withVotes / sessionsRun) * 100) / 100 : 0,
      themeDiversity: themes.size,
      moodTrend,
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
