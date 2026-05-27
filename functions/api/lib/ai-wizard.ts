// Wizard AI (WIZ-AI-01/02): prompt construction, AI invocation, and output
// normalisation for session-question generation.
//
// The Workers AI model is asked to emit a JSON object with exactly
// one key, `questions`, whose value is an array of 3-4 question objects. The
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

Always respond with STRICT JSON and nothing else - no prose, no markdown.
The JSON must be an object with exactly one key "questions", whose value is an
array of 3 to 4 question objects. Each question object has:

  kind    : one of "poll" | "ranking" | "consent" | "open"
  prompt  : a concise question (max 240 chars)
  options : an array of 2 to 5 option objects { "label": string }

Rules:
- Generate 3 questions for narrow topics and 4 for broad topics.
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

function buildUserPrompt(input: GenerateInput, batchFocus?: string): string {
  const focus = input.focusArea ? `\nFocus area: ${input.focusArea}` : ''
  const batch = batchFocus ? `\nBatch focus: ${batchFocus}` : ''
  return `Session title: ${input.sessionTitle}
Session goal: ${input.sessionGoal}${focus}${batch}

Generate between 3 and 4 questions that help the facilitator surface group
alignment, priorities, and concerns. Prefer concise, immediately usable output.
Respond with JSON only.`
}

// Extract the first JSON object from a possibly-noisy AI response. Llama
// occasionally wraps its answer in ```json fences or includes leading prose;
// we strip both rather than fail outright.
function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenceMatch ? fenceMatch[1] : raw).trim()
  const firstObject = body.indexOf('{')
  const firstArray = body.indexOf('[')
  const startsWithArray = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)
  const first = startsWithArray ? firstArray : firstObject
  const last = startsWithArray ? body.lastIndexOf(']') : body.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new WizardValidationError('AI response did not contain a JSON object or array')
  }
  return body.slice(first, last + 1)
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

const OPTION_REQUIRED_KINDS = new Set(['poll', 'ranking', 'consent', 'multi_select', 'upvote'])
const VALID_KINDS = new Set([
  'poll',
  'ranking',
  'consent',
  'open',
  'multi_select',
  'likert',
  'upvote',
  'word_cloud',
  'slider',
])

function fallbackOptions(kind: string): Array<{ label: string }> {
  if (kind === 'consent') return [{ label: 'Agree' }, { label: 'Disagree' }]
  return [{ label: 'High priority' }, { label: 'Medium priority' }, { label: 'Low priority' }]
}

type RepairedOption = { id?: string; label: string }

function repairAIOutput(value: unknown): unknown {
  const source = Array.isArray(value)
    ? { questions: value }
    : value && typeof value === 'object'
      ? value as Record<string, unknown>
      : null
  if (!source || !Array.isArray(source.questions)) return value

  return {
    questions: source.questions.map((item) => {
      if (!item || typeof item !== 'object') return item
      const q = item as Record<string, unknown>
      const rawKind = typeof q.kind === 'string' ? q.kind : typeof q.type === 'string' ? q.type : 'poll'
      const kind = VALID_KINDS.has(rawKind) ? rawKind : 'poll'
      const rawPrompt =
        typeof q.prompt === 'string'
          ? q.prompt
          : typeof q.question === 'string'
            ? q.question
            : typeof q.text === 'string'
              ? q.text
              : ''
      const rawOptions = Array.isArray(q.options) ? q.options : []
      const options: RepairedOption[] = rawOptions
        .map((option) => {
          if (typeof option === 'string') return { label: option }
          if (option && typeof option === 'object') {
            const o = option as Record<string, unknown>
            return typeof o.label === 'string'
              ? { id: typeof o.id === 'string' ? o.id : undefined, label: o.label }
              : null
          }
          return null
        })
        .filter((option): option is RepairedOption => Boolean(option))

      return {
        ...q,
        kind,
        prompt: rawPrompt,
        options:
          OPTION_REQUIRED_KINDS.has(kind) && options.length < 2
            ? fallbackOptions(kind)
            : options,
      }
    }),
  }
}

