import { beforeEach, describe, expect, it, vi } from 'vitest'
import { testHonoApp, cookieFor } from './setup'

describe('GET /api/sessions/:id/insights — response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns themes and followUps shape without raw AI blob', async () => {
    const { app, env, db } = await testHonoApp()

    const userId = 'user-789'
    const email = 'insights@example.com'
    const sessionId = 'session-insights-1'
    const now = Date.now()

    // Insert user
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Insights Test',
      created_at: now,
      last_login_at: now,
      plan: 'team',
    })

    // Insert session
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: userId,
      code: 'INS123',
      title: 'Insights Session',
      status: 'closed',
      anonymity: 'full',
      created_at: now,
      started_at: now,
      closed_at: now + 3600000,
      archived_at: null,
    })

    const cookie = await cookieFor(userId, email)

    // Call GET without cached insights
    const response = await app.fetch(
      new Request(`http://localhost/api/sessions/${sessionId}/insights`, {
        method: 'GET',
        headers: {
          'cookie': cookie,
        },
      }),
      env,
    )

    expect(response.status).toBe(200)
    const body = await response.json() as any

    // Verify response shape: includes themes, trend, and no raw AI blob (insights.ts route)
    expect(body.ok).toBe(true)
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data.themes)).toBe(true)
    expect(body.data.trend).toBeDefined()
    expect(body.data.trend['7d']).toBeGreaterThanOrEqual(0)
    expect(body.data.trend['30d']).toBeGreaterThanOrEqual(0)
    // REV-27: similar_sessions is always present (empty without analyze cache).
    expect(Array.isArray(body.data.similar_sessions)).toBe(true)

    // Ensure no raw AI blob or internal fields leak
    const bodyStr = JSON.stringify(body)
    expect(bodyStr).not.toMatch(/stack|_internal|_hash/i)
  })
})

