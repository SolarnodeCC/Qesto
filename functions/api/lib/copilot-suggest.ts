/**
 * COPILOT-02 — structured facilitator-copilot suggestion engine (ADR-0046).
 *
 * Given the aggregate live-context snapshot (COPILOT-01), produce a small set of
 * typed actions the presenter can act on. One Workers-AI call; the output is
 * defensively parsed and Zod-validated into the action protocol. A deterministic
 * fallback covers AI-unavailable / unparseable responses so the panel always has
 * something useful. Aggregate-only — no per-voter data ever reaches the model.
 */
import { z } from 'zod'
import type { CopilotLiveContext } from './copilot-live-context'

export const COPILOT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export const COPILOT_ACTION_KINDS = [
  'followup_question',
  'poll_draft',
  'disengagement_alert',
  'pacing',
] as const
export type CopilotActionKind = (typeof COPILOT_ACTION_KINDS)[number]

export const CopilotActionSchema = z.object({
  kind: z.enum(COPILOT_ACTION_KINDS),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  /** For `poll_draft`: a one-line intent the presenter can feed to draft-poll (COPILOT-03). */
  intent: z.string().trim().max(280).optional(),
})
export type CopilotAction = z.infer<typeof CopilotActionSchema>

/** Max suggestions surfaced at once. */
export const MAX_SUGGESTIONS = 4

const MOOD_LABEL: Record<NonNullable<CopilotLiveContext['mood']>, string> = {
  positive: 'positive',
  neutral: 'neutral',
  concerning: 'concerning (some negativity detected)',
}

/** Build the grounded system + user prompt for the suggestion call. */
export function buildSuggestMessages(
  context: CopilotLiveContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  const system = `You are a live meeting-facilitation copilot. Read the aggregate room
state and propose 1 to ${MAX_SUGGESTIONS} concrete, emotion-safe actions for the presenter.

Respond with STRICT JSON only — no prose, no markdown. The JSON is an object with one key
"suggestions" whose value is an array of action objects. Each action has:
  kind  : one of "followup_question" | "poll_draft" | "disengagement_alert" | "pacing"
  title : a short label (max 120 chars)
  body  : one or two sentences of concrete guidance (max 600 chars)
  intent: ONLY for kind "poll_draft" — a one-line poll intent the presenter can draft

Rules:
- Ground every suggestion in the provided room state; never invent vote numbers.
- Include a "disengagement_alert" ONLY when mood is concerning or participation is low.
- Prefer one "followup_question" that builds on the current question.
- Use "pacing" to advise speeding up / slowing down based on participation.
- Be concise, neutral, and never name or attribute individuals.`

  const q = context.currentQuestion
  const user = `Room state:
- Session is ${context.isLive ? 'LIVE' : 'not live'}.
- Current question: ${q ? `"${q.prompt}" (type: ${q.kind})` : 'none active'}.
- Responses so far: ${context.responseCount}.
- Participants connected: ${context.participantCount}.
- Participation rate: ${Math.round(context.participationRate * 100)}%.
- Room mood: ${context.mood ? MOOD_LABEL[context.mood] : 'unknown (not enough responses)'}.

Propose the most helpful actions for right now.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Strip code fences and slice to the first JSON object/array (mirrors ai-wizard). */
function extractJson(raw: string): string | null {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenceMatch ? fenceMatch[1] : raw).trim()
  const firstObject = body.indexOf('{')
  const firstArray = body.indexOf('[')
  const startsWithArray = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)
  const first = startsWithArray ? firstArray : firstObject
  const last = startsWithArray ? body.lastIndexOf(']') : body.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return body.slice(first, last + 1)
}

/**
 * Parse a raw AI response into validated actions. Returns null when nothing
 * usable can be extracted (caller falls back). Invalid items are dropped; the
 * result is capped and `poll_draft` intent is normalised.
 */
export function parseSuggestions(raw: string): CopilotAction[] | null {
  const json = extractJson(raw)
  if (!json) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { suggestions?: unknown }).suggestions)
      ? (parsed as { suggestions: unknown[] }).suggestions
      : null
  if (!list) return null

  const actions: CopilotAction[] = []
  for (const item of list) {
    const result = CopilotActionSchema.safeParse(item)
    if (!result.success) continue
    const action = result.data
    // A poll_draft is only actionable with an intent; synthesise one from the title if missing.
    if (action.kind === 'poll_draft' && !action.intent) action.intent = action.title
    actions.push(action)
    if (actions.length >= MAX_SUGGESTIONS) break
  }
  return actions.length > 0 ? actions : null
}

/**
 * Deterministic suggestions for when the AI is unavailable or unparseable.
 * Derived purely from the aggregate snapshot — no inference.
 */
export function fallbackSuggestions(context: CopilotLiveContext): CopilotAction[] {
  const actions: CopilotAction[] = []

  if (context.mood === 'concerning') {
    actions.push({
      kind: 'disengagement_alert',
      title: 'Room mood looks concerning',
      body: 'Recent open responses skew negative. Consider acknowledging the feedback and asking an open follow-up to surface what is driving it.',
    })
  }

  if (context.participantCount > 0 && context.participationRate < 0.3) {
    actions.push({
      kind: 'pacing',
      title: 'Low participation so far',
      body: 'Only a small share of participants have responded. Give the room a little more time, or re-read the question before moving on.',
    })
  }

  if (context.currentQuestion) {
    actions.push({
      kind: 'followup_question',
      title: 'Ask a follow-up',
      body: `Build on "${context.currentQuestion.prompt}" with an open follow-up to deepen the discussion.`,
    })
    actions.push({
      kind: 'poll_draft',
      title: 'Draft a quick poll',
      body: 'Turn the current discussion into a quick poll to get a clear read from the room.',
      intent: `a quick poll following up on "${context.currentQuestion.prompt}"`,
    })
  }

  return actions.slice(0, MAX_SUGGESTIONS)
}
