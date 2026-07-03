import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RECURRING_K_ANON_SESSIONS,
  clusterRecurringThemes,
  computeEngagementTrend,
  cutoffDayForWindow,
} from '../../functions/api/lib/team-insights-recurring'
import { upsertInsightsDaily } from '../../functions/api/lib/team-insights'
import { D1Mock } from '../helpers/d1-mock'

// clusterRecurringThemes filters rows against a rolling window computed from
// the real clock, so seeded days must be computed, not hardcoded — fixed dates
// fall out of the window as the calendar moves.
const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

describe('team-insights-recurring (INSIGHTS-03)', () => {
  // Freeze the clock: fixtures use fixed 2026-06 dates and assertions run against a
  // relative '30d' window, so a real clock makes these tests fail once wall-time
  // drifts past the window. Mid-June keeps all 2026-06-0x rows in-window.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-20T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('enforces k-anonymity floor — fewer than 3 sessions yields no themes', async () => {
    const db = new D1Mock()
    for (let i = 0; i < 2; i++) {
      await upsertInsightsDaily(db as unknown as D1Database, {
        id: `row-${i}`,
        session_id: `sess-${i}`,
        team_id: 'team-1',
        day: isoDaysAgo(5),
        themes_json: JSON.stringify([{ theme: 'engagement', count: 2, examples: [] }]),
        confidence: 0.5,
        n_votes: 8,
        embedding_ref: true,
        computed_at: 1000,
      })
    }
    const themes = await clusterRecurringThemes(
      { AI: {} as Ai, DECISIONS_VECTORIZE: { query: async () => ({ matches: [] }) } as unknown as VectorizeIndex },
      db as unknown as D1Database,
      'team-1',
      '30d',
    )
    expect(themes).toHaveLength(0)
    expect(RECURRING_K_ANON_SESSIONS).toBe(3)
  })

  it('surfaces recurring themes when ≥3 sessions share a label', async () => {
    const db = new D1Mock()
    for (let i = 0; i < 4; i++) {
      await upsertInsightsDaily(db as unknown as D1Database, {
        id: `row-${i}`,
        session_id: `sess-${i}`,
        team_id: 'team-2',
        day: isoDaysAgo(10 - i),
        themes_json: JSON.stringify([{ theme: 'Team morale', count: 3, examples: [] }]),
        confidence: 0.6,
        n_votes: 12,
        embedding_ref: true,
        computed_at: 1000 + i,
      })
    }
    const themes = await clusterRecurringThemes(
      { AI: {} as Ai, DECISIONS_VECTORIZE: { query: async () => ({ matches: [] }) } as unknown as VectorizeIndex },
      db as unknown as D1Database,
      'team-2',
      '30d',
    )
    expect(themes.length).toBeGreaterThan(0)
    expect(themes[0].sessionCount).toBeGreaterThanOrEqual(3)
  })

  it('computes engagement trend points from daily rows', () => {
    const trend = computeEngagementTrend([
      { session_id: 'a', day: '2026-06-01', themes_json: '[]', confidence: 0.5, n_votes: 10, embedding_ref: 1 },
      { session_id: 'b', day: '2026-06-02', themes_json: '[]', confidence: 0.7, n_votes: 20, embedding_ref: 1 },
    ])
    expect(trend.points).toHaveLength(2)
    expect(trend.summary.sessionCount).toBe(2)
    expect(trend.summary.avgVotes).toBe(15)
  })

  it('cutoffDayForWindow returns ISO date in the past', () => {
    const day = cutoffDayForWindow('30d', Date.parse('2026-06-30T00:00:00Z'))
    expect(day).toBe('2026-05-31')
  })
})
