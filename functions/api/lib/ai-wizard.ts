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
  language?: string | undefined
}

export type GeneratedQuestion = {
  id: string
  kind: 'poll' | 'ranking' | 'consent' | 'open' | 'multi_select' | 'likert' | 'upvote' | 'word_cloud' | 'slider'
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

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
}

const SYSTEM_PROMPT_BASE = `You are a meeting facilitator assistant. Your job is to
design clear, unbiased poll and ranking questions for live team sessions.

Always respond with STRICT JSON and nothing else — no prose, no markdown.
The JSON must be an object with exactly one key "questions", whose value is an
array of exactly 5 question objects. Each question object has:

  kind    : one of "poll" | "ranking" | "consent" | "open"
  prompt  : a concise question (max 240 chars)
  options : an array of 2 to 5 option objects { "label": string }

Rules:
- Generate exactly 5 questions — no more, no fewer.
- Do not repeat the session title verbatim as a question.
- Prefer "poll" kind for 3+ choice scenarios, "ranking" when order matters,
  "consent" for agree/disagree, "open" only when free text is desired (still
  provide 2-3 suggested prompt options).
- Keep option labels short, action-oriented, and mutually exclusive where
  possible.
- Avoid leading language ("don't you agree…?").`

function buildSystemPrompt(language?: string): string {
  const lang = language && language.length >= 2 ? language.slice(0, 2).toLowerCase() : 'en'
  const langName = LANGUAGE_NAMES[lang] ?? 'English'
  return `${SYSTEM_PROMPT_BASE}
- Write ALL question prompts and option labels in ${langName}.`
}

function buildUserPrompt(input: GenerateInput): string {
  const focus = input.focusArea ? `\nFocus area: ${input.focusArea}` : ''
  return `Session title: ${input.sessionTitle}
Session goal: ${input.sessionGoal}${focus}

Generate exactly 5 questions that help the facilitator surface group alignment,
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
// Delays between retry attempts in milliseconds (exponential backoff).
const RETRY_DELAYS_MS = [200, 400, 800]
// Fallback model used when the primary fails all retries.
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'

// Invoke the AI model and return the raw text response. Retries up to
// RETRY_DELAYS_MS.length times on invocation errors or empty responses.
// stream: false is required — without it Workers AI may return a ReadableStream
// which the response handler cannot consume.
async function invokeAI(
  ai: Ai,
  model: string,
  messages: Array<{ role: string; content: string }>,
  approxInputChars: number,
): Promise<string> {
  let lastErr: Error = new WizardAIError('No attempts made')
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
    }
    const t0 = Date.now()
    try {
      const res = (await ai.run(model, {
        messages,
        max_tokens: MAX_TOKENS,
        stream: false,
      })) as { response?: string } | string
      const latencyMs = Date.now() - t0
      const raw =
        typeof res === 'string'
          ? res
          : typeof res?.response === 'string'
            ? res.response
            : ''
      if (!raw || raw.trim() === '') {
        console.log(
          JSON.stringify({ event: 'ai.wizard.empty', model, latencyMs, approxInputChars, attempt }),
        )
        lastErr = new WizardAIError('AI returned empty response')
        continue
      }
      console.log(
        JSON.stringify({
          event: 'ai.wizard.ok',
          model,
          latencyMs,
          approxInputChars,
          outputChars: raw.length,
          attempt,
        }),
      )
      return raw
    } catch (err) {
      const latencyMs = Date.now() - t0
      const msg = err instanceof Error ? err.message : String(err)
      console.log(
        JSON.stringify({ event: 'ai.wizard.error', model, latencyMs, approxInputChars, error: msg, attempt }),
      )
      lastErr = err instanceof Error ? err : new Error(msg)
    }
  }
  throw new WizardAIError(
    `AI invocation failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastErr.message}`,
  )
}

export async function generateQuestions(
  ai: Ai,
  input: GenerateInput,
  model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
): Promise<GenerateResult> {
  const systemPrompt = buildSystemPrompt(input.language)
  const userPrompt = buildUserPrompt(input)
  const approxInputChars = systemPrompt.length + userPrompt.length
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ]

  let raw: string
  try {
    raw = await invokeAI(ai, model, messages, approxInputChars)
  } catch (primaryErr) {
    if (model !== FALLBACK_MODEL) {
      console.log(
        JSON.stringify({ event: 'ai.wizard.fallback', primaryModel: model, fallbackModel: FALLBACK_MODEL }),
      )
      raw = await invokeAI(ai, FALLBACK_MODEL, messages, approxInputChars)
    } else {
      throw primaryErr
    }
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
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  scoreConfidence,
  FALLBACK_MODEL,
}
// Re-export for handler to catch validation errors cleanly.
export { z }
