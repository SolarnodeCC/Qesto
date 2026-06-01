import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Sprint 29 leaderboard and badge contract', () => {
  it('keeps leaderboard and badges in the LIVE energizer snapshot', () => {
    const realtime = readFileSync('functions/api/realtime.ts', 'utf8')
    // TD-01 extracted the energizer/score logic out of SessionRoom.ts into
    // dedicated handler modules; the contract is the combined DO surface.
    const room =
      readFileSync('functions/api/SessionRoom.ts', 'utf8') +
      readFileSync('functions/api/lib/session-room-energizer-handler.ts', 'utf8') +
      readFileSync('functions/api/lib/session-room-energizer.ts', 'utf8')
    // R-05 extracted the live energizer panels (incl. LiveLeaderboard/BadgeRow)
    // out of JoinPage.tsx into a dedicated module; the contract is the combined
    // join voter surface.
    const join =
      readFileSync('src/pages/JoinPage.tsx', 'utf8') +
      readFileSync('src/pages/join/LiveEnergizerPanels.tsx', 'utf8')
    const present = readFileSync('src/pages/Present.tsx', 'utf8')

    expect(realtime).toContain('LiveLeaderboardEntry')
    expect(realtime).toContain('LiveBadgeAward')
    expect(room).toContain('withScoreArtifacts')
    expect(room).toContain('buildLeaderboard')
    expect(join).toContain('LiveLeaderboard')
    expect(present).toContain('leaderboard.title')
  })

  it('documents the Sprint 29 shipped scope', () => {
    const sprint29 = readFileSync('knowledge-base/product/planning/sprints/SPRINT29_IMPLEMENTATION_SPEC.md', 'utf8')

    expect(sprint29).toContain('Leaderboard and badge foundation')
    expect(sprint29).toContain('deterministic and idempotent')
  })
})
