import { describe, expect, it } from 'vitest'
import {
  deleteTeamInsightRollups,
  getTeamInsightRollup,
  upsertTeamInsightRollup,
} from '../../functions/api/lib/team-insights'
import { D1Mock } from '../helpers/d1-mock'

describe('team-insights repository', () => {
  it('upserts and reads team insight rollup', async () => {
    const db = new D1Mock()
    const row = {
      team_id: 'team-1',
      kind: 'recurring_themes' as const,
      window: '90d',
      payload_json: JSON.stringify({ themes: [{ label: 'engagement', count: 3 }] }),
      computed_at: Date.now(),
    }
    await upsertTeamInsightRollup(db as unknown as D1Database, row)
    const loaded = await getTeamInsightRollup(db as unknown as D1Database, 'team-1', 'recurring_themes', '90d')
    expect(loaded?.payload_json).toBe(row.payload_json)
  })

  it('deletes all rollups for a team', async () => {
    const db = new D1Mock()
    await upsertTeamInsightRollup(db as unknown as D1Database, {
      team_id: 'team-2',
      kind: 'engagement_trend',
      window: '30d',
      payload_json: '{}',
      computed_at: 1,
    })
    await deleteTeamInsightRollups(db as unknown as D1Database, 'team-2')
    const loaded = await getTeamInsightRollup(db as unknown as D1Database, 'team-2', 'engagement_trend', '30d')
    expect(loaded).toBeNull()
  })
})
