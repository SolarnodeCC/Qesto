/**
 * FE-LEARN-INSTRUCTOR-01 (ADR-0058) — instructor assessment analytics.
 *
 * The data contract behind the instructor view: from the scored cohort
 * (LEARN-SCORING-01 outputs) and the raw per-question responses, derive a score
 * distribution, summary stats, and per-question difficulty — plus a formula-safe
 * CSV of per-participant results for reporting.
 *
 * Pure + side-effect free (the one calculation shared by the API, the close
 * handler, and any preview). No PII: it operates on participant ids and answer
 * correctness, never on names.
 */

import type { ParticipantFinalScore, QuestionResponse } from './learn-scoring'
import { csvRow } from './csv'

/** Fixed 0–100 histogram buckets (decile bands) for the score distribution chart. */
export const SCORE_BUCKETS: ReadonlyArray<{ min: number; max: number; label: string }> = [
  { min: 0, max: 10, label: '0–10' },
  { min: 10, max: 20, label: '10–20' },
  { min: 20, max: 30, label: '20–30' },
  { min: 30, max: 40, label: '30–40' },
  { min: 40, max: 50, label: '40–50' },
  { min: 50, max: 60, label: '50–60' },
  { min: 60, max: 70, label: '60–70' },
  { min: 70, max: 80, label: '70–80' },
  { min: 80, max: 90, label: '80–90' },
  { min: 90, max: 100, label: '90–100' },
]

export type ScoreDistributionBucket = { label: string; count: number }

export type InstructorSummary = {
  participants: number
  /** Mean final percent (0–100, 2dp). */
  averagePercent: number
  /** Median final percent (0–100, 2dp). */
  medianPercent: number
  /** Fraction (0–1, 2dp) of participants at or above the pass threshold. */
  passRate: number
  /** The pass threshold used (percent). */
  passThreshold: number
}

export type QuestionDifficulty = {
  questionId: string
  /** Fraction of responders who answered fully correct (0–1, 2dp). The "facility". */
  correctRate: number
  /**
   * Difficulty index = 1 − correctRate (0–1, 2dp). Higher = harder. The
   * complement of facility, the convention instructors expect.
   */
  difficulty: number
  /** How many participants responded to this question (the denominator). */
  responses: number
}

export type InstructorAnalytics = {
  summary: InstructorSummary
  distribution: ScoreDistributionBucket[]
  difficulty: QuestionDifficulty[]
  /** Hardest question id (highest difficulty), or null when no questions. */
  hardestQuestionId: string | null
  /** Easiest question id (lowest difficulty), or null when no questions. */
  easiestQuestionId: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Bucket a single percent into a SCORE_BUCKETS index. 100 lands in the top band. */
function bucketIndex(percent: number): number {
  if (percent >= 100) return SCORE_BUCKETS.length - 1
  if (percent <= 0) return 0
  return Math.min(SCORE_BUCKETS.length - 1, Math.floor(percent / 10))
}

export function buildScoreDistribution(scores: ReadonlyArray<ParticipantFinalScore>): ScoreDistributionBucket[] {
  const counts = new Array(SCORE_BUCKETS.length).fill(0)
  for (const s of scores) counts[bucketIndex(s.percent)]++
  return SCORE_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] }))
}

export function buildSummary(
  scores: ReadonlyArray<ParticipantFinalScore>,
  passThreshold = 60,
): InstructorSummary {
  const n = scores.length
  if (n === 0) {
    return { participants: 0, averagePercent: 0, medianPercent: 0, passRate: 0, passThreshold }
  }
  const percents = scores.map((s) => s.percent).sort((a, b) => a - b)
  const sum = percents.reduce((acc, p) => acc + p, 0)
  const mid = Math.floor(n / 2)
  const median = n % 2 === 0 ? (percents[mid - 1] + percents[mid]) / 2 : percents[mid]
  const passed = percents.filter((p) => p >= passThreshold).length
  return {
    participants: n,
    averagePercent: round2(sum / n),
    medianPercent: round2(median),
    passRate: round2(passed / n),
    passThreshold,
  }
}

/**
 * Per-question difficulty from the cohort's raw responses. A response counts as
 * "correct" when the participant got every required option and no incorrect ones
 * (the all-or-nothing facility convention). Questions with no responses report
 * correctRate 0 / difficulty 1.
 */
export function buildDifficulty(
  cohort: ReadonlyArray<{ responses: ReadonlyArray<QuestionResponse> }>,
): QuestionDifficulty[] {
  const tally = new Map<string, { correct: number; total: number }>()
  for (const participant of cohort) {
    for (const r of participant.responses) {
      const entry = tally.get(r.questionId) ?? { correct: 0, total: 0 }
      entry.total++
      const required = Math.max(0, Math.trunc(r.required))
      if (required > 0 && r.correct >= required && r.incorrect === 0) entry.correct++
      tally.set(r.questionId, entry)
    }
  }
  return [...tally.entries()]
    .map(([questionId, { correct, total }]) => {
      const correctRate = total > 0 ? round2(correct / total) : 0
      return { questionId, correctRate, difficulty: round2(1 - correctRate), responses: total }
    })
    .sort((a, b) => (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0))
}

/** Full instructor analytics from final scores + the cohort's raw responses. */
export function buildInstructorAnalytics(
  scores: ReadonlyArray<ParticipantFinalScore>,
  cohort: ReadonlyArray<{ responses: ReadonlyArray<QuestionResponse> }>,
  passThreshold = 60,
): InstructorAnalytics {
  const difficulty = buildDifficulty(cohort)
  let hardest: QuestionDifficulty | null = null
  let easiest: QuestionDifficulty | null = null
  for (const q of difficulty) {
    if (!hardest || q.difficulty > hardest.difficulty) hardest = q
    if (!easiest || q.difficulty < easiest.difficulty) easiest = q
  }
  return {
    summary: buildSummary(scores, passThreshold),
    distribution: buildScoreDistribution(scores),
    difficulty,
    hardestQuestionId: hardest?.questionId ?? null,
    easiestQuestionId: easiest?.questionId ?? null,
  }
}

/**
 * Formula-injection-safe CSV of per-participant results for instructor reporting
 * (FE-LEARN-INSTRUCTOR-01). Columns: participant_id, final_percent, raw_fraction.
 * Participant id only — never a name (no PII in the export).
 */
export function buildInstructorResultsCsv(scores: ReadonlyArray<ParticipantFinalScore>): string {
  const lines = [csvRow(['participant_id', 'final_percent', 'raw_fraction'])]
  for (const s of scores) {
    lines.push(csvRow([s.participantId, s.percent, round2(s.fraction)]))
  }
  return lines.join('\r\n')
}
