// Wizard AI (WIZ-AI-01/02): prompt construction, AI invocation, and output
// normalisation for session-question generation.
//
// The Workers AI Llama-3.3 model is asked to emit a JSON object with exactly
// one key, `questions`, whose value is an array of 3–5 question objects. The
// response is parsed, validated with Zod, and normalised (e.g. synthesising
// option ids when the model omits them). A confidence score is derived from
// heuristics such as "model returned valid JSON on first try" and "all
// questions validate".

import { z } from 'zod'
import { AIQuestionsOutputSchema, type AIQuestionsOutput } from './validation'
import { ulid } from './ulid'

export type GenerateInput = {
  sessionTitle: string
  sessionGoal: string
  focusArea?: string | undefined
}

export type GeneratedQuestion = {
  id: string
  kind: 'poll' | 'ranking' | 'consent' | 'open'
  prompt: string
  options: { id: string; label: string }[]
}

export type GenerateResult = {
  questions: GeneratedQuestion[]
  confidence: number
}

export class WizardValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'WizardValidationError'
  }
}

export class WizardAIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WizardAIError'
  }
}

const SYSTEM_PROMPT = `You are a meeting facilitator assistant. Your job is to
design clear, unbiased poll and ranking questions for live team sessions.

Always respond with STRICT JSON and nothing else — no prose, no markdown.
The JSON must be an object with exactly one key "questions", whose value is an
array of between 3 and 5 question objects. Each question object has:

  kind    : one of "poll" | "ranking" | "consent" | "open"
  prompt  : a concise question (max 240 chars)
  options : an array of 3 to 5 option objects { "label": string }

Rules:
- Do not repeat the session title verbatim as a question.
- Prefer "poll" kind for 3+ choice scenarios, "ranking" when order matters,
  "consent" for agree/disagree, "open" only when free text is desired (still
  provide 3 suggested prompt options).
- Keep option labels short, action-oriented, and mutually exclusive where
  possible.
- Avoid leading language ("don't you agree…?").`

function buildUserPrompt(input: GenerateInput): string {
  const focus = input.focusArea ? `\nFocus area: ${input.focusArea}` : ''
  return `Session title: ${input.sessionTitle}
Session goal: ${input.sessionGoal}${focus}

Generate 3 to 5 questions that help the facilitator surface group alignment,
priorities, and concerns. Respond with JSON only.`
}

// Extract the first JSON object from a possibly-noisy AI response. Llama
// occasionally wraps its answer in ```json fences or includes leading prose;
// we strip both rather than fail outright.
function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenceMatch ? fenceMatch[1] : raw
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new WizardValidationError('AI response did not contain a JSON object')
  }
  return body.slice(firstBrace, lastBrace + 1)
}

function normalise(parsed: AIQuestionsOutput): GeneratedQuestion[] {
  return parsed.questions.map((q) => ({
    id: ulid(),
    kind: q.kind,
    prompt: q.prompt,
    options: q.options.map((opt) => ({
      id: opt.id && opt.id.trim() !== '' ? opt.id : ulid(),
      label: opt.label,
    })),
  }))
}

// Heuristic confidence: starts at 1.0, deducted for signals that the model
// output was borderline (e.g. needed fence stripping, had minimum counts).
function scoreConfidence(raw: string, cleaned: string, count: number): number {
  let score = 1.0
  if (raw !== cleaned) score -= 0.1 // needed trimming
  if (count === 3) score -= 0.1 // hit the lower bound
  if (raw.length > 4000) score -= 0.1 // unusually long response
  return Math.max(0, Math.min(1, Number(score.toFixed(2))))
}

const MAX_TOKENS = 1024

export async function generateQuestions(
  ai: Ai,
  input: GenerateInput,
  model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
): Promise<GenerateResult> {
  const userPrompt = buildUserPrompt(input)
  const approxInputChars = SYSTEM_PROMPT.length + userPrompt.length
  const t0 = Date.now()
  let raw: string
  try {
    const res = (await ai.run(model, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: MAX_TOKENS,
    })) as { response?: string } | string

    const latencyMs = Date.now() - t0
    raw =
      typeof res === 'string'
        ? res
        : typeof res?.response === 'string'
          ? res.response
          : ''
    if (!raw || raw.trim() === '') {
      console.log(JSON.stringify({ event: 'ai.wizard.empty', model, latencyMs, approxInputChars }))
      throw new WizardAIError('AI returned empty response')
    }
    console.log(JSON.stringify({ event: 'ai.wizard.ok', model, latencyMs, approxInputChars, outputChars: raw.length }))
  } catch (err) {
    if (err instanceof WizardAIError) throw err
    console.log(JSON.stringify({ event: 'ai.wizard.error', model, latencyMs: Date.now() - t0, approxInputChars, error: err instanceof Error ? err.message : String(err) }))
    throw new WizardAIError(
      `AI invocation failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let cleaned: string
  try {
    cleaned = extractJson(raw)
  } catch (err) {
    throw err instanceof WizardValidationError
      ? err
      : new WizardValidationError('Failed to extract JSON from AI response')
  }

  let parsedObj: unknown
  try {
    parsedObj = JSON.parse(cleaned)
  } catch (err) {
    throw new WizardValidationError(
      `AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const result = AIQuestionsOutputSchema.safeParse(parsedObj)
  if (!result.success) {
    throw new WizardValidationError(
      'AI response did not match question schema',
      result.error.flatten(),
    )
  }

  const questions = normalise(result.data)
  const confidence = scoreConfidence(raw, cleaned, questions.length)
  return { questions, confidence }
}

// Exported for unit tests.
export const __internal = {
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  scoreConfidence,
}
// Re-export for handler to catch validation errors cleanly.
export { z }
