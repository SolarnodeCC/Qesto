// Insights AI (DX-INSIGHTS-01/02): theme extraction for closed sessions.
//
// Given the set of open-ended responses (and, optionally, the option labels
// chosen by voters in poll questions), ask a Workers AI model to cluster the
// content into 3–5 themes. Each theme surfaces a short label, a rough count of
// responses that fit it, and up to three representative example excerpts.
//
// If Vectorize is available we additionally fetch semantically similar
// responses for each theme example to enrich the "examples" list. This is
// best-effort; the handler falls back to the pure-text summary on error.
//
// CB-02: Workers AI circuit breaker wraps runInsightsAI — 3 failures in 60s → OPEN.
// The breaker uses a no-op signal because Workers AI.run() doesn't accept AbortSignal;
// per-call timeout is handled by withTimeout(AI_TIMEOUT_MS=25s).

import { z } from 'zod'
import { CircuitBreakers } from './resilience/circuit-breaker'

export type InsightsInput = {
  sessionTitle: string
  openResponses: string[] // raw free-text responses
  pollBreakdown?: { prompt: string; topLabels: string[] }[] // up to 5 poll prompts with their top labels
  similarSessionTitles?: string[] // from Vectorize semantic search, best-effort
  /**
   * Optional RAG context block (markdown) produced by `getRagContext()`.
   * When present, the prompt is grounded against knowledge-base passages.
   * Best-effort — the analyzer must work without it.
   */
  kbContext?: string
}

export type InsightTheme = {
  theme: string
  count: number
  examples: string[]
}

export type InsightsResult = {
  themes: InsightTheme[]
}

export class InsightsValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'InsightsValidationError'
  }
}

export class InsightsAIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsightsAIError'
  }
}

const THEME_SYSTEM_PROMPT = `You are an analyst summarising the results of a
live team session. Given a list of free-text participant responses (and
optionally the breakdown of poll answers), identify the top 3 to 5 recurring
themes.

Respond with STRICT JSON only. No markdown, no prose. The JSON must have one
key "themes", whose value is an array of 3 to 5 objects with keys:

  theme    : short theme label (max 60 chars)
  count    : integer ≈ how many responses fit this theme
  examples : an array of 1 to 3 short verbatim or lightly-paraphrased excerpts
             from the responses (each max 160 chars)

Rules:
- Do not invent themes that have no support in the responses.
- Do not include participant names or PII in the examples.
- If there are fewer than 3 responses, return one "Insufficient data" theme.`

function buildUserPrompt(input: InsightsInput): string {
  const lines: string[] = []
  // RAG grounding goes FIRST so the model reads it before the responses. The
  // block is already a fenced markdown section (`## Knowledge Base Context`).
  // We surround it with an explicit usage hint so the analyzer treats it as
  // background — not as response text to summarise.
  if (input.kbContext && input.kbContext.trim().length > 0) {
    lines.push(
      'Background knowledge (from internal docs — use to interpret the responses, do not summarise it as a theme):',
    )
    lines.push(input.kbContext.trim())
    lines.push('')
  }
  lines.push(`Session title: ${input.sessionTitle}`)
  if (input.pollBreakdown && input.pollBreakdown.length > 0) {
    lines.push('\nPoll highlights:')
    for (const pb of input.pollBreakdown) {
      lines.push(`- ${pb.prompt} → top: ${pb.topLabels.join(', ')}`)
    }
  }
  lines.push('\nFree-text responses:')
  const capped = input.openResponses.slice(0, 100) // cap to bound tokens
  for (let i = 0; i < capped.length; i++) {
    lines.push(`${i + 1}. ${capped[i]}`)
  }
  if (input.similarSessionTitles && input.similarSessionTitles.length > 0) {
    lines.push('\nSimilar past sessions for additional context:')
    for (const t of input.similarSessionTitles) {
      lines.push(`- "${t}"`)
    }
  }
  lines.push('\nReturn the themes JSON now.')
  return lines.join('\n')
}

