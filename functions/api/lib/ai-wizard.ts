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
import type { Env } from '../types'
import { runAI, envWithAI } from './ai/ai-gateway'
import { AIQuestionsOutputSchema, type AIQuestionsOutput } from './domain-schemas'
import { ulid } from './ulid'
import { logEvent } from './log'

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
  ai: Env['AI'],
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
      const res = (await runAI(envWithAI(ai), model, {
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
        logEvent({ event: 'ai.wizard.empty', model, latencyMs, approxInputChars, attempt })
        lastErr = new WizardAIError('AI returned empty response')
        continue
      }
      logEvent({
          event: 'ai.wizard.ok',
          model,
          latencyMs,
          approxInputChars,
          outputChars: raw.length,
          attempt,
        })
      return raw
    } catch (err) {
      const latencyMs = Date.now() - t0
      const msg = err instanceof Error ? err.message : String(err)
      logEvent({ event: 'ai.wizard.error', model, latencyMs, approxInputChars, error: msg, attempt })
      lastErr = err instanceof Error ? err : new Error(msg)
    }
  }
  throw new WizardAIError(
    `AI invocation failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastErr.message}`,
  )
}

async function invokeWithSecondaryModel(
  ai: Env['AI'],
  model: string,
  messages: Array<{ role: string; content: string }>,
  approxInputChars: number,
): Promise<string> {
  try {
    return await invokeAI(ai, model, messages, approxInputChars)
  } catch (primaryErr) {
    if (model !== QUALITY_FALLBACK_MODEL) {
      logEvent({ event: 'ai.wizard.secondary_model', primaryModel: model, secondaryModel: QUALITY_FALLBACK_MODEL })
      return await invokeAI(ai, QUALITY_FALLBACK_MODEL, messages, approxInputChars)
    }
    throw primaryErr
  }
}

// ── Streaming generation (WIZ-AI-01 token streaming) ───────────────────────────
// Workers AI returns a ReadableStream of SSE bytes when called with
// stream: true. Each frame is `data: {"response":"<delta>"}` and the stream
// terminates with `data: [DONE]`. We accumulate the deltas into a growing raw
// string and call onDelta after each chunk so the caller can incrementally
// parse complete question objects out of the partial JSON.
async function invokeAIStream(
  ai: Env['AI'],
  model: string,
  messages: Array<{ role: string; content: string }>,
  approxInputChars: number,
  onDelta: (rawSoFar: string) => void | Promise<void>,
): Promise<string> {
  const t0 = Date.now()
  const res = (await ai.run(model, {
    messages,
    max_tokens: MAX_TOKENS,
    stream: true,
  })) as unknown as ReadableStream<Uint8Array> | { response?: string } | string

  // Defensive fallback: some environments/mocks ignore stream:true and return a
  // plain envelope. Treat it as a single, already-complete delta.
  if (!(res instanceof ReadableStream)) {
    const raw =
      typeof res === 'string' ? res : typeof res?.response === 'string' ? res.response : ''
    if (raw) await onDelta(raw)
    logEvent({
      event: 'ai.wizard.stream_nonstream',
      model,
      latencyMs: Date.now() - t0,
      approxInputChars,
      outputChars: raw.length,
    })
    return raw
  }

  const reader = res.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let raw = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    sseBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let boundary = sseBuffer.indexOf('\n\n')
    while (boundary !== -1) {
      const frame = sseBuffer.slice(0, boundary)
      sseBuffer = sseBuffer.slice(boundary + 2)
      boundary = sseBuffer.indexOf('\n\n')
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload === '[DONE]') continue
      try {
        // Validate the SSE frame at the boundary (HLT-031, #686) instead of a
        // bare `JSON.parse(...) as {...}` cast.
        const parsed = z.object({ response: z.string() }).safeParse(JSON.parse(payload))
        if (parsed.success && parsed.data.response.length > 0) {
          raw += parsed.data.response
          await onDelta(raw)
        }
      } catch {
        // Ignore malformed frames; the model occasionally emits keep-alive noise.
      }
    }
  }

  logEvent({
    event: 'ai.wizard.stream_ok',
    model,
    latencyMs: Date.now() - t0,
    approxInputChars,
    outputChars: raw.length,
  })
  return raw
}

// Validate and normalise a single question object pulled mid-stream. Reuses the
// full repair/Zod/normalise pipeline by wrapping the object as a one-item batch,
// so a streamed question is held to exactly the same bar as a buffered one.
// Returns null when the object is incomplete or fails validation.
function validateSingleQuestion(obj: unknown): GeneratedQuestion | null {
  const result = AIQuestionsOutputSchema.safeParse(repairAIOutput({ questions: [obj] }))
  if (!result.success || result.data.questions.length === 0) return null
  const normalised = normalise(result.data)
  return normalised[0] ?? null
}

