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
}

export type CoachingSuggestion = {
  headline: string
  bullets: string[]
  model: string
}

export async function generateFacilitatorCoaching(
  env: Env,
  ctx: SessionAIContext,
  input: CoachingInput,
): Promise<CoachingSuggestion | null> {
  if (input.anonymity === 'zero_knowledge') return null
  if (input.questionSummaries.length === 0) return null

  const ctxAi = aiOverride(ctx, { model: COACHING_MODEL })
  const prompt = `You are a facilitation coach. Session: "${input.sessionTitle}".
Total votes: ${input.totalVotes}. Questions:
${input.questionSummaries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Reply as JSON only: {"headline":"...","bullets":["...","..."]} (2-4 bullets, actionable, no PII).`

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
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim()) as {
      headline?: string
      bullets?: string[]
    }
    if (!parsed.headline || !Array.isArray(parsed.bullets)) return null
    return {
      headline: parsed.headline.slice(0, 200),
      bullets: parsed.bullets.slice(0, 5).map((b) => String(b).slice(0, 300)),
      model: COACHING_MODEL,
    }
  } catch {
    return {
      headline: 'Session reflection',
      bullets: [text.slice(0, 500)],
      model: COACHING_MODEL,
    }
  }
}
