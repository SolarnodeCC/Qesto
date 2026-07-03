import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteTeamInsightRollups,
  getTeamInsightRollup,
  upsertTeamInsightRollup,
  upsertInsightsDaily,
} from '../../functions/api/lib/team-insights'
import { D1Mock } from '../helpers/d1-mock'

const dailyRow = (over: Partial<Parameters<typeof upsertInsightsDaily>[1]> = {}) => ({
  id: 'row-1',
  session_id: 'sess-1',
  team_id: 'team-1',
  day: '2026-06-20',
  themes_json: JSON.stringify([{ theme: 'engagement', count: 4, examples: [] }]),
  confidence: 0.4,
  n_votes: 10,
  embedding_ref: true,
  computed_at: 1000,
  ...over,
})

describe('team-insights repository', () => {
  // Freeze the clock so fixed 2026 fixture dates keep a stable relationship to the
  // relative window(s) resolved from "now" — otherwise these pass only by wall-clock
  // coincidence and drift into failure over time.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

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

  describe('upsertInsightsDaily (INSIGHTS-02)', () => {
    it('writes a per-session aggregate row', async () => {
      const db = new D1Mock()
      await upsertInsightsDaily(db as unknown as D1Database, dailyRow())
      const rows = [...db.insightsDaily.values()]
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ session_id: 'sess-1', team_id: 'team-1', n_votes: 10, embedding_ref: 1 })
    })

    it('is idempotent on (session_id, day) — re-run updates in place', async () => {
      const db = new D1Mock()
      await upsertInsightsDaily(db as unknown as D1Database, dailyRow())
      await upsertInsightsDaily(
        db as unknown as D1Database,
        dailyRow({ id: 'row-2', confidence: 0.9, n_votes: 25, embedding_ref: false }),
      )
      const rows = [...db.insightsDaily.values()]
      expect(rows).toHaveLength(1)
      expect(rows[0].confidence).toBe(0.9)
      expect(rows[0].n_votes).toBe(25)
      // embedding_ref is sticky once set.
      expect(rows[0].embedding_ref).toBe(1)
    })
  })
})
