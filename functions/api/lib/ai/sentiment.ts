/**
 * AI-SENTIMENT-01 — aggregate session mood via Workers AI (ADR-0011).
 */
import type { Env } from '../../types'
import { aiOverride, aiPipeline, SENTIMENT_MODEL, type SessionAIContext } from './session-context'

export type SessionMood = 'positive' | 'neutral' | 'concerning'

export type SentimentAnalysisResult =
  | { ok: true; mood: SessionMood; sampleSize: number; analysisDurationMs: number }
  | { ok: false; reason: 'timeout' | 'circuit_breaker' | 'insufficient_responses' | 'ai_error'; message: string; sampleSize: number }

const MIN_RESPONSES = 5
const ANALYSIS_COOLDOWN_MS = 30_000

type DistilbertLabel = { label: string; score?: number }

function isMostlyEnglish(text: string): boolean {
  if (!text.trim()) return false
  const latin = (text.match(/[a-zA-Z\s.,!?'"-]/g) ?? []).length
  return latin / text.length >= 0.85
}

function moodFromLabels(labels: DistilbertLabel[]): SessionMood {
  let pos = 0
  let neg = 0
  for (const row of labels) {
    const label = row.label?.toUpperCase() ?? ''
    if (label.includes('POSITIVE')) pos++
    else if (label.includes('NEGATIVE')) neg++
  }
  const total = labels.length || 1
  if (neg / total >= 0.55) return 'concerning'
  if (pos / total >= 0.55) return 'positive'
  return 'neutral'
}

export async function analyzeOpenResponseSentiment(
  env: Env,
  ctx: SessionAIContext,
  responses: string[],
): Promise<SentimentAnalysisResult> {
  if (ctx.anonymity === 'zero_knowledge') {
    return { ok: false, reason: 'insufficient_responses', message: 'zero_knowledge anonymity disables sentiment', sampleSize: 0 }
  }
  if (responses.length < MIN_RESPONSES) {
    return { ok: false, reason: 'insufficient_responses', message: `need ${MIN_RESPONSES} responses, got ${responses.length}`, sampleSize: responses.length }
  }

  const english = responses.filter(isMostlyEnglish)
  if (english.length < MIN_RESPONSES) {
    return { ok: false, reason: 'insufficient_responses', message: `insufficient English responses: ${english.length}/${responses.length}`, sampleSize: english.length }
  }

  const sample = english.slice(0, 40)
  const ctxSentiment = aiOverride(ctx, { model: SENTIMENT_MODEL })
  const startMs = Date.now()

  const labels: DistilbertLabel[] = []
  let hasTimeout = false
  let hasUnavailable = false

  for (const text of sample) {
    const trimmed = text.slice(0, 512)
    const result = await aiPipeline(ctxSentiment, env, async (model, _signal) => {
      return env.AI.run(model, { text: trimmed })
    })
    if (!result.ok) {
      if (result.code === 'ai_timeout') hasTimeout = true
      if (result.code === 'ai_unavailable') hasUnavailable = true
      continue
    }
    const raw = result.data
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === 'object' && 'label' in item) {
          labels.push(item as DistilbertLabel)
        }
      }
    } else if (raw && typeof raw === 'object' && 'label' in (raw as object)) {
      labels.push(raw as DistilbertLabel)
    }
  }

  const durationMs = Date.now() - startMs

  if (hasUnavailable) {
    return { ok: false, reason: 'circuit_breaker', message: 'AI service unavailable (circuit open or rate limited)', sampleSize: sample.length }
  }

  if (hasTimeout) {
    return { ok: false, reason: 'timeout', message: `timeout during AI analysis, got ${labels.length}/${sample.length} labels`, sampleSize: sample.length }
  }

  if (labels.length < MIN_RESPONSES) {
    return { ok: false, reason: 'ai_error', message: `insufficient labels collected: ${labels.length}/${MIN_RESPONSES}`, sampleSize: sample.length }
  }

  return { ok: true, mood: moodFromLabels(labels), sampleSize: sample.length, analysisDurationMs: durationMs }
}

export const SENTIMENT_MIN_RESPONSES = MIN_RESPONSES
export const SENTIMENT_COOLDOWN_MS = ANALYSIS_COOLDOWN_MS

/** @internal unit tests */
export const __test = { isMostlyEnglish, moodFromLabels }