// Heuristic confidence: starts at 1.0, deducted for signals that the model
// output was borderline (e.g. needed fence stripping, had minimum counts).
function scoreConfidence(raw: string, cleaned: string, count: number): number {
  let score = 1.0
  if (raw !== cleaned) score -= 0.1 // needed trimming
  if (count <= 4) score -= 0.1 // hit the lower bound
  if (raw.length > 4000) score -= 0.1 // unusually long response
  return Math.max(0, Math.min(1, Number(score.toFixed(2))))
}

const MAX_TOKENS = 700
const TARGET_QUESTION_COUNT = 8
// Delays between retry attempts in milliseconds (exponential backoff).
const RETRY_DELAYS_MS = [150, 300]
const FAST_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'
const QUALITY_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const PARALLEL_BATCH_FOCI = [
  'alignment, priorities, and decisions',
  'risks, concerns, trade-offs, and next steps',
]

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

async function invokeWithSecondaryModel(
  ai: Ai,
  model: string,
  messages: Array<{ role: string; content: string }>,
  approxInputChars: number,
): Promise<string> {
  try {
    return await invokeAI(ai, model, messages, approxInputChars)
  } catch (primaryErr) {
    if (model !== QUALITY_FALLBACK_MODEL) {
      console.log(JSON.stringify({ event: 'ai.wizard.secondary_model', primaryModel: model, secondaryModel: QUALITY_FALLBACK_MODEL }))
      return await invokeAI(ai, QUALITY_FALLBACK_MODEL, messages, approxInputChars)
    }
    throw primaryErr
  }
}

function parseAIQuestions(raw: string): GenerateResult {
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

  const result = AIQuestionsOutputSchema.safeParse(repairAIOutput(parsedObj))
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

function mergeQuestionBatches(batches: GenerateResult[]): GenerateResult {
  const seen = new Set<string>()
  const questions: GeneratedQuestion[] = []

  for (const batch of batches) {
    for (const question of batch.questions) {
      const key = question.prompt.trim().toLowerCase().replace(/\s+/g, ' ')
      if (!key || seen.has(key)) continue
      seen.add(key)
      questions.push(question)
      if (questions.length >= TARGET_QUESTION_COUNT) break
    }
    if (questions.length >= TARGET_QUESTION_COUNT) break
  }

  const confidence = batches.length === 0
    ? 0
    : Number((batches.reduce((sum, batch) => sum + batch.confidence, 0) / batches.length).toFixed(2))
  return { questions, confidence }
}

function buildMessages(
  input: GenerateInput,
  batchFocus?: string,
): { messages: Array<{ role: 'system' | 'user'; content: string }>; approxInputChars: number } {
  const systemPrompt = buildSystemPrompt(input.language)
  const userPrompt = buildUserPrompt(input, batchFocus)
  return {
    approxInputChars: systemPrompt.length + userPrompt.length,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
}

export async function generateQuestions(
  ai: Ai,
  input: GenerateInput,
  model = FAST_MODEL,
): Promise<GenerateResult> {
  if (model !== FAST_MODEL) {
    const { messages, approxInputChars } = buildMessages(input)
    const raw = await invokeWithSecondaryModel(ai, model, messages, approxInputChars)
    return parseAIQuestions(raw)
  }

  const settled = await Promise.allSettled(
    PARALLEL_BATCH_FOCI.map(async (batchFocus) => {
      const { messages, approxInputChars } = buildMessages(input, batchFocus)
      const raw = await invokeWithSecondaryModel(ai, model, messages, approxInputChars)
      return parseAIQuestions(raw)
    }),
  )

  const fulfilled = settled
    .filter((result): result is PromiseFulfilledResult<GenerateResult> => result.status === 'fulfilled')
    .map((result) => result.value)
  if (fulfilled.length > 0) return mergeQuestionBatches(fulfilled)

  const firstError = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason
  throw firstError instanceof Error ? firstError : new WizardAIError('AI generation failed')
}

// Exported for unit tests.
export const __internal = {
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  scoreConfidence,
  FAST_MODEL,
  QUALITY_FALLBACK_MODEL,
  TARGET_QUESTION_COUNT,
}
// Re-export for handler to catch validation errors cleanly.
export { z }
