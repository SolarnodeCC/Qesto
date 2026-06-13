// CAPTIONS-PIPELINE-01 AI eval golden set — ASR + MT quality (ADR-0051 §6, REV-10).
//
// Captions and translations are AI outputs, so they are eval-gated. CI cannot
// reach Workers AI, so `c.env.AI.run` is mocked deterministically (the fixture's
// `asr`/`mt` IS the model output) — these tests run offline/green, matching the
// existing tests/eval/*.eval.test.ts convention.
//
// Asserts:
//  1. ASR output parses to the { text } schema and clears the WER bar for EN+top4.
//  2. MT output parses to the translation schema and clears the WER bar per pair.
//  3. The server-side enablement matrix (CAPTION_PAIR_ENABLED) matches exactly the
//     pairs whose fixtures clear the bar — a failing pair is NOT enabled.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../../functions/api/types'
import { transcribeAudio, translateText } from '../../functions/api/lib/ai/captions-ai'
import { assembleSegment } from '../../functions/api/lib/captions-pipeline'
import {
  CAPTION_WER_BAR,
  isPairEnabled,
  wordErrorRate,
  type CaptionLocale,
} from '../../functions/api/lib/captions-config'
import { CircuitBreakers } from '../../functions/api/lib/resilience/circuit-breaker'
import asrGolden from './fixtures/captions-asr-golden.json'
import mtGolden from './fixtures/captions-mt-golden.json'

// Deterministic Workers AI double: routes ASR vs MT by model id and returns the
// pre-baked fixture payload for the given input. No network, fully offline.
function mockEnv(opts: {
  asrFor?: (audioLen: number) => string
  mtFor?: (text: string, source: string, target: string) => string
}): Env {
  return {
    AI: {
      run: async (model: string, input: Record<string, unknown>) => {
        if (model === '@cf/openai/whisper') {
          const audio = (input.audio as number[]) ?? []
          return { text: opts.asrFor ? opts.asrFor(audio.length) : '' }
        }
        if (model === '@cf/meta/m2m100-1.2b') {
          return {
            translated_text: opts.mtFor
              ? opts.mtFor(input.text as string, input.source_lang as string, input.target_lang as string)
              : '',
          }
        }
        throw new Error(`unexpected model ${model}`)
      },
    },
  } as unknown as Env
}

beforeEach(() => CircuitBreakers.ai.reset())

describe('eval: captions ASR quality (WER bar)', () => {
  it('fixture WER bar matches the code constant', () => {
    expect(asrGolden.werBar).toBe(CAPTION_WER_BAR)
    expect(mtGolden.werBar).toBe(CAPTION_WER_BAR)
  })

  for (const c of asrGolden.cases) {
    it(`transcribes + clears WER bar: ${c.name}`, async () => {
      const env = mockEnv({ asrFor: () => c.asr })
      const result = await transcribeAudio(env, [1, 2, 3, 4])
      // Output schema: a non-empty { text } — never raw/untyped model output.
      expect(result).not.toBeNull()
      expect(typeof result!.text).toBe('string')
      expect(result!.text.length).toBeGreaterThan(0)
      // Quality gate: WER(reference, transcript) <= bar.
      const wer = wordErrorRate(c.reference, result!.text)
      expect(wer).toBeLessThanOrEqual(CAPTION_WER_BAR)
    })
  }
})

describe('eval: captions MT quality (WER bar) + enablement matrix', () => {
  for (const p of mtGolden.pairs) {
    it(`translates + clears WER bar: ${p.source}->${p.target}`, async () => {
      const env = mockEnv({ mtFor: () => p.mt })
      const result = await translateText(env, p.sourceText, p.source as CaptionLocale, p.target as CaptionLocale)
      expect(result).not.toBeNull()
      expect(typeof result!.text).toBe('string')
      const wer = wordErrorRate(p.reference, result!.text)
      expect(wer).toBeLessThanOrEqual(CAPTION_WER_BAR)
    })

    it(`pair is enabled because it clears the bar: ${p.source}->${p.target}`, () => {
      const wer = wordErrorRate(p.reference, p.mt)
      const clears = wer <= CAPTION_WER_BAR
      // The server-side enablement matrix mirrors the eval outcome: a pair in the
      // golden set that clears the bar IS enabled (ADR-0051 §4).
      expect(isPairEnabled(p.source as CaptionLocale, p.target as CaptionLocale)).toBe(clears)
    })
  }

  it('a pair with no passing fixture is NOT enabled (degrade-to-source)', () => {
    // nl->de has no golden fixture / has not cleared the bar → must be disabled.
    expect(isPairEnabled('nl', 'de')).toBe(false)
    expect(isPairEnabled('es', 'fr')).toBe(false)
  })
})

describe('eval: end-to-end segment assembly is eval-consistent', () => {
  it('assembles a finalized EN segment with translated variants for active locales', async () => {
    const env = mockEnv({
      asrFor: () => 'welcome everyone to the quarterly all hands',
      mtFor: (_t, _s, target) => {
        const pair = mtGolden.pairs.find((p) => p.target === target)
        return pair ? pair.mt : ''
      },
    })
    const res = await assembleSegment(env, {
      audio: [1, 2, 3],
      sourceLocale: 'en',
      activeLocales: ['nl', 'es'],
      id: 'seg-1',
      ts: 1000,
      isFinal: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.payload.sourceText).toContain('welcome')
    // Fan-out once per distinct active enabled locale: nl + es variants present.
    expect(Object.keys(res.payload.variants).sort()).toEqual(['es', 'nl'])
    for (const target of ['nl', 'es'] as CaptionLocale[]) {
      const ref = mtGolden.pairs.find((p) => p.target === target)!.reference
      expect(wordErrorRate(ref, res.payload.variants[target]!)).toBeLessThanOrEqual(CAPTION_WER_BAR)
    }
  })
})
