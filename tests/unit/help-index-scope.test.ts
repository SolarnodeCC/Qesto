import { describe, expect, it } from 'vitest'
import * as fs from 'fs'

// Enforces the one-directional invariant the team requires:
//   qesto-help (the user-facing chatbot index) must contain ONLY knowledge-base/help
//   docs. The KB index (qesto-kb-production) MAY include help docs — but never the
//   reverse. These checks fail CI if a future change breaks that direction.

const helpSync = fs.readFileSync('scripts/sync-help-docs.ts', 'utf-8')
const helpSeed = fs.readFileSync('scripts/generate-help-seed.mjs', 'utf-8')
const embedKb = fs.readFileSync('scripts/embed-kb.ts', 'utf-8')

describe('qesto-help is help-docs-only (one-directional KB ⊇ help)', () => {
  it('the help seed builder sources ONLY knowledge-base/help', () => {
    expect(helpSeed).toMatch(/HELP_DIR\s*=\s*path\.join\(__dirname,\s*['"]\.\.\/knowledge-base\/help['"]\)/)
  })

  it('the help sync reads the chunked seed (not arbitrary KB paths)', () => {
    expect(helpSync).toMatch(/SEED_FILE\s*=\s*path\.join\(__dirname,\s*['"]\.\.\/functions\/api\/seed\/help-documents\.json['"]\)/)
    expect(helpSync).toMatch(/knowledge-base\/help/)
  })

  it('the help sync is the writer for the qesto-help index', () => {
    expect(helpSync).toMatch(/INDEX_NAME\s*=\s*['"]qesto-help['"]/)
    expect(helpSync).toMatch(/vectorize\/indexes\/\$\{INDEX_NAME\}/)
  })

  it('the KB index writer (embed-kb) never writes to qesto-help', () => {
    expect(embedKb).not.toMatch(/qesto-help/)
  })
})
