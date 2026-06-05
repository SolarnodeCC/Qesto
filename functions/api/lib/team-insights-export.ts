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
import { csvRow } from './csv'

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

export function insightsExportToCsv(bundle: InsightsExportBundle): string {
  const lines: string[] = []
  lines.push(csvRow(['section', 'key', 'value']))
  lines.push(csvRow(['meta', 'team_id', bundle.teamId]))
  lines.push(csvRow(['meta', 'window', bundle.window]))
  lines.push(csvRow(['meta', 'exported_at', bundle.exportedAt]))
  for (const t of bundle.recurringThemes) {
    lines.push(
      csvRow(['recurring_theme', t.label, t.sessionCount]),
    )
  }
  for (const p of bundle.engagement.points) {
    lines.push(
      csvRow(['engagement', p.day, `${p.sessions}/${p.avgVotes}`]),
    )
  }
  for (const f of bundle.scorecard.facilitators) {
    lines.push(
      csvRow(['facilitator', f.facilitatorId, f.sessionsRun]),
    )
  }
  return lines.join('\n')
}
