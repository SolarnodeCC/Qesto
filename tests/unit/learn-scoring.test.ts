import { describe, expect, it } from 'vitest'
import {
  scoreQuestion,
  scoreParticipant,
  applyCurve,
  scoreCohort,
  type QuestionScoringConfig,
} from '../../functions/api/lib/learn-scoring'

describe('LEARN-SCORING-01 — scoreQuestion', () => {
  const aon: QuestionScoringConfig = { questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' }
  const prop: QuestionScoringConfig = { questionId: 'q1', weight: 1, partialCredit: 'proportional' }

  it('all-or-nothing gives full credit only when fully correct', () => {
    expect(scoreQuestion(aon, { questionId: 'q1', correct: 2, incorrect: 0, required: 2 })).toBe(1)
    expect(scoreQuestion(aon, { questionId: 'q1', correct: 1, incorrect: 0, required: 2 })).toBe(0)
    expect(scoreQuestion(aon, { questionId: 'q1', correct: 2, incorrect: 1, required: 2 })).toBe(0)
  })

  it('proportional rewards correct and penalises incorrect picks', () => {
    expect(scoreQuestion(prop, { questionId: 'q1', correct: 2, incorrect: 0, required: 2 })).toBe(1)
    expect(scoreQuestion(prop, { questionId: 'q1', correct: 1, incorrect: 0, required: 2 })).toBe(0.5)
    expect(scoreQuestion(prop, { questionId: 'q1', correct: 2, incorrect: 1, required: 2 })).toBe(0.5)
  })

  it('select-everything cannot beat the penalty floor', () => {
    expect(scoreQuestion(prop, { questionId: 'q1', correct: 2, incorrect: 5, required: 2 })).toBe(0)
  })

  it('required=0 scores 0 (no obtainable credit)', () => {
    expect(scoreQuestion(prop, { questionId: 'q1', correct: 1, incorrect: 0, required: 0 })).toBe(0)
  })
})

describe('LEARN-SCORING-01 — scoreParticipant', () => {
  const configs: QuestionScoringConfig[] = [
    { questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' },
    { questionId: 'q2', weight: 3, partialCredit: 'all_or_nothing' },
  ]

  it('normalises by total weight', () => {
    const frac = scoreParticipant(configs, [
      { questionId: 'q1', correct: 1, incorrect: 0, required: 1 },
      { questionId: 'q2', correct: 0, incorrect: 0, required: 1 },
    ])
    expect(frac).toBeCloseTo(0.25, 5) // q1 weight 1 of 4
  })

  it('missing responses score 0', () => {
    const frac = scoreParticipant(configs, [
      { questionId: 'q2', correct: 1, incorrect: 0, required: 1 },
    ])
    expect(frac).toBeCloseTo(0.75, 5)
  })

  it('zero total weight returns 0', () => {
    expect(scoreParticipant([{ questionId: 'q1', weight: 0, partialCredit: 'proportional' }], [])).toBe(0)
  })
})

describe('LEARN-SCORING-01 — applyCurve', () => {
  const raw = [
    { participantId: 'a', fraction: 0.5 },
    { participantId: 'b', fraction: 0.8 },
  ]

  it('none → raw percent', () => {
    const out = applyCurve(raw, { kind: 'none' })
    expect(out.map((r) => r.percent)).toEqual([50, 80])
  })

  it('linear adds bonus capped at 100', () => {
    const out = applyCurve([{ participantId: 'a', fraction: 0.95 }], { kind: 'linear', points: 10 })
    expect(out[0].percent).toBe(100)
  })

  it('bell scales top score to target', () => {
    const out = applyCurve(raw, { kind: 'bell', targetTop: 100 })
    expect(out[1].percent).toBe(100) // top (0.8) → 100
    expect(out[0].percent).toBeCloseTo(62.5, 1) // 0.5 scaled by 100/80
  })

  it('bell with no positive top leaves scores untouched', () => {
    const out = applyCurve([{ participantId: 'a', fraction: 0 }], { kind: 'bell', targetTop: 100 })
    expect(out[0].percent).toBe(0)
  })
})

describe('LEARN-SCORING-01 — scoreCohort', () => {
  it('scores end to end with a curve', () => {
    const configs: QuestionScoringConfig[] = [{ questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' }]
    const out = scoreCohort(
      configs,
      [
        { participantId: 'a', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
        { participantId: 'b', responses: [{ questionId: 'q1', correct: 0, incorrect: 0, required: 1 }] },
      ],
      { kind: 'none' },
    )
    expect(out).toEqual([
      { participantId: 'a', fraction: 1, percent: 100 },
      { participantId: 'b', fraction: 0, percent: 0 },
    ])
  })
})
