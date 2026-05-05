import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Sprint 28 Team Quiz contract', () => {
  it('keeps Team Quiz on the v1 LIVE energizer WebSocket path', () => {
    const realtime = readFileSync('functions/api/realtime.ts', 'utf8')
    const room = readFileSync('functions/api/SessionRoom.ts', 'utf8')
    const hook = readFileSync('src/hooks/useLiveSession.ts', 'utf8')
    const present = readFileSync('src/pages/Present.tsx', 'utf8')
    const join = readFileSync('src/pages/JoinPage.tsx', 'utf8')

    expect(realtime).toContain("type: 'energizer_advance'")
    expect(room).toContain('handleTeamQuizAnswer')
    expect(room).toContain('rankTeamQuizScores')
    expect(hook).toContain('sendEnergizerAdvance')
    expect(present).toContain('handleStartTeamQuiz')
    expect(join).toContain('LiveTeamQuizPanel')
  })

  it('documents the Sprint 28 shipped scope', () => {
    const sprint28 = readFileSync('docs/SPRINT28_IMPLEMENTATION_SPEC.md', 'utf8')

    expect(sprint28).toContain('Team Quiz LIVE loop')
    expect(sprint28).toContain('multi-question LIVE energizer loop')
  })
})
