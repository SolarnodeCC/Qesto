/**
 * captions-ai.ts — Workers AI routing for the CAPTIONS pipeline (ADR-0051 §1b/§1c).
 *
 * The SINGLE swap point for the ASR + MT model IDs. Feature code (the ingest
 * route, the eval suite) calls `transcribeAudio` / `translateText` and stays
 * model-agnostic — only this file names `@cf/openai/whisper` and
 * `@cf/meta/m2m100-1.2b`.
 *
 * Hard rule #1: Workers AI only via runAI() facade. No OpenAI/Anthropic/
 * third-party ASR/MT. Both calls are circuit-broken (ADR-0007 / CircuitBreakers.ai):
 * on OPEN the pipeline degrades to "captions paused" (null) rather than erroring
 * the session. Every model output is Zod-parsed before use (never trust raw text).
 */
import { logBestEffort } from '../log'
import { z } from 'zod'
import { runAI } from './ai-gateway'
import type { Env } from '../../types'
import { CircuitBreakers } from '../resilience/circuit-breaker'
import type { CaptionLocale } from '../captions-config'
import { AI_MODELS } from './models'

// ── Model IDs (the only place they are named) ────────────────────────────────
export const CAPTIONS_ASR_MODEL = AI_MODELS.WHISPER
export const CAPTIONS_MT_MODEL = AI_MODELS.M2M100

// ── Output schemas — parse every model response, never trust raw text ────────
// Whisper returns { text, (word_count?), (words?), (vtt?) }; we only require text.
const WhisperResponseSchema = z.object({
  text: z.string(),
  word_count: z.number().optional(),
  vtt: z.string().optional(),
})

// M2M100 returns { translated_text }.
const M2M100ResponseSchema = z.object({
  translated_text: z.string(),
})

export type TranscriptResult = { text: string }
export type TranslationResult = { text: string }

/**
 * ASR: transcribe one presenter audio chunk to text in the source locale.
 * Circuit-broken; returns null on breaker-open or a structurally-invalid model
 * response (caller degrades to "captions paused" for that chunk). Audio bytes
 * are a request-scoped buffer here and are dropped when this returns — never
 * persisted, never forwarded.
 */
export async function transcribeAudio(
  env: Env,
  audio: number[] | Uint8Array,
): Promise<TranscriptResult | null> {
  const bytes = audio instanceof Uint8Array ? Array.from(audio) : audio
  return degradeToNull('captions.asr', () => CircuitBreakers.ai.execute(
    async () => {
      const raw = await runAI(env, CAPTIONS_ASR_MODEL, { audio: bytes })
      const parsed = WhisperResponseSchema.safeParse(raw)
      if (!parsed.success) return null
      const text = parsed.data.text.trim()
      if (!text) return null
      return { text }
    },
    () => null, // breaker OPEN → captions paused
  ))
}

/**
 * MT: translate one finalized segment from source → target. Called ONCE per
 * distinct active target locale (the fan-out-once discipline lives in the
 * handler/route, not here). Circuit-broken; null on breaker-open or invalid
 * output → caller degrades that locale's variant to source text.
 */
export async function translateText(
  env: Env,
  text: string,
  sourceLang: CaptionLocale,
  targetLang: CaptionLocale,
): Promise<TranslationResult | null> {
  if (sourceLang === targetLang) return { text }
  return degradeToNull('captions.mt', () => CircuitBreakers.ai.execute(
    async () => {
      const raw = await runAI(env, CAPTIONS_MT_MODEL, {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      })
      const parsed = M2M100ResponseSchema.safeParse(raw)
      if (!parsed.success) return null
      const translated = parsed.data.translated_text.trim()
      if (!translated) return null
      return { text: translated }
    },
    () => null, // breaker OPEN → degrade to source
  ))
}

/**
 * Below the breaker threshold `execute` rethrows. For captions every failure
 * must degrade (paused chunk / source-only variant), never 500 the segment.
 */
async function degradeToNull<T>(route: string, fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    // Non-fatal by design: the caller treats null as "degrade this chunk".
    logBestEffort(err, { traceId: 'captions', route, operation: 'ai.run', reason: 'captions_ai_degraded' })
    return null
  }
}

export const __captionsAiInternal = {
  WhisperResponseSchema,
  M2M100ResponseSchema,
}
