/**
 * INSIGHTS-07 — cross-session export (JSON + CSV), formula-injection safe.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  clusterRecurringThemes,
  computeEngagementTrend,
  cutoffDayForWindow,
  listTeamInsightsDaily,
  type InsightTrendWindow,
} from './team-insights-recurring'
import { computeFacilitatorScorecard, listScorecardSourceRows } from './team-insights-scorecard'
import type { InsightsVectorizeBindings } from './insights-vectorize'

export type InsightsExportBundle = {
  teamId: string
  window: InsightTrendWindow
  exportedAt: string
  recurringThemes: Awaited<ReturnType<typeof clusterRecurringThemes>>
  engagement: ReturnType<typeof computeEngagementTrend>
  scorecard: ReturnType<typeof computeFacilitatorScorecard>
}

export async function buildInsightsExport(
  env: InsightsVectorizeBindings,
  db: D1Database,
  teamId: string,
  window: InsightTrendWindow,
): Promise<InsightsExportBundle> {
  const sinceDay = cutoffDayForWindow(window)
  const rows = await listTeamInsightsDaily(db, teamId, sinceDay)
  const scorecardRows = await listScorecardSourceRows(db, teamId, sinceDay)
  const recurringThemes = await clusterRecurringThemes(env, db, teamId, window)
  return {
    teamId,
    window,
    exportedAt: new Date().toISOString(),
    recurringThemes,
    engagement: computeEngagementTrend(rows),
    scorecard: computeFacilitatorScorecard(scorecardRows, window),
  }
}

/** Prefix cells that start with formula triggers to prevent CSV injection. */
export function sanitizeCsvCell(value: string | number): string {
  const s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function insightsExportToCsv(bundle: InsightsExportBundle): string {
  const lines: string[] = [
    'section,key,value',
    `meta,team_id,${sanitizeCsvCell(bundle.teamId)}`,
    `meta,window,${sanitizeCsvCell(bundle.window)}`,
    `meta,exported_at,${sanitizeCsvCell(bundle.exportedAt)}`,
  ]
  for (const t of bundle.recurringThemes) {
    lines.push(
      `recurring_theme,${sanitizeCsvCell(t.label)},${sanitizeCsvCell(String(t.sessionCount))}`,
    )
  }
  for (const p of bundle.engagement.points) {
    lines.push(
      `engagement,${sanitizeCsvCell(p.day)},${sanitizeCsvCell(`${p.sessions}/${p.avgVotes}`)}`,
    )
  }
  for (const f of bundle.scorecard.facilitators) {
    lines.push(
      `facilitator,${sanitizeCsvCell(f.facilitatorId)},${sanitizeCsvCell(String(f.sessionsRun))}`,
    )
  }
  return lines.join('\n')
}
