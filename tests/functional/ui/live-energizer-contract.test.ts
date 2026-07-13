import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Sprint 26/27 LIVE energizer contract', () => {
  it('keeps presenter activation and participant answers on the v1 WebSocket path', () => {
    const hook = readFileSync('src/hooks/useLiveSession.ts', 'utf8')
    const present = readFileSync('src/pages/Present.tsx', 'utf8')
    const join = readFileSync('src/pages/JoinPage.tsx', 'utf8')

    expect(hook).toContain("type: 'energizer_activate'")
    expect(hook).toContain("type: 'energizer_answer'")
    // Core-audit P-2: the unreachable Present.tsx launch stubs were removed;
    // the v1 activation surface lives in the hook until the presenter UI ships.
    expect(hook).toContain('sendEnergizerActivate')
    expect(present).toContain('state.energizer')
    expect(join).toContain('sendEnergizerAnswer')
    expect(join).toContain('LiveQuickFingerPanel')
  })

  it('documents the Sprint 26/27 shipped scope', () => {
    const sprint26 = readFileSync('knowledge-base/product/planning/sprints/SPRINT26_IMPLEMENTATION_SPEC.md', 'utf8')
    const sprint27 = readFileSync('knowledge-base/product/planning/sprints/SPRINT27_IMPLEMENTATION_SPEC.md', 'utf8')

    expect(sprint26).toContain('LIVE energizer activation readiness')
    expect(sprint27).toContain('Quick Finger playable loop')
  })
})
