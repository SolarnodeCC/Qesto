import { describe, expect, it } from 'vitest'
import { buildEngagementCsv } from '../../functions/api/lib/admin-engagement-csv'

describe('buildEngagementCsv (GAM-06)', () => {
  it('includes metrics and badge rows', () => {
    const csv = buildEngagementCsv({
      engagement: {
        energizer_activations: 3,
        energizer_participants: 10,
        energizer_completions: 2,
        energizer_dropouts: 1,
        leaderboard_participants: 5,
        badges_awarded: 4,
        ws_error_rate: 0.01,
        reconnect_rate: 0.02,
      },
      badge_breakdown: [{ kind: 'speedster', count: 2 }],
    })
    expect(csv).toContain('energizer_activations')
    expect(csv).toContain('"speedster"')
    expect(csv).toContain('"2"')
  })
})
