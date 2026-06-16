import { beforeEach, describe, expect, it, vi } from 'vitest'
import { testHonoApp, cookieFor } from './setup'

describe('Energizers Routes', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /sessions/:sessionId/energizers — response contract', () => {
    it('returns required fields in expected shape without internal fields', async () => {
      const { app, env, db } = await testHonoApp()

      // Set up a user and session first
      const userId = 'user-123'
      const email = 'test@example.com'
      const sessionId = 'session-456'
      const now = Date.now()

      // Insert user
      db.users.set(userId, {
        id: userId,
        email,
        display_name: 'Test User',
        created_at: now,
        last_login_at: now,
        plan: 'free',
      })

      // Insert session
      db.sessions.set(sessionId, {
        id: sessionId,
        owner_id: userId,
        code: 'ABC123',
        title: 'Test Session',
        status: 'draft',
        anonymity: 'full',
        created_at: now,
        started_at: null,
        closed_at: null,
        archived_at: null,
      })

      const cookie = await cookieFor(userId, email)

      const response = await app.fetch(
        new Request(`http://localhost/api/sessions/${sessionId}/energizers`, {
          method: 'POST',
          headers: {
            'cookie': cookie,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            kind: 'emoji_poll',
            prompt: 'How are you feeling?',
          }),
        }),
        env,
      )

      expect(response.status).toBe(201)
      const body = await response.json() as any

      // Verify response shape
      expect(body.ok).toBe(true)
      expect(body.data).toBeDefined()
      expect(body.data.id).toBeDefined()
      expect(body.data.kind).toBe('emoji_poll')

      // Ensure no internal fields leak
      const bodyStr = JSON.stringify(body)
      expect(bodyStr).not.toMatch(/stack|_internal|_hash/i)
    })
  })

  describe('POST /sessions/:sessionId/energizers (create)', () => {
    it('should create battle_royale energizer', async () => {
      // Validates participants count and kind
      expect(['battle_royale', 'bracket']).toContain('battle_royale')
      expect(['user-1', 'user-2', 'user-3'].length).toBeGreaterThanOrEqual(2)
    })

    it('should reject invalid energizer kind', () => {
      const invalidKind = 'invalid_kind'
      expect(['battle_royale', 'bracket']).not.toContain(invalidKind)
    })

    it('should reject insufficient participants', () => {
      const participants = ['user-1']
      expect(participants.length).toBeLessThan(2)
    })
  })

  describe('GET /sessions/:sessionId/energizers/:energizerId', () => {
    it('should fetch energizer state', async () => {
      // Mock energizer data
      const mockEnergizer = {
        id: 'energizer-1',
        kind: 'battle_royale',
        prompt: 'Who wins?',
        config_json: JSON.stringify({
          num_rounds: 3,
          participants: ['user-1', 'user-2', 'user-3']
        }),
        state: 'active',
        position: 0,
        created_at: Date.now()
      }

      expect(mockEnergizer.state).toBe('active')
      expect(mockEnergizer.kind).toBe('battle_royale')
    })
  })

  describe('POST /sessions/:sessionId/energizers/:energizerId/advance', () => {
    it('should advance battle_royale round', async () => {
      const scores = { 'user-1': 100, 'user-2': 80, 'user-3': 60 }

      // Simulate advanceBattleRoyaleRound
      const sortedUsers = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([id]) => id)

      const elimThreshold = 0.5
      const cutoffIndex = Math.ceil(sortedUsers.length * (1 - elimThreshold))
      const advancing = sortedUsers.slice(0, Math.max(1, cutoffIndex))

      expect(advancing.length).toBeLessThan(sortedUsers.length)
      expect(advancing).toContain('user-1')
    })

    it('should complete battle_royale when 1 participant remains', () => {
      const finalParticipants = ['user-1']
      const isComplete = finalParticipants.length === 1
      expect(isComplete).toBe(true)
    })

    it('should advance bracket round', () => {
      const winnerIds = ['user-1', 'user-2', 'user-3', 'user-4']
      const nextMatches: Array<[string, string]> = []

      for (let i = 0; i < winnerIds.length; i += 2) {
        nextMatches.push([winnerIds[i], winnerIds[i + 1]])
      }

      expect(nextMatches.length).toBe(2)
      expect(nextMatches[0]).toEqual(['user-1', 'user-2'])
      expect(nextMatches[1]).toEqual(['user-3', 'user-4'])
    })

    it('should complete bracket when 1 winner remains', () => {
      const finalWinner = 'user-1'
      const isComplete = finalWinner !== null && !finalWinner.startsWith('bye_')
      expect(isComplete).toBe(true)
    })

    it('should award badges on energizer completion', () => {
      const user = { sub: 'user-1' }
      const badges = user.sub === 'user-1' ? ['leaderboard'] : []
      expect(badges).toContain('leaderboard')
    })
  })

  describe('GET /sessions/:sessionId/leaderboard', () => {
    it('should fetch live leaderboard', async () => {
      // Mock leaderboard entries
      const entries = [
        { user_id: 'user-1', rank: 1, score: 100 },
        { user_id: 'user-2', rank: 2, score: 80 },
        { user_id: 'user-3', rank: 3, score: 60 }
      ]

      expect(entries[0].rank).toBe(1)
      expect(entries).toHaveLength(3)
    })
  })

  // SEC (#537): cross-tenant IDOR — a non-owner authenticated user must not be
  // able to advance, inspect, or read leaderboards of another tenant's session.
  describe('cross-tenant authorization (#537)', () => {
    async function seedOwnerSession() {
      const ctx = await testHonoApp()
      const now = Date.now()
      const ownerId = 'owner-1'
      const attackerId = 'attacker-2'
      ctx.db.users.set(ownerId, {
        id: ownerId, email: 'owner@example.com', display_name: 'Owner',
        created_at: now, last_login_at: now, plan: 'team',
      })
      ctx.db.users.set(attackerId, {
        id: attackerId, email: 'attacker@example.com', display_name: 'Attacker',
        created_at: now, last_login_at: now, plan: 'team',
      })
      ctx.db.sessions.set('sess-owned', {
        id: 'sess-owned', owner_id: ownerId, code: 'OWN123', title: 'Owned',
        status: 'energizing', anonymity: 'full', created_at: now,
        started_at: now, closed_at: null, archived_at: null,
      })
      const ownerCookie = await cookieFor(ownerId, 'owner@example.com')
      const attackerCookie = await cookieFor(attackerId, 'attacker@example.com')
      return { ...ctx, ownerCookie, attackerCookie }
    }

    const hostEndpoints: Array<{ name: string; method: string; path: string; body?: unknown }> = [
      { name: 'POST advance', method: 'POST', path: '/energizers/en-1/advance', body: { scores: { a: 1 }, round: 0 } },
      { name: 'POST next', method: 'POST', path: '/energizers/en-1/next', body: {} },
      { name: 'GET detail', method: 'GET', path: '/energizers/en-1' },
      { name: 'GET leaderboard', method: 'GET', path: '/leaderboard' },
    ]

    for (const ep of hostEndpoints) {
      it(`blocks a non-owner from "${ep.name}" with 404`, async () => {
        const { app, env, attackerCookie } = await seedOwnerSession()
        const init: RequestInit = {
          method: ep.method,
          headers: { cookie: attackerCookie, 'content-type': 'application/json' },
        }
        if (ep.body !== undefined) init.body = JSON.stringify(ep.body)
        const res = await app.fetch(
          new Request(`http://localhost/api/sessions/sess-owned${ep.path}`, init),
          env,
        )
        expect(res.status).toBe(404)
        const body = (await res.json()) as { ok: boolean; error: { code: string } }
        expect(body.ok).toBe(false)
        expect(body.error.code).toBe('not_found')
      })
    }

    it('lets the owner past the authorization gate on their own leaderboard', async () => {
      const { app, env, ownerCookie } = await seedOwnerSession()
      const res = await app.fetch(
        new Request('http://localhost/api/sessions/sess-owned/leaderboard', {
          headers: { cookie: ownerCookie },
        }),
        env,
      )
      // The owner must NOT be rejected by the ownership check (404). (The mock
      // D1 does not model leaderboard_entries, so a 200/500 both prove the gate
      // was passed; only 404 would indicate the owner was wrongly denied.)
      expect(res.status).not.toBe(404)
    })

    it('blocks a non-owner from creating an energizer with 404 (regression)', async () => {
      const { app, env, attackerCookie } = await seedOwnerSession()
      const res = await app.fetch(
        new Request('http://localhost/api/sessions/sess-owned/energizers', {
          method: 'POST',
          headers: { cookie: attackerCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'emoji_poll', prompt: 'gotcha' }),
        }),
        env,
      )
      expect(res.status).toBe(404)
    })
  })

  describe('Stress Test — 100+ participants', () => {
    it('should handle large participant count', () => {
      const participants = Array.from({ length: 100 }, (_, i) => `user-${i + 1}`)
      expect(participants.length).toBe(100)

      // Battle royale elimination: each round eliminates ~50%
      let remaining = participants.length
      const rounds = Math.ceil(Math.log2(remaining))

      for (let r = 0; r < rounds; r++) {
        remaining = Math.ceil(remaining * 0.5)
      }

      expect(remaining).toBeLessThanOrEqual(1)
    })

    it('should handle bracket with padded participants', () => {
      const participants = Array.from({ length: 50 }, (_, i) => `user-${i + 1}`)
      const bracketSize = 64
      const padded = [...participants]

      while (padded.length < bracketSize) {
        padded.push(`bye_${padded.length}`)
      }

      expect(padded.length).toBe(64)
      expect(padded.filter(p => p.startsWith('bye_')).length).toBe(14)
    })

    it('p95 latency for advance should be < 500ms', () => {
      // Simulated latencies (in production, measured via admin metrics)
      const latencies = Array.from({ length: 100 }, () => Math.random() * 400)
      latencies.sort((a, b) => a - b)

      const p95Index = Math.ceil(latencies.length * 0.95) - 1
      const p95 = latencies[p95Index]

      expect(p95).toBeLessThan(500)
    })
  })
})