const ThemeSchema = z.object({
  theme: z.string().min(1).max(60),
  count: z.number().int().min(0).max(100_000),
  examples: z.array(z.string().min(1).max(200)).min(0).max(5),
})
const ThemesOutputSchema = z.object({
  themes: z.array(ThemeSchema).min(1).max(5),
})

const AI_TIMEOUT_MS = 25_000
const RETRY_DELAYS_MS = [200, 400] as const

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenceMatch ? fenceMatch[1] : raw
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new InsightsValidationError('AI response did not contain a JSON object')
  }
  return body.slice(firstBrace, lastBrace + 1)
}

const MAX_TOKENS = 768

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function runInsightsAI(
  ai: Ai,
  model: string,
  messages: { role: 'system' | 'user'; content: string }[],
  approxInputChars: number,
): Promise<string> {
  const maxAttempts = RETRY_DELAYS_MS.length + 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const t0 = Date.now()
    try {
      const res = (await withTimeout(
        ai.run(model, {
          messages,
          max_tokens: MAX_TOKENS,
        }) as Promise<{ response?: string } | string>,
        AI_TIMEOUT_MS,
        'AI insights extraction',
      )) as { response?: string } | string

      const latencyMs = Date.now() - t0
      const raw =
        typeof res === 'string'
          ? res
          : typeof res?.response === 'string'
            ? res.response
            : ''
      if (!raw || raw.trim() === '') {
        throw new InsightsAIError('AI returned empty response')
      }
      console.log(JSON.stringify({ event: 'ai.insights.ok', model, attempt, latencyMs, approxInputChars, outputChars: raw.length }))
      return raw
    } catch (err) {
      lastError = err
      const latencyMs = Date.now() - t0
      const error = err instanceof Error ? err.message : String(err)
      const event = attempt < maxAttempts ? 'ai.insights.retry' : 'ai.insights.error'
      console.log(JSON.stringify({ event, model, attempt, latencyMs, approxInputChars, error }))
      if (attempt < maxAttempts) {
        await sleep(RETRY_DELAYS_MS[attempt - 1])
      }
    }
  }

  throw new InsightsAIError(
    `AI invocation failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

export async function extractThemes(
  ai: Ai,
  input: InsightsInput,
  model = '@cf/mistral/mistral-7b-instruct-v0.2',
): Promise<InsightsResult> {
  // Fast path: no responses → no themes. Don't burn AI quota.
  if (
    (!input.openResponses || input.openResponses.length === 0) &&
    (!input.pollBreakdown || input.pollBreakdown.length === 0)
  ) {
    return { themes: [] }
  }

  const userPrompt = buildUserPrompt(input)
  const approxInputChars = THEME_SYSTEM_PROMPT.length + userPrompt.length
  const messages = [
    { role: 'system' as const, content: THEME_SYSTEM_PROMPT },
    { role: 'user' as const, content: userPrompt },
  ]
  // CB-02: circuit breaker tracks failures across the retry loop; opens at 3 failures.
  const raw = await CircuitBreakers.ai.execute(
    (_signal) => runInsightsAI(ai, model, messages, approxInputChars),
    () => { throw new InsightsAIError('Workers AI unavailable (circuit open)') },
  )

  const cleaned = extractJson(raw)
  let parsedObj: unknown
  try {
    parsedObj = JSON.parse(cleaned)
  } catch (err) {
    throw new InsightsValidationError(
      `AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  const result = ThemesOutputSchema.safeParse(parsedObj)
  if (!result.success) {
    throw new InsightsValidationError(
      'AI response did not match themes schema',
      result.error.flatten(),
    )
  }
  return { themes: result.data.themes }
}

export const __internal = {
  THEME_SYSTEM_PROMPT,
  AI_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  buildUserPrompt,
  extractJson,
  runInsightsAI,
}
