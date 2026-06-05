import { describe, expect, it } from 'vitest'
import * as fs from 'fs'

// Enforces the one-directional invariant the team requires:
//   qesto-help (the user-facing chatbot index) must contain ONLY knowledge-base/help
//   docs. The KB index (qesto-kb-production) MAY include help docs — but never the
//   reverse. These checks fail CI if a future change breaks that direction.

const helpSync = fs.readFileSync('scripts/sync-help-docs.ts', 'utf-8')
const embedKb = fs.readFileSync('scripts/embed-kb.ts', 'utf-8')

describe('qesto-help is help-docs-only (one-directional KB ⊇ help)', () => {
  it('the help sync sources ONLY knowledge-base/help', () => {
    expect(helpSync).toMatch(/HELP_DIR\s*=\s*['"]knowledge-base\/help['"]/)
  })

  it('the help sync is the writer for the qesto-help index', () => {
    expect(helpSync).toMatch(/vectorize\/indexes\/qesto-help/)
  })

  it('the KB index writer (embed-kb) never writes to qesto-help', () => {
    expect(embedKb).not.toMatch(/qesto-help/)
  })
})
