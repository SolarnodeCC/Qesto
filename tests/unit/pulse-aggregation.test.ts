// PULSE-STORE-01 (ADR-0057) — aggregation store unit tests

import { describe, expect, it } from 'vitest'
import {
  computeSessionRollup,
  rollupPulseOnSessionClose,
  fetchTeamPulseSummary,
} from '../../functions/api/lib/pulse-aggregation'
import { D1Mock } from '../helpers/d1-mock'

function seedClosedSession(
  db: D1Mock,
  id: string,
  opts: { teamId?: string; anonymity?: 'full' | 'zero_knowledge'; closedAt?: number } = {},
) {
  db.sessions.set(id, {
    id,
    owner_id: 'owner-1',
    code: 'CODE01',
    title: 'Pulse survey',
    status: 'closed',
    anonymity: opts.anonymity ?? 'full',
    vote_policy: 'once',
    session_mode: 'reflection',
    created_at: 1000,
    started_at: 1000,
    closed_at: opts.closedAt ?? 1_700_000_000_000,
    archived_at: null,
    team_id: opts.teamId ?? 'team-1',
  })
}

describe('pulse-aggregation (PULSE-STORE-01)', () => {
  it('skips zero_knowledge sessions at rollup boundary', async () => {
    const db = new D1Mock()
    seedClosedSession(db, 's-zk', { anonymity: 'zero_knowledge' })
    const rollup = await computeSessionRollup(db as unknown as D1Database, 's-zk')
    expect(rollup).toBeNull()
  })

  it('computes participation metrics from votes', async () => {
    const db = new D1Mock()
    seedClosedSession(db, 's1', { teamId: 'team-1' })
    db.votes.set('v1', {
      id: 'v1',
      session_id: 's1',
      question_id: 'q1',
      voter_id: 'u1',
      option_id: 'a',
      submitted_at: 1,
    })
    db.votes.set('v2', {
      id: 'v2',
      session_id: 's1',
      question_id: 'q1',
      voter_id: 'u1',
      option_id: 'b',
      submitted_at: 2,
    })
    db.votes.set('v3', {
      id: 'v3',
      session_id: 's1',
      question_id: 'q1',
      voter_id: 'u2',
      option_id: 'a',
      submitted_at: 3,
    })
    db.questions.set('q1', {
      id: 'q1',
      session_id: 's1',
      position: 0,
      kind: 'poll',
      prompt: 'Q',
      options_json: '[]',
      created_at: 1,
    })

    const rollup = await computeSessionRollup(db as unknown as D1Database, 's1')
    expect(rollup).not.toBeNull()
    expect(rollup!.participantCount).toBe(2)
    expect(rollup!.voteCount).toBe(3)
  })

  it('rollupPulseOnSessionClose writes session + team daily rows', async () => {
    const db = new D1Mock()
    seedClosedSession(db, 's2', { teamId: 'team-2', closedAt: Date.now() - 86_400_000 })
    db.votes.set('v1', {
      id: 'v1',
      session_id: 's2',
      question_id: 'q1',
      voter_id: 'u1',
      option_id: 'a',
      submitted_at: 1,
    })
    db.questions.set('q1', {
      id: 'q1',
      session_id: 's2',
      position: 0,
      kind: 'poll',
      prompt: 'Q',
      options_json: '[]',
      created_at: 1,
    })

    await rollupPulseOnSessionClose({ DB: db as unknown as D1Database } as never, 's2')

    expect(db.pulseSessionRollups.has('s2')).toBe(true)
    const daily = await fetchTeamPulseSummary(db as unknown as D1Database, 'team-2', '30d')
    expect(daily.length).toBeGreaterThan(0)
  })
})
