import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

// Regression guard for issue #615 (root repo-rot): site-verification tokens,
// agent-generated audit markdowns, and loose scripts must not accumulate at the
// repo root. CLAUDE.md mandates docs live under /knowledge-base/, and static
// verification files must live in public/ so the host actually serves them.

const ROOT = process.cwd()
const atRoot = (name: string) => existsSync(join(ROOT, name))

describe('repo root stays free of relocated strays (#615)', () => {
  it.each([
    'BingSiteAuth.xml',
    'e8964e65669d47a69dd02b32bfe2a64e.txt',
    'PR_COMMANDS.sh',
    'PROMISE_TO_IMPLEMENTATION_AUDIT.md',
    'PROMISE_AUDIT_QUICK_REFERENCE.md',
  ])('%s is not at the repo root', (name) => {
    expect(atRoot(name)).toBe(false)
  })
})

describe('verification tokens are served from public/ (#615)', () => {
  it('Bing site-verification lives in public/', () => {
    expect(atRoot('public/BingSiteAuth.xml')).toBe(true)
  })

  it('Google/IndexNow token lives in public/', () => {
    expect(atRoot('public/e8964e65669d47a69dd02b32bfe2a64e.txt')).toBe(true)
  })
})
