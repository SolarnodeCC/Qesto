import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeFacilitatorScorecard,
  listScorecardSourceRows,
} from '../../functions/api/lib/team-insights-scorecard'
import { upsertInsightsDaily } from '../../functions/api/lib/team-insights'
import { D1Mock } from '../helpers/d1-mock'

describe('team-insights-scorecard (INSIGHTS-05)', () => {
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

  it('computes per-facilitator metrics from non-ZK insights_daily rows', async () => {
    const db = new D1Mock()
    db.sessions.set('sess-1', {
      id: 'sess-1',
      owner_id: 'fac-a',
      code: 'AAAA11',
      title: 'Retro 1',
      status: 'closed',
      anonymity: 'full',
      vote_policy: 'once',
      session_mode: 'reflection',
      created_at: 1000,
      started_at: 1000,
      closed_at: 2000,
      archived_at: null,
      team_id: 'team-1',
    })
    db.sessions.set('sess-2', {
      id: 'sess-2',
      owner_id: 'fac-b',
      code: 'BBBB22',
      title: 'Retro 2',
      status: 'closed',
      anonymity: 'full',
      vote_policy: 'once',
      session_mode: 'reflection',
      created_at: 1000,
      started_at: 1000,
      closed_at: 2000,
      archived_at: null,
      team_id: 'team-1',
    })
    await upsertInsightsDaily(db as unknown as D1Database, {
      id: 'r1',
      session_id: 'sess-1',
      team_id: 'team-1',
      day: '2026-06-01',
      themes_json: JSON.stringify([{ theme: 'Morale', count: 2, examples: [] }]),
      confidence: 0.8,
      n_votes: 15,
      embedding_ref: true,
      computed_at: 1000,
    })
    await upsertInsightsDaily(db as unknown as D1Database, {
      id: 'r2',
      session_id: 'sess-2',
      team_id: 'team-1',
      day: '2026-06-02',
      themes_json: JSON.stringify([{ theme: 'Process', count: 1, examples: [] }]),
      confidence: 0.5,
      n_votes: 0,
      embedding_ref: false,
      computed_at: 1000,
    })

    const rows = await listScorecardSourceRows(db as unknown as D1Database, 'team-1', '2026-05-01')
    expect(rows).toHaveLength(2)
    const scorecard = computeFacilitatorScorecard(rows, '30d')
    expect(scorecard.facilitators).toHaveLength(2)
    expect(scorecard.teamSummary.sessionsRun).toBe(2)
    const facA = scorecard.facilitators.find((f) => f.facilitatorId === 'fac-a')
    expect(facA?.sessionsRun).toBe(1)
    expect(facA?.responseRate).toBe(1)
    // 0.8 confidence → 'high' insight-extraction confidence (M-1: renamed from
    // the misleading mood buckets — this measures parser certainty, not mood).
    expect(facA?.confidenceTrend[0]?.level).toBe('high')
  })

  it('excludes zero_knowledge sessions at query boundary', async () => {
    const db = new D1Mock()
    db.sessions.set('sess-zk', {
      id: 'sess-zk',
      owner_id: 'fac-a',
      code: 'ZKZK01',
      title: 'ZK',
      status: 'closed',
      anonymity: 'zero_knowledge',
      vote_policy: 'once',
      session_mode: 'reflection',
      created_at: 1000,
      started_at: 1000,
      closed_at: 2000,
      archived_at: null,
      team_id: 'team-1',
    })
    await upsertInsightsDaily(db as unknown as D1Database, {
      id: 'rz',
      session_id: 'sess-zk',
      team_id: 'team-1',
      day: '2026-06-01',
      themes_json: '[]',
      confidence: 0.9,
      n_votes: 99,
      embedding_ref: false,
      computed_at: 1000,
    })
    const rows = await listScorecardSourceRows(db as unknown as D1Database, 'team-1', '2026-01-01')
    expect(rows).toHaveLength(0)
  })
})