// Scan accumulated raw AI text for question objects that have fully closed since
// `cursor`. Locates the `questions` array, then walks characters tracking string
// state and brace depth so that braces inside string literals don't corrupt the
// count. Returns each balanced top-level object string plus the advanced cursor.
// Pure and synchronous — exported via __internal for unit tests.
function extractCompleteQuestionObjects(
  raw: string,
  cursor: number,
): { objects: string[]; cursor: number } {
  // Find the start of the questions array only once we are past it.
  let scanStart = cursor
  if (cursor === 0) {
    const keyIdx = raw.search(/"questions"\s*:\s*\[/)
    if (keyIdx === -1) return { objects: [], cursor: 0 }
    scanStart = raw.indexOf('[', keyIdx) + 1
  }

  const objects: string[] = []
  let i = scanStart
  let nextCursor = scanStart
  while (i < raw.length) {
    // Skip until the next object opens.
    if (raw[i] !== '{') {
      i++
      continue
    }
    const objStart = i
    let depth = 0
    let inString = false
    let escaped = false
    let closed = false
    for (; i < raw.length; i++) {
      const ch = raw[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        if (inString) escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          objects.push(raw.slice(objStart, i + 1))
          i++
          nextCursor = i
          closed = true
          break
        }
      }
    }
    if (!closed) break // object still streaming — stop and resume later
  }
  return { objects, cursor: nextCursor }
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
  ai: Env['AI'],
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
    })
  )

  const fulfilled = settled
    .filter((result): result is PromiseFulfilledResult<GenerateResult> => result.status === 'fulfilled')
    .map((result) => result.value)
  if (fulfilled.length > 0) return mergeQuestionBatches(fulfilled)

  const firstError = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason
  throw firstError instanceof Error ? firstError : new WizardAIError('AI generation failed')
}

function dedupKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Streaming counterpart of generateQuestions: runs the same parallel batches but
// with token streaming, invoking `onQuestion` the moment each question finishes
// generating. A shared dedup set spans both batches and the TARGET_QUESTION_COUNT
// cap is enforced across them. Returns the merged result (same shape as
// generateQuestions) once both streams complete. If streaming yields nothing
// parseable, falls back to a full-buffer parse so we never regress.
export async function streamQuestions(
  ai: Env['AI'],
  input: GenerateInput,
  onQuestion: (q: GeneratedQuestion) => void | Promise<void>,
  model = FAST_MODEL,
): Promise<GenerateResult> {
  const foci = model === FAST_MODEL ? PARALLEL_BATCH_FOCI : [undefined]
  const seen = new Set<string>()
  const emitted: GeneratedQuestion[] = []
  const rawByBatch: string[] = []
  let capReached = false

  const emit = async (q: GeneratedQuestion): Promise<void> => {
    if (capReached) return
    const key = dedupKey(q.prompt)
    if (!key || seen.has(key)) return
    seen.add(key)
    emitted.push(q)
    await onQuestion(q)
    if (emitted.length >= TARGET_QUESTION_COUNT) capReached = true
  }

  const settled = await Promise.allSettled(
    foci.map(async (batchFocus) => {
      const { messages, approxInputChars } = buildMessages(input, batchFocus)
      let scanCursor = 0
      const raw = await invokeAIStream(ai, model, messages, approxInputChars, async (rawSoFar) => {
        if (capReached) return
        const { objects, cursor } = extractCompleteQuestionObjects(rawSoFar, scanCursor)
        scanCursor = cursor
        for (const objText of objects) {
          if (capReached) break
          let parsed: unknown
          try {
            parsed = JSON.parse(objText)
          } catch {
            continue // not yet valid JSON despite balanced braces — skip
          }
          const question = validateSingleQuestion(parsed)
          if (question) await emit(question)
        }
      })
      rawByBatch.push(raw)
      return raw
    }),
  )

  const anyFulfilled = settled.some((r) => r.status === 'fulfilled')
  if (!anyFulfilled) {
    const firstError = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason
    throw firstError instanceof Error ? firstError : new WizardAIError('AI generation failed')
  }

  // If incremental parsing surfaced nothing (e.g. the model emitted the array in
  // one final burst that our per-delta scan missed, or non-stream fallback), run
  // the authoritative full-buffer parse over each batch and emit from there.
  if (emitted.length === 0) {
    for (const raw of rawByBatch) {
      try {
        const parsed = parseAIQuestions(raw)
        for (const q of parsed.questions) await emit(q)
      } catch {
        // skip unparseable batch; another batch may still yield questions
      }
    }
  }

  if (emitted.length === 0) {
    throw new WizardValidationError('AI response did not contain any valid questions')
  }

  const confidence = scoreConfidence(
    rawByBatch.join(''),
    rawByBatch.join(''),
    emitted.length,
  )
  return { questions: emitted, confidence }
}

// Exported for unit tests.
export const __internal = {
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  extractCompleteQuestionObjects,
  validateSingleQuestion,
  scoreConfidence,
  FAST_MODEL,
  QUALITY_FALLBACK_MODEL,
  TARGET_QUESTION_COUNT,
}
// Re-export for handler to catch validation errors cleanly.
export { z }
