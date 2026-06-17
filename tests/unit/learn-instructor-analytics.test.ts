import { describe, expect, it } from 'vitest'
import {
  buildScoreDistribution,
  buildSummary,
  buildDifficulty,
  buildInstructorAnalytics,
  buildInstructorResultsCsv,
  SCORE_BUCKETS,
} from '../../functions/api/lib/learn-instructor-analytics'
import type { ParticipantFinalScore, QuestionResponse } from '../../functions/api/lib/learn-scoring'

const score = (participantId: string, percent: number): ParticipantFinalScore => ({
  participantId,
  fraction: percent / 100,
  percent,
})

describe('FE-LEARN-INSTRUCTOR-01 — score distribution', () => {
  it('buckets scores into deciles, with 100 in the top band', () => {
    const dist = buildScoreDistribution([score('a', 5), score('b', 55), score('c', 100)])
    expect(dist).toHaveLength(SCORE_BUCKETS.length)
    expect(dist[0].count).toBe(1) // 0–10
    expect(dist[5].count).toBe(1) // 50–60
    expect(dist[9].count).toBe(1) // 90–100 includes 100
  })

  it('is all-zero for an empty cohort', () => {
    const dist = buildScoreDistribution([])
    expect(dist.every((b) => b.count === 0)).toBe(true)
  })
})

describe('FE-LEARN-INSTRUCTOR-01 — summary stats', () => {
  it('computes average, median, and pass rate', () => {
    const s = buildSummary([score('a', 40), score('b', 60), score('c', 80)], 60)
    expect(s.participants).toBe(3)
    expect(s.averagePercent).toBe(60)
    expect(s.medianPercent).toBe(60)
    expect(s.passRate).toBe(0.67) // 2 of 3 ≥ 60
  })

  it('medians an even-sized cohort', () => {
    const s = buildSummary([score('a', 20), score('b', 40), score('c', 60), score('d', 80)])
    expect(s.medianPercent).toBe(50)
  })

  it('returns zeros for an empty cohort', () => {
    const s = buildSummary([])
    expect(s).toMatchObject({ participants: 0, averagePercent: 0, medianPercent: 0, passRate: 0 })
  })
})

describe('FE-LEARN-INSTRUCTOR-01 — question difficulty', () => {
  const cohort: Array<{ responses: QuestionResponse[] }> = [
    { responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }, { questionId: 'q2', correct: 0, incorrect: 1, required: 1 }] },
    { responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }, { questionId: 'q2', correct: 0, incorrect: 0, required: 1 }] },
  ]

  it('computes correctRate and difficulty (1 − facility)', () => {
    const diff = buildDifficulty(cohort)
    const q1 = diff.find((d) => d.questionId === 'q1')!
    const q2 = diff.find((d) => d.questionId === 'q2')!
    expect(q1.correctRate).toBe(1)
    expect(q1.difficulty).toBe(0)
    expect(q2.correctRate).toBe(0)
    expect(q2.difficulty).toBe(1)
    expect(q1.responses).toBe(2)
  })

  it('only counts fully-correct (no incorrect picks) as correct', () => {
    const diff = buildDifficulty([
      { responses: [{ questionId: 'q', correct: 2, incorrect: 1, required: 2 }] },
    ])
    expect(diff[0].correctRate).toBe(0)
  })
})

describe('FE-LEARN-INSTRUCTOR-01 — full analytics', () => {
  it('identifies hardest and easiest questions', () => {
    const cohort: Array<{ responses: QuestionResponse[] }> = [
      { responses: [{ questionId: 'easy', correct: 1, incorrect: 0, required: 1 }, { questionId: 'hard', correct: 0, incorrect: 1, required: 1 }] },
    ]
    const a = buildInstructorAnalytics([score('a', 50)], cohort)
    expect(a.hardestQuestionId).toBe('hard')
    expect(a.easiestQuestionId).toBe('easy')
  })

  it('reports null hardest/easiest when there are no questions', () => {
    const a = buildInstructorAnalytics([], [])
    expect(a.hardestQuestionId).toBeNull()
    expect(a.easiestQuestionId).toBeNull()
  })
})

describe('FE-LEARN-INSTRUCTOR-01 — CSV export', () => {
  it('emits a header + one row per participant, ids only (no PII)', () => {
    const csv = buildInstructorResultsCsv([score('p1', 90), score('p2', 40)])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"participant_id","final_percent","raw_fraction"')
    expect(lines[1]).toContain('p1')
    expect(lines).toHaveLength(3)
  })

  it('guards against CSV formula injection in participant ids', () => {
    const csv = buildInstructorResultsCsv([score('=cmd()', 10)])
    expect(csv).toContain('"\'=cmd()"')
  })
})
