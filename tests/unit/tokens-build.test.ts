import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const TOKENS_JSON = resolve(ROOT, 'docs/spec/design-tokens.json')

describe('design tokens source of truth', () => {
  it('docs/spec/design-tokens.json exists and parses', () => {
    expect(existsSync(TOKENS_JSON)).toBe(true)
    const json = JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as { color?: { teal?: Record<string, unknown> } }
    expect(json.color?.teal).toBeDefined()
  })
})
