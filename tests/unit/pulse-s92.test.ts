import { describe, expect, it } from 'vitest'
import {
  applyKAnonymityToDailyRows,
  fetchTeamLongitudinalTrends,
  fetchTeamPulseSummaryIsolated,
  runPulseRetentionPolicy,
  PULSE_K_ANON_MIN_COHORT,
} from '../../functions/api/lib/pulse-aggregation'
import { D1Mock } from '../helpers/d1-mock'

describe('pulse S92 (longitudinal, k-anon, retention, isolation)', () => {
  it('masks daily rows below k-anonymity floor', () => {
    const masked = applyKAnonymityToDailyRows([
      {
        teamId: 't1',
        day: '2026-06-01',
        participationAvg: 0.8,
        sentimentAvg: 0.5,
        sessionCount: PULSE_K_ANON_MIN_COHORT - 1,
        responseTotal: 40,
        computedAt: 1,
      },
    ])
    expect(masked[0]?.masked).toBe(true)
    expect(masked[0]?.participationAvg).toBe(0)
  })

  it('returns longitudinal trends for ≥3 sessions', async () => {
    const db = new D1Mock()
    const teamId = 'team-pulse'
    const closedAt = Date.now() - 86_400_000
    for (let i = 0; i < 3; i++) {
      db.pulseSessionRollups.set(`s${i}`, {
        session_id: `s${i}`,
        team_id: teamId,
        workspace_id: null,
        closed_at: closedAt + i * 1000,
        participant_count: 10,
        vote_count: 20 + i,
        participation_rate: 0.5 + i * 0.05,
        sentiment_score: null,
        payload_json: JSON.stringify({ questionCount: 2 }),
        computed_at: closedAt,
      })
    }
    const trends = await fetchTeamLongitudinalTrends(db as unknown as D1Database, teamId, '90d')
    expect(trends.sessionCount).toBe(3)
    expect(trends.participationArc).toHaveLength(3)
  })

  it('isolates cross-team reads', async () => {
    const db = new D1Mock()
    const rows = await fetchTeamPulseSummaryIsolated(db as unknown as D1Database, 'team-a', 'team-b', '30d')
    expect(rows).toEqual([])
  })

  it('runs retention redact/delete without throwing', async () => {
    const db = new D1Mock()
    const result = await runPulseRetentionPolicy(db as unknown as D1Database, Date.now())
    expect(result).toMatchObject({
      redactedSessions: expect.any(Number),
      deletedSessions: expect.any(Number),
      deletedDailyRows: expect.any(Number),
    })
  })
})
