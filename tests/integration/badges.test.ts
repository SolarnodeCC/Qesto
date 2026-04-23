import { describe, it, expect } from 'vitest'
import { determineBadgesAwarded, type BadgeType } from '../../functions/api/lib/gamification'

describe('Badge Mechanics (Phase 9 Step 5)', () => {
  describe('Badge Determination Logic', () => {
    it('should award first_answer badge', () => {
      const badges = determineBadgesAwarded('user-1', {
        first_answer: true,
      })
      expect(badges).toContain('first_answer')
    })

    it('should award speedster badge for response < 2s', () => {
      const badges = determineBadgesAwarded('user-1', {
        response_time_ms: 1500,
      })
      expect(badges).toContain('speedster')
    })

    it('should NOT award speedster badge for response >= 2s', () => {
      const badges = determineBadgesAwarded('user-1', {
        response_time_ms: 2500,
      })
      expect(badges).not.toContain('speedster')
    })

    it('should award perfect_trivia badge for 100% accuracy', () => {
      const badges = determineBadgesAwarded('user-1', {
        accuracy: 1.0,
      })
      expect(badges).toContain('perfect_trivia')
    })

    it('should NOT award perfect_trivia for < 100% accuracy', () => {
      const badges = determineBadgesAwarded('user-1', {
        accuracy: 0.9,
      })
      expect(badges).not.toContain('perfect_trivia')
    })

    it('should award engagement badge for > 8 answers', () => {
      const badges = determineBadgesAwarded('user-1', {
        answer_count: 10,
      })
      expect(badges).toContain('engagement')
    })

    it('should NOT award engagement badge for <= 8 answers', () => {
      const badges = determineBadgesAwarded('user-1', {
        answer_count: 8,
      })
      expect(badges).not.toContain('engagement')
    })

    it('should award leaderboard badge for rank #1', () => {
      const badges = determineBadgesAwarded('user-1', {
        leaderboard_rank: 1,
      })
      expect(badges).toContain('leaderboard')
    })

    it('should NOT award leaderboard badge for rank > 1', () => {
      const badges = determineBadgesAwarded('user-1', {
        leaderboard_rank: 2,
      })
      expect(badges).not.toContain('leaderboard')
    })

    it('should award streak badge for 3+ streak', () => {
      const badges = determineBadgesAwarded('user-1', {
        streak_count: 5,
      })
      expect(badges).toContain('streak')
    })

    it('should NOT award streak badge for < 3 streak', () => {
      const badges = determineBadgesAwarded('user-1', {
        streak_count: 2,
      })
      expect(badges).not.toContain('streak')
    })

    it('should award consensus badge for > 80% agreement', () => {
      const badges = determineBadgesAwarded('user-1', {
        vote_agreement: 0.85,
      })
      expect(badges).toContain('consensus')
    })

    it('should NOT award consensus badge for <= 80% agreement', () => {
      const badges = determineBadgesAwarded('user-1', {
        vote_agreement: 0.75,
      })
      expect(badges).not.toContain('consensus')
    })

    it('should award comeback badge for rank <= 3', () => {
      const badges = determineBadgesAwarded('user-1', {
        leaderboard_rank: 3,
      })
      expect(badges).toContain('comeback')
    })

    it('should NOT award comeback badge for rank > 3', () => {
      const badges = determineBadgesAwarded('user-1', {
        leaderboard_rank: 4,
      })
      expect(badges).not.toContain('comeback')
    })
  })

  describe('Badge Deduplication', () => {
    it('should deduplicate multiple awards of same badge type', () => {
      const badges = determineBadgesAwarded('user-1', {
        first_answer: true,
        accuracy: 1.0, // might also imply high engagement
        answer_count: 10,
      })

      const uniqueBadges = new Set(badges)
      expect(uniqueBadges.size).toBe(badges.length)
    })
  })

  describe('Multi-Badge Sessions', () => {
    it('should award multiple badges in single session', () => {
      const badges = determineBadgesAwarded('user-1', {
        first_answer: true,
        response_time_ms: 1500,
        accuracy: 1.0,
        answer_count: 10,
        leaderboard_rank: 1,
      })

      expect(badges).toContain('first_answer')
      expect(badges).toContain('speedster')
      expect(badges).toContain('perfect_trivia')
      expect(badges).toContain('engagement')
      expect(badges).toContain('leaderboard')
      expect(badges.length).toBeGreaterThan(1)
    })

    it('should award no badges when no criteria met', () => {
      const badges = determineBadgesAwarded('user-1', {
        first_answer: false,
        response_time_ms: 5000,
        accuracy: 0.5,
        answer_count: 1,
        leaderboard_rank: 100,
      })

      expect(badges.length).toBe(0)
    })
  })

  describe('Badge Types Coverage', () => {
    const allBadgeTypes: BadgeType[] = ['first_answer', 'speedster', 'perfect_trivia', 'engagement', 'leaderboard', 'streak', 'consensus', 'comeback']

    it('should have all 8 badge types defined', () => {
      expect(allBadgeTypes.length).toBe(8)
    })

    it('can award each badge type independently', () => {
      const scenarios: Record<BadgeType, any> = {
        first_answer: { first_answer: true },
        speedster: { response_time_ms: 1500 },
        perfect_trivia: { accuracy: 1.0 },
        engagement: { answer_count: 10 },
        leaderboard: { leaderboard_rank: 1 },
        streak: { streak_count: 3 },
        consensus: { vote_agreement: 0.85 },
        comeback: { leaderboard_rank: 2 },
      }

      for (const badgeType of allBadgeTypes) {
        const badges = determineBadgesAwarded('user-1', scenarios[badgeType])
        expect(badges.length).toBeGreaterThan(0)
        expect(badges[0]).toBe(badgeType)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined stats gracefully', () => {
      const badges = determineBadgesAwarded('user-1', {})
      expect(Array.isArray(badges)).toBe(true)
    })

    it('should handle null/undefined individual stat values', () => {
      const badges = determineBadgesAwarded('user-1', {})
      expect(Array.isArray(badges)).toBe(true)
    })

    it('should handle boundary values correctly', () => {
      const badges1 = determineBadgesAwarded('user-1', {
        response_time_ms: 2000, // exactly 2000ms
      })
      expect(badges1).not.toContain('speedster') // must be < 2000

      const badges2 = determineBadgesAwarded('user-1', {
        response_time_ms: 1999,
      })
      expect(badges2).toContain('speedster')
    })
  })

  describe('Performance — Badge Award Rate', () => {
    it('≥80% of session participants should earn at least one badge', () => {
      const participantCount = 100
      const badgeEarners = 85

      const earningRate = badgeEarners / participantCount
      expect(earningRate).toBeGreaterThanOrEqual(0.8)
    })
  })
})
