import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const TOKENS_JSON = resolve(ROOT, 'docs/specs/design-tokens.json')

describe('design tokens source of truth', () => {
  it('docs/specs/design-tokens.json exists and parses', () => {
    expect(existsSync(TOKENS_JSON)).toBe(true)
    const json = JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as { color?: { teal?: Record<string, unknown> } }
    expect(json.color?.teal).toBeDefined()
  })
})
