// Core-audit E-1/E-4: per-viewer projection of live energizer state. Voters
// must never receive the answer key or other voters' raw answers; presenters
// keep the full state.

import { describe, expect, it } from 'vitest'
import { redactEnergizerForViewer } from '../../functions/api/lib/session-room-energizer'
import type { LiveEnergizerState } from '../../functions/api/realtime'

const QUICK_FINGER: LiveEnergizerState = {
  id: 'eg_qf',
  kind: 'quick_finger',
  title: 'Quick finger',
  status: 'active',
  options: ['A', 'B'],
  correctIndex: 1,
  startedAt: 1_000,
  answers: [
    { voterId: 'v1', value: 'B', correct: true, speedMs: 100, rank: 1 },
    { voterId: 'v2', value: 'B', correct: true, speedMs: 200, rank: 2 },
    { voterId: 'v3', value: 'B', correct: true, speedMs: 300, rank: 3 },
    { voterId: 'v4', value: 'B', correct: true, speedMs: 400, rank: 4 },
    { voterId: 'v5', value: 'A', correct: false, speedMs: 150, rank: 0 },
  ],
  badges: {
    v1: [{ id: 'eg_qf:first_answer:v1', kind: 'first_answer', label: 'First answer', awardedAt: 1_000 }],
    v5: [{ id: 'eg_qf:speedster:v5', kind: 'speedster', label: 'Speedster', awardedAt: 1_000 }],
  },
  leaderboard: [{ voterId: 'v1', label: 'Player 1', score: 13, rank: 1, badges: [] }],
}

const TEAM_QUIZ: LiveEnergizerState = {
  id: 'eg_tq',
  kind: 'team_quiz',
  title: 'Quiz',
  status: 'active',
  currentIndex: 0,
  questions: [
    { prompt: 'Q1?', options: ['A', 'B'], correctIndex: 1 },
    { prompt: 'Q2?', options: ['C', 'D'], correctIndex: 0 },
  ],
  submissions: [
    { voterId: 'v1', questionIndex: 0, value: 'B', correct: true },
    { voterId: 'v2', questionIndex: 0, value: 'A', correct: false },
  ],
  scores: [
    { voterId: 'v1', score: 1, rank: 1 },
    { voterId: 'v2', score: 0, rank: 2 },
  ],
}

describe('redactEnergizerForViewer', () => {
  it('returns the full state for presenters', () => {
    const view = redactEnergizerForViewer(TEAM_QUIZ, { role: 'presenter', voterId: 'host_x' })
    expect(view).toEqual(TEAM_QUIZ)
  })

  it('strips the quick-finger answer key while active and reveals it when completed', () => {
    const active = redactEnergizerForViewer(QUICK_FINGER, { role: 'voter', voterId: 'v4' })
    expect(active.correctIndex).toBeUndefined()

    const completed = redactEnergizerForViewer(
      { ...QUICK_FINGER, status: 'completed' },
      { role: 'voter', voterId: 'v4' },
    )
    expect(completed.correctIndex).toBe(1)
  })

  it('strips per-question answer keys from team quiz while active', () => {
    const view = redactEnergizerForViewer(TEAM_QUIZ, { role: 'voter', voterId: 'v1' })
    expect(view.questions?.map((q) => q.correctIndex)).toEqual([undefined, undefined])
    // Prompts/options still present so the voter can answer.
    expect(view.questions?.[0]?.options).toEqual(['A', 'B'])
  })

  it('keeps only the viewer answer plus the top-3 podium, blanking other values', () => {
    const view = redactEnergizerForViewer(QUICK_FINGER, { role: 'voter', voterId: 'v5' })
    const ids = view.answers?.map((a) => a.voterId)
    // v4 (rank 4) is dropped; v5 kept as own answer despite rank 0.
    expect(ids).toEqual(['v1', 'v2', 'v3', 'v5'])
    const own = view.answers?.find((a) => a.voterId === 'v5')
    expect(own?.value).toBe('A')
    for (const other of view.answers?.filter((a) => a.voterId !== 'v5') ?? []) {
      expect(other.value).toBe('')
    }
  })

  it('filters submissions, scores, and badges down to the viewer', () => {
    const view = redactEnergizerForViewer(TEAM_QUIZ, { role: 'voter', voterId: 'v2' })
    expect(view.submissions).toEqual([{ voterId: 'v2', questionIndex: 0, value: 'A', correct: false }])
    expect(view.scores).toEqual([{ voterId: 'v2', score: 0, rank: 2 }])

    const qf = redactEnergizerForViewer(QUICK_FINGER, { role: 'voter', voterId: 'v5' })
    expect(Object.keys(qf.badges ?? {})).toEqual(['v5'])
  })

  it('passes the leaderboard through untouched', () => {
    const view = redactEnergizerForViewer(QUICK_FINGER, { role: 'voter', voterId: 'v9' })
    expect(view.leaderboard).toEqual(QUICK_FINGER.leaderboard)
  })
})
