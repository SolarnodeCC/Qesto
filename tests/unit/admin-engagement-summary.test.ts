import { describe, expect, it } from 'vitest'
import { buildEngagementSummary } from '../../functions/api/lib/admin-engagement-summary'

describe('buildEngagementSummary', () => {
  it('computes completion rate and churn risk', () => {
    const summary = buildEngagementSummary([
      { kind: 'quick_finger', total: 10, active: 1, completed: 8, participants: 50 },
      { kind: 'team_quiz', total: 4, active: 2, completed: 1, participants: 20 },
    ])
    expect(summary.completion_rate).toBe(64.3)
    expect(summary.churn_risk_sessions).toBe(1)
    expect(summary.by_kind).toHaveLength(2)
  })
})
