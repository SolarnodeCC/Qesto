/**
 * Requirement: CLAUDE.md hard rule 1 (Workers AI only) + REV-10 AI eval gate — every model id must exist in the Workers AI catalog.
 */
// AI model registry guard — every Workers AI model id must come from
// functions/api/lib/ai/models.ts. Two invalid ids previously shipped (the AI
// binding is mocked in tests, so nothing caught them) and silently broke live
// sentiment and every AI insights run in production.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AI_MODELS, ALL_AI_MODEL_IDS } from '../../functions/api/lib/ai/models'
import { INSIGHTS_MODEL } from '../../functions/api/lib/ai-insights'
import { SENTIMENT_MODEL } from '../../functions/api/lib/ai/session-context'

const ROOT = resolve(__dirname, '../..')
const REGISTRY = resolve(ROOT, 'functions/api/lib/ai/models.ts')
// Marketing video generation uses partner models outside the text catalog.
const EXEMPT = new Set([resolve(ROOT, 'functions/api/lib/marketing/constants.ts')])
const LITERAL = /['"`](@(?:cf|hf)\/[^'"`]+)['"`]/g

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

function isComment(line: string): boolean {
  const s = line.trimStart()
  return s.startsWith('*') || s.startsWith('//') || s.startsWith('/*')
}

describe('AI model registry', () => {
  it('has no model id literals outside lib/ai/models.ts', () => {
    const offenders: string[] = []
    for (const dir of ['functions', 'worker', 'workers']) {
      for (const file of walk(resolve(ROOT, dir))) {
        if (file === REGISTRY || EXEMPT.has(file)) continue
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (isComment(line)) return
            for (const m of line.matchAll(LITERAL)) offenders.push(`${file.slice(ROOT.length + 1)}:${i + 1} ${m[1]}`)
          })
      }
    }
    expect(offenders).toEqual([])
  })

  it('never contains the ids that are not in the Workers AI catalog', () => {
    const known_invalid = [
      '@cf/meta/distilbert-sst-2-int8',
      '@cf/mistral/mistral-7b-instruct-v0.2',
      '@cf/meta/llama-3.1-8b-instruct',
    ]
    for (const id of known_invalid) expect(ALL_AI_MODEL_IDS).not.toContain(id)
  })

  it('wires insights and sentiment to catalog models', () => {
    expect(INSIGHTS_MODEL).toBe(AI_MODELS.LLAMA_70B)
    expect(SENTIMENT_MODEL).toBe('@cf/huggingface/distilbert-sst-2-int8')
  })
})
