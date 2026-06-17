/**
 * LEARN-SCORING-01 (ADR-0058) — assessment scoring engine.
 *
 * Pure scoring math for LEARN assessment sessions: per-question weights,
 * partial credit, and optional curve adjustment. Kept side-effect free so the
 * same calculation runs in the close handler, the instructor preview, and the
 * grade-passback path (LEARN-GRADE-01) without divergence — and is fully unit
 * tested. No PII: the engine operates on per-participant answer correctness,
 * never on names.
 */

/** How a single question is scored. */
export type QuestionScoringConfig = {
  questionId: string
  /** Relative weight (≥0). Weights are normalised across the assessment. */
  weight: number
  /**
   * Partial-credit policy:
   * - 'all_or_nothing': full weight only if fully correct, else 0.
   * - 'proportional': weight × (correctSelections / requiredSelections), with
   *   wrong selections penalised so a "select everything" answer can't score.
   */
  partialCredit: 'all_or_nothing' | 'proportional'
}

/** A participant's response to one scored question. */
export type QuestionResponse = {
  questionId: string
  /** Count of correct options the participant selected. */
  correct: number
  /** Count of incorrect options the participant selected. */
  incorrect: number
  /** Total correct options that existed for the question (the max obtainable). */
  required: number
}

export type CurveConfig =
  | { kind: 'none' }
  /** Linear bonus: every score += `points` percentage points, capped at 100. */
  | { kind: 'linear'; points: number }
  /** Scale so the top raw score in the cohort maps to `targetTop` (e.g. 100). */
  | { kind: 'bell'; targetTop: number }

export type ParticipantRawScore = {
  participantId: string
  /** 0..1 weighted fraction of the assessment obtained (pre-curve). */
  fraction: number
}

export type ParticipantFinalScore = ParticipantRawScore & {
  /** 0..100 percentage after curve, rounded to 2 decimals. */
  percent: number
}

/** Clamp helper — scores never escape [0,1]. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/** Score one question to a 0..1 fraction-of-its-own-weight (before weighting). */
export function scoreQuestion(config: QuestionScoringConfig, response: QuestionResponse): number {
  const required = Math.max(0, Math.trunc(response.required))
  if (required === 0) return 0
  const correct = Math.max(0, Math.trunc(response.correct))
  const incorrect = Math.max(0, Math.trunc(response.incorrect))

  const fullyCorrect = correct >= required && incorrect === 0
  if (config.partialCredit === 'all_or_nothing') {
    return fullyCorrect ? 1 : 0
  }
  // Proportional: reward correct picks, penalise wrong picks, floor at 0.
  return clamp01((correct - incorrect) / required)
}

/**
 * Weighted raw score for one participant across the assessment.
 * Weights are normalised by their sum, so absolute weight values are arbitrary.
 * Questions present in the config but missing from the responses score 0.
 */
export function scoreParticipant(
  configs: QuestionScoringConfig[],
  responses: QuestionResponse[],
): number {
  const totalWeight = configs.reduce((acc, q) => acc + Math.max(0, q.weight), 0)
  if (totalWeight <= 0) return 0

  const byId = new Map(responses.map((r) => [r.questionId, r]))
  let obtained = 0
  for (const config of configs) {
    const weight = Math.max(0, config.weight)
    if (weight === 0) continue
    const response = byId.get(config.questionId)
    const fraction = response ? scoreQuestion(config, response) : 0
    obtained += weight * fraction
  }
  return clamp01(obtained / totalWeight)
}

/** Apply a curve to a cohort of raw scores, returning final percentages. */
export function applyCurve(
  raw: ParticipantRawScore[],
  curve: CurveConfig,
): ParticipantFinalScore[] {
  const round2 = (n: number) => Math.round(n * 100) / 100

  if (curve.kind === 'linear') {
    const bonus = curve.points / 100
    return raw.map((r) => ({
      ...r,
      percent: round2(clamp01(r.fraction + bonus) * 100),
    }))
  }

  if (curve.kind === 'bell') {
    const top = raw.reduce((max, r) => Math.max(max, r.fraction), 0)
    // No positive top score → nothing to scale against; leave raw untouched.
    const scale = top > 0 ? curve.targetTop / (top * 100) : 1
    return raw.map((r) => ({
      ...r,
      percent: round2(Math.min(100, r.fraction * 100 * scale)),
    }))
  }

  return raw.map((r) => ({ ...r, percent: round2(r.fraction * 100) }))
}

/** Score a whole cohort end-to-end (per-participant raw → curve → final). */
export function scoreCohort(
  configs: QuestionScoringConfig[],
  cohort: Array<{ participantId: string; responses: QuestionResponse[] }>,
  curve: CurveConfig = { kind: 'none' },
): ParticipantFinalScore[] {
  const raw: ParticipantRawScore[] = cohort.map((p) => ({
    participantId: p.participantId,
    fraction: scoreParticipant(configs, p.responses),
  }))
  return applyCurve(raw, curve)
}