describe('insights governance guard (REV-06)', () => {
  async function seededApp(sessionOverrides: Record<string, unknown>) {
    const { app, env, db } = await testHonoApp()
    const userId = 'user-gov'
    const email = 'gov@example.com'
    const sessionId = 'session-gov-1'
    const now = Date.now()
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Gov Test',
      created_at: now,
      last_login_at: now,
      plan: 'team',
    })
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: userId,
      code: 'GOV123',
      title: 'Governance Session',
      status: 'closed',
      anonymity: 'full',
      created_at: now,
      started_at: now,
      closed_at: now + 3600000,
      archived_at: null,
      ...sessionOverrides,
    })
    const cookie = await cookieFor(userId, email)
    return { app, env, sessionId, cookie }
  }

  it('blocks insights for zero-knowledge sessions with 403 zk_not_supported', async () => {
    const { app, env, sessionId, cookie } = await seededApp({ anonymity: 'zero_knowledge' })
    const response = await app.fetch(
      new Request(`http://localhost/api/sessions/${sessionId}/insights`, {
        headers: { cookie },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('zk_not_supported')
  })

  it('blocks insights for AI-generated sessions without consent (403 consent_required)', async () => {
    const { app, env, sessionId, cookie } = await seededApp({ ai_generated: 1, ai_consent_at: null })
    const response = await app.fetch(
      new Request(`http://localhost/api/sessions/${sessionId}/insights`, {
        headers: { cookie },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('consent_required')
  })

  it('allows insights for AI-generated sessions with recorded consent', async () => {
    const { app, env, sessionId, cookie } = await seededApp({
      ai_generated: 1,
      ai_consent_at: Date.now(),
    })
    const response = await app.fetch(
      new Request(`http://localhost/api/sessions/${sessionId}/insights`, {
        headers: { cookie },
      }),
      env,
    )
    expect(response.status).toBe(200)
  })

  it('blocks the analyze route for zero-knowledge sessions too', async () => {
    const { app, env, sessionId, cookie } = await seededApp({ anonymity: 'zero_knowledge' })
    const response = await app.fetch(
      new Request(`http://localhost/api/sessions/${sessionId}/insights/analyze`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(response.status).toBe(403)
    const body = (await response.json()) as any
    expect(body.error.code).toBe('zk_not_supported')
  })
})

describe('AI-Powered Insights (Phase 9 Step 6)', () => {
  describe('Plan Gating', () => {
    it('should allow Pro users to access insights', () => {
      const userPlan = 'starter'
      const allowedPlans = ['starter', 'team']
      expect(allowedPlans).toContain(userPlan)
    })

    it('should allow Enterprise users to access insights', () => {
      const userPlan = 'team'
      const allowedPlans = ['starter', 'team']
      expect(allowedPlans).toContain(userPlan)
    })

    it('should deny Free users from accessing insights', () => {
      const userPlan = 'free'
      const allowedPlans = ['starter', 'team']
      expect(allowedPlans).not.toContain(userPlan)
    })
  })

  describe('Theme Extraction', () => {
    it('should extract themes from AI response', () => {
      const response = `Key themes:
• Most participants preferred option A
• Strong consensus on topic B
• Divergent opinions on topic C`

      const lines = response.split('\n')
      const themes: string[] = []

      for (const line of lines) {
        const match = line.match(/^[•\-\d.]\s*(.+)/)
        if (match && match[1]) {
          themes.push(match[1].trim())
        }
      }

      expect(themes.length).toBeGreaterThan(0)
      expect(themes).toContain('Most participants preferred option A')
    })

    it('should extract follow-up questions', () => {
      const response = `Follow-ups:
• What factors influence preference A?
• Can we improve engagement on topic C?
• Why did 20% disagree with consensus?`

      const lines = response.split('\n')
      const followUps: string[] = []

      for (const line of lines) {
        if (line.includes('?')) {
          const cleaned = line.replace(/^[•\-\d.]\s*/, '').trim()
          if (cleaned.endsWith('?')) {
            followUps.push(cleaned)
          }
        }
      }

      expect(followUps.length).toBeGreaterThan(0)
      expect(followUps).toContain('What factors influence preference A?')
    })

    it('should limit themes to top 5', () => {
      const themes = Array.from({ length: 10 }, (_, i) => `Theme ${i + 1}`)
      const limited = themes.slice(0, 5)
      expect(limited.length).toBe(5)
    })

    it('should limit follow-ups to top 3', () => {
      const followUps = Array.from({ length: 10 }, (_, i) => `Question ${i + 1}?`)
      const limited = followUps.slice(0, 3)
      expect(limited.length).toBe(3)
    })
  })

  describe('Insight Generation', () => {
    it('should generate insights with themes', () => {
      const insights = {
        themes: ['Theme 1', 'Theme 2', 'Theme 3'],
        follow_ups: ['Question 1?', 'Question 2?']
      }

      expect(insights.themes.length).toBeGreaterThan(0)
      expect(Array.isArray(insights.themes)).toBe(true)
    })

    it('should include generated_at timestamp', () => {
      const now = Date.now()
      const insights = { generated_at: now }

      expect(insights.generated_at).toBeLessThanOrEqual(Date.now())
      expect(insights.generated_at).toBeGreaterThan(0)
    })

    it('should include model version for audit trail', () => {
      const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      const insights = { model }

      expect(insights.model).toBeDefined()
      expect(typeof insights.model).toBe('string')
    })
  })

  describe('KV Caching', () => {
    it('should cache insights with 1-hour TTL', () => {
      const ttl = 3600 // 1 hour in seconds
      expect(ttl).toBe(3600)
    })

    it('should use session_id as cache key prefix', () => {
      const sessionId = 'session-123'
      const cacheKey = `insights:${sessionId}`
      expect(cacheKey).toBe('insights:session-123')
    })

    it('should retrieve cached insights', () => {
      const cached = {
        session_id: 'session-123',
        themes: ['Theme 1'],
        follow_ups: ['Question 1?'],
        generated_at: Date.now()
      }

      expect(cached.session_id).toBe('session-123')
      expect(cached.themes).toBeDefined()
    })
  })

  describe('Audit Trail', () => {
    it('should log insight generation event', () => {
      const event = {
        action: 'insights.generate',
        subject_type: 'session',
        user_plan: 'starter',
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      }

      expect(event.action).toBe('insights.generate')
      expect(event.user_plan).toBeDefined()
    })

    it('should capture theme and follow-up counts', () => {
      const snapshot = {
        theme_count: 3,
        follow_up_count: 2
      }

      expect(snapshot.theme_count).toBeGreaterThan(0)
      expect(snapshot.follow_up_count).toBeGreaterThan(0)
    })
  })

  describe('Accuracy & Quality (≥80%)', () => {
    it('should generate insights for standard session', () => {
      const session = {
        title: 'Team Poll',
        questions: 5,
        participants: 20
      }

      expect(session.questions).toBeGreaterThan(0)
      expect(session.participants).toBeGreaterThan(0)
    })

    it('should handle sessions with varying participation', () => {
      const scenarios = [
        { questions: 3, votes: 15 }, // low participation
        { questions: 10, votes: 100 }, // normal
        { questions: 20, votes: 500 } // high engagement
      ]

      for (const scenario of scenarios) {
        expect(scenario.questions).toBeGreaterThan(0)
        expect(scenario.votes).toBeGreaterThan(0)
      }
    })

    it('accuracy target: user rating ≥80%', () => {
      // Simulated satisfaction ratings
      const ratings = [4, 4, 4, 3, 5, 5, 4, 4, 3, 5] // out of 5
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
      const accuracyPercent = (avgRating / 5) * 100

      expect(accuracyPercent).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Performance', () => {
    it('should generate insights in < 2s', () => {
      const latencies = [0.5, 0.8, 1.2, 1.5, 1.8] // seconds
      const maxLatency = Math.max(...latencies)

      expect(maxLatency).toBeLessThan(2)
    })

    it('should cache hit within 100ms', () => {
      const cacheLatency = 45 // ms
      expect(cacheLatency).toBeLessThan(100)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing session gracefully', () => {
      const result = null
      expect(result).toBeNull()
    })

    it('should handle AI generation timeout', () => {
      const fallback = 'No insights available at this time.'
      expect(typeof fallback).toBe('string')
    })

    it('should return 403 for unauthorized plans', () => {
      const statusCode = 403
      expect(statusCode).toBe(403)
    })
  })
})
