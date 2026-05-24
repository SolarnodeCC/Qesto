/**
 * ADMIN-ENGAGEMENT-COMPLETE-01 — energizer metrics grouped by kind.
 */
export type EnergizerKindMetric = {
  kind: string
  total: number
  active: number
  completed: number
  participants: number
}

export type EngagementSummary = {
  by_kind: EnergizerKindMetric[]
  completion_rate: number
  churn_risk_sessions: number
}

export function buildEngagementSummary(rows: EnergizerKindMetric[]): EngagementSummary {
  const total = rows.reduce((s, r) => s + r.total, 0)
  const completed = rows.reduce((s, r) => s + r.completed, 0)
  const churn_risk_sessions = rows.filter(
    (r) => r.total > 0 && r.completed / r.total < 0.5,
  ).length
  return {
    by_kind: rows,
    completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    churn_risk_sessions,
  }
}
