import { describe, expect, it } from 'vitest'
import {
  moodFromRetroCounts,
  parseRetroHealthTheme,
  persistRetroHealthSnapshot,
  recomputeWorkspaceTeamHealthTrend,
} from '../../functions/api/lib/workspace-trends'
import { D1Mock } from '../helpers/d1-mock'

describe('moodFromRetroCounts', () => {
  it('maps ratio to mood buckets', () => {
    expect(moodFromRetroCounts(6, 2)).toMatchObject({ mood: 'positive', moodScore: 0.75 })
    expect(moodFromRetroCounts(2, 4)).toMatchObject({ mood: 'concerning', moodScore: 0.33 })
    expect(moodFromRetroCounts(0, 0)).toMatchObject({ mood: 'neutral', moodScore: 0.5 })
  })
})

describe('parseRetroHealthTheme', () => {
  it('extracts retro_health from themes_json', () => {
    const json = JSON.stringify([{ kind: 'retro_health', wentWell: 3, didntGoWell: 1, actions: 2, totalCards: 6 }])
    expect(parseRetroHealthTheme(json)).toMatchObject({ wentWell: 3, totalCards: 6 })
  })
})

describe('recomputeWorkspaceTeamHealthTrend', () => {
  it('returns insufficient_data below 3 instances', async () => {
    const db = new D1Mock()
    const payload = await recomputeWorkspaceTeamHealthTrend(db as unknown as D1Database, 'ws_1', '90d')
    expect(payload.message).toBe('insufficient_data')
    expect(payload.instanceCount).toBe(0)
  })

  it('builds trend points when enough retro data exists', async () => {
    const db = new D1Mock()
    const now = Date.now()
    const workspaceId = 'ws_health'
    for (let i = 1; i <= 3; i++) {
      const sessionId = `sess_${i}`
      db.sessions.set(sessionId, {
        id: sessionId,
        owner_id: 'user_1',
        code: `R${i}`,
        title: `Retro ${i}`,
        status: 'closed',
        anonymity: 'full',
        vote_policy: 'once',
        session_mode: 'retro',
        workspace_id: workspaceId,
        workspace_seq: i,
        created_at: now,
        started_at: now - 3600_000,
        closed_at: now - i * 86_400_000,
        archived_at: null,
      } as never)
      await persistRetroHealthSnapshot(db as unknown as D1Database, {
        sessionId,
        teamId: 'team_1',
        closedAt: now - i * 86_400_000,
        stats: { wentWell: 4 + i, didntGoWell: 1, actions: 2, totalCards: 7 + i },
      })
    }
    const payload = await recomputeWorkspaceTeamHealthTrend(db as unknown as D1Database, workspaceId, '90d')
    expect(payload.points).toHaveLength(3)
    expect(payload.points?.[0]?.mood).toBe('positive')
  })
})
