/**
 * AI-COACHING-01 — post-session facilitator coaching (Workers AI, ADR-0011 scope).
 */
import type { Env } from '../../types'
import { aiOverride, aiPipeline, type SessionAIContext } from './session-context'

const COACHING_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export type CoachingInput = {
  sessionTitle: string
  questionSummaries: string[]
  totalVotes: number
  anonymity: string
  profileStyle?: 'concise' | 'detailed' | undefined
  teamVertical?: string | undefined
  similarSessions?: string[] | undefined
  historicalInsight?: string | undefined
}

export type CoachingSuggestion = {
  headline: string
  bullets: string[]
  model: string
  confidence?: number
  followUps?: string[]
}

export type CoachingTurn = {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export async function generateFacilitatorCoaching(
  env: Env,
  ctx: SessionAIContext,
  input: CoachingInput,
  options?: { followUp?: string; history?: CoachingTurn[] },
): Promise<CoachingSuggestion | null> {
  if (input.anonymity === 'zero_knowledge') return null
  if (input.questionSummaries.length === 0) return null

  const ctxAi = aiOverride(ctx, { model: COACHING_MODEL })
  const historyBlock =
    options?.history?.length ?
      `\nPrior turns:\n${options.history.map((t) => `${t.role}: ${t.content}`).join('\n')}\n`
    : ''
  const followUpBlock = options?.followUp ? `\nFacilitator follow-up: ${options.followUp}\n` : ''
  const styleHint = input.profileStyle ? `\nCoach style preference: ${input.profileStyle}.` : ''
  const verticalHint = input.teamVertical ? `\nTeam vertical: ${input.teamVertical}. Tailor examples to this use case.` : ''
  const historyHint = input.historicalInsight ? `\nHistorical pattern: ${input.historicalInsight}\n` : ''
  const ragHint =
    input.similarSessions?.length ?
      `\nSimilar past sessions (for context only):\n${input.similarSessions.join('\n')}\n`
    : ''
  const prompt = `You are a facilitation coach. Session: "${input.sessionTitle}".
Total votes: ${input.totalVotes}. Questions:
${input.questionSummaries.map((q, i) => `${i + 1}. ${q}`).join('\n')}
${styleHint}${verticalHint}${historyHint}${ragHint}${historyBlock}${followUpBlock}
Reply as JSON only: {"headline":"...","bullets":["...","..."],"confidence":0.0-1.0,"followUps":["optional question"]} (2-4 bullets, actionable, no PII).`

  const result = await aiPipeline(ctxAi, env, async (model, _signal) => {
    return env.AI.run(model, { messages: [{ role: 'user', content: prompt }] })
  })
  if (!result.ok) return null

  const raw = result.data
  const text =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'response' in raw
        ? String((raw as { response?: string }).response ?? '')
        : JSON.stringify(raw)

  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim())
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    const headline = typeof obj.headline === 'string' ? obj.headline : null
    const bulletsRaw = Array.isArray(obj.bullets) ? obj.bullets : null
    if (!headline || !bulletsRaw) return null
    return {
      headline: headline.slice(0, 200),
      bullets: bulletsRaw.slice(0, 5).map((b) => String(b).slice(0, 300)),
      model: COACHING_MODEL,
      ...(typeof obj.confidence === 'number' ? { confidence: Math.min(1, Math.max(0, obj.confidence)) } : {}),
      ...(Array.isArray(obj.followUps)
        ? { followUps: obj.followUps.slice(0, 3).map((f) => String(f).slice(0, 200)) }
        : {}),
    }
  } catch {
    return {
      headline: 'Session reflection',
      bullets: [text.slice(0, 500)],
      model: COACHING_MODEL,
    }
  }
}
