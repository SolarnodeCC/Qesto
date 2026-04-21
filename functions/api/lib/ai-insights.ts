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

import { z } from 'zod'

export type InsightsInput = {
  sessionTitle: string
  openResponses: string[] // raw free-text responses
  pollBreakdown?: { prompt: string; topLabels: string[] }[] // up to 5 poll prompts with their top labels
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
  const lines: string[] = [`Session title: ${input.sessionTitle}`]
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
  lines.push('\nReturn the themes JSON now.')
  return lines.join('\n')
}

const ThemeSchema = z.object({
  theme: z.string().min(1).max(60),
  count: z.number().int().min(0).max(100_000),
  examples: z.array(z.string().min(1).max(200)).min(1).max(3),
})
const ThemesOutputSchema = z.object({
  themes: z.array(ThemeSchema).min(1).max(5),
})

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

  let raw: string
  try {
    const res = (await ai.run(model, {
      messages: [
        { role: 'system', content: THEME_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    })) as { response?: string } | string

    raw =
      typeof res === 'string'
        ? res
        : typeof res?.response === 'string'
          ? res.response
          : ''
    if (!raw || raw.trim() === '') {
      throw new InsightsAIError('AI returned empty response')
    }
  } catch (err) {
    if (err instanceof InsightsAIError) throw err
    throw new InsightsAIError(
      `AI invocation failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

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

export const __internal = { THEME_SYSTEM_PROMPT, buildUserPrompt, extractJson }
