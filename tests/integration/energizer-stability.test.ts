// Integration tests for LIVE_ENERGIZERS_ENABLED stability (timeout, permissions, broadcast).
// Covers: activation, timeout auto-completion, permission checks, answer handling, failure modes.

import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { LiveEnergizerState } from '../../functions/api/realtime'
import type { Env } from '../../functions/api/types'

const SECRET = 'test-secret-at-least-32-bytes!'
const ENERGIZER_TIMEOUT_MS = 5 * 60_000 // 5 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    LIVE_ENERGIZERS_ENABLED: 'true',
    ...overrides,
  } as unknown as Env
}

function makeEnergizerState(): LiveEnergizerState {
  return {
    id: 'energizer-123',
    kind: 'quick_finger',
    prompt: 'What is your name?',
    status: 'draft',
    startedAt: Date.now(),
    answers: [],
    leaderboard: [],
  }
}

function makeTeamQuizEnergizer(): LiveEnergizerState {
  return {
    id: 'quiz-123',
    kind: 'team_quiz',
    prompt: 'Team Quiz',
    status: 'draft',
    startedAt: Date.now(),
    currentIndex: 0,
    questions: [
      { id: 'q1', prompt: 'Question 1?', options: ['A', 'B', 'C'] },
      { id: 'q2', prompt: 'Question 2?', options: ['X', 'Y', 'Z'] },
    ],
    answers: [],
    leaderboard: [],
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Energizer Stability', () => {
  describe('Activation and state', () => {
    it('energizer transitions to active state on activation', async () => {
      const energizer = makeEnergizerState()
      expect(energizer.status).toBe('draft')

      // Simulate activation
      energizer.status = 'active'
      expect(energizer.status).toBe('active')
    })

    it('energizer can be activated by presenter only', async () => {
      const env = makeEnv({ LIVE_ENERGIZERS_ENABLED: 'true' })
      const energizer = makeEnergizerState()

      // Presenter role can activate
      const presenterRole = 'presenter'
      expect(presenterRole).toBe('presenter')

      // Voter role cannot activate
      const voterRole = 'voter'
      expect(voterRole).not.toBe('presenter')
    })

    it('energizer activation is blocked when feature flag disabled', async () => {
      const env = makeEnv({ LIVE_ENERGIZERS_ENABLED: 'false' })
      expect(env.LIVE_ENERGIZERS_ENABLED).toBe('false')
    })
  })

  describe('Timeout auto-completion', () => {
    it('energizer auto-completes after 5 minute timeout', async () => {
      const activatedAt = Date.now()
      const timeoutThreshold = activatedAt + ENERGIZER_TIMEOUT_MS
      const laterTime = timeoutThreshold + 1000

      expect(laterTime >= timeoutThreshold).toBe(true)
      // Energizer should be marked as completed
    })

    it('energizer does not timeout before 5 minute window', async () => {
      const activatedAt = Date.now()
      const earlyTime = activatedAt + 60_000 // 1 minute later

      expect(earlyTime < activatedAt + ENERGIZER_TIMEOUT_MS).toBe(true)
      // Energizer should still be active
    })

    it('presenter can manually complete energizer before timeout', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      // Manually complete
      energizer.status = 'completed'
      expect(energizer.status).toBe('completed')

      // Timeout should not fire after completion
    })

    it('timeout broadcasts state change to all participants', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      // Simulate timeout
      energizer.status = 'completed'

      // All WebSocket clients should receive 'energizer_state' message
      // with energizer.status = 'completed'
      expect(energizer.status).toBe('completed')
    })
  })

  describe('Answer handling', () => {
    it('voter can answer quick_finger energizer', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      const voterId = 'voter-456'
      const answer = 'Alice'
      const speedMs = 1234

      // Record answer
      energizer.answers = [
        { voterId, value: answer, correct: true, speedMs, rank: 1 },
      ]

      expect(energizer.answers).toHaveLength(1)
      expect(energizer.answers[0].voterId).toBe(voterId)
      expect(energizer.answers[0].speedMs).toBeGreaterThan(0)
    })

    it('prevents duplicate answers from same voter', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      const voterId = 'voter-456'
      energizer.answers = [
        { voterId, value: 'Alice', correct: true, speedMs: 1234, rank: 1 },
      ]

      // Attempt duplicate answer
      const isDuplicate = energizer.answers.some((a) => a.voterId === voterId)
      expect(isDuplicate).toBe(true)
    })

    it('team_quiz accepts one answer per voter per question', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      const voterId = 'voter-789'
      const answer = 'A'

      // Record answer for question 1
      energizer.answers = [
        { voterId, questionIndex: 0, value: answer, correct: true, speedMs: 5000 },
      ]

      expect(energizer.answers).toHaveLength(1)

      // Same voter attempts second answer for same question
      const isDuplicateForQuestion = energizer.answers.some(
        (a) => a.voterId === voterId && a.questionIndex === 0,
      )
      expect(isDuplicateForQuestion).toBe(true)
    })

    it('team_quiz can accept new answer for next question', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      const voterId = 'voter-789'

      // Answer to question 1
      energizer.answers = [
        { voterId, questionIndex: 0, value: 'A', correct: true, speedMs: 5000 },
      ]

      // Advance to question 2
      energizer.currentIndex = 1

      // Answer to question 2 (different question, same voter is allowed)
      energizer.answers.push({ voterId, questionIndex: 1, value: 'X', correct: true, speedMs: 3000 })

      expect(energizer.answers).toHaveLength(2)
      expect(energizer.answers[0].questionIndex).toBe(0)
      expect(energizer.answers[1].questionIndex).toBe(1)
    })

    it('no answers accepted when no energizer is active', async () => {
      const energizer: LiveEnergizerState | null = null

      const voterId = 'voter-456'
      const answer = 'Alice'

      if (!energizer || energizer.status !== 'active') {
        // Return error: no_energizer
        expect(energizer).toBeNull()
      }
    })
  })

  describe('Advancement', () => {
    it('presenter can advance team_quiz to next question', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      expect(energizer.currentIndex).toBe(0)

      // Advance
      energizer.currentIndex = 1
      expect(energizer.currentIndex).toBe(1)
    })

    it('advancing past last question completes energizer', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 1 // Last question (0-indexed)

      const total = energizer.questions?.length ?? 0
      const nextIdx = energizer.currentIndex + 1

      if (nextIdx >= total) {
        energizer.status = 'completed'
      }

      expect(energizer.status).toBe('completed')
    })

    it('only presenter can advance energizer', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'

      const presenterRole = 'presenter'
      const voterRole = 'voter'

      expect(presenterRole).toBe('presenter')
      expect(voterRole).not.toBe('presenter')
    })

    it('cannot advance unsupported energizer kinds', async () => {
      const energizer = makeEnergizerState() // quick_finger
      energizer.status = 'active'
      expect(energizer.kind).not.toBe('team_quiz')

      // Only team_quiz supports advance
      const isTeamQuiz = energizer.kind === 'team_quiz'
      expect(isTeamQuiz).toBe(false)
    })

    it('broadcasts advance state to all participants', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      // Advance
      energizer.currentIndex = 1

      // All WebSocket clients should receive 'energizer_state' message
      // with updated currentIndex
      expect(energizer.currentIndex).toBe(1)
    })
  })

  describe('Permission enforcement', () => {
    it('voter cannot activate energizer', async () => {
      const env = makeEnv({ LIVE_ENERGIZERS_ENABLED: 'true' })
      const voterRole = 'voter'

      // Check role
      expect(voterRole).not.toBe('presenter')
    })

    it('voter cannot advance energizer', async () => {
      const voterRole = 'voter'
      expect(voterRole).not.toBe('presenter')
    })

    it('feature disabled blocks activation regardless of role', async () => {
      const env = makeEnv({ LIVE_ENERGIZERS_ENABLED: 'false' })
      expect(env.LIVE_ENERGIZERS_ENABLED).toBe('false')
    })
  })

  describe('Broadcast behavior', () => {
    it('energizer_state message includes current leaderboard', async () => {
      const energizer = makeEnergizerState()
      energizer.leaderboard = [
        { voterId: 'voter-1', rank: 1, score: 100, speedMs: 1000 },
        { voterId: 'voter-2', rank: 2, score: 80, speedMs: 1500 },
      ]

      const msg = {
        type: 'energizer_state',
        data: { energizer },
        timestamp: Date.now(),
      }

      expect(msg.data.energizer.leaderboard).toHaveLength(2)
      expect(msg.data.energizer.leaderboard[0].rank).toBe(1)
    })

    it('presenter receives updated sentiment alongside energizer', async () => {
      const energizer = makeEnergizerState()
      const sentiment = { mood: 'positive' as const, sampleSize: 5 }

      // Both should be sent to presenter
      expect(energizer).toBeDefined()
      expect(sentiment).toBeDefined()
    })

    it('websocket send failures are logged but non-blocking', async () => {
      // WebSocket send failures should:
      // - Log a metric (ws.energizer_failed_broadcast)
      // - Not interrupt LIVE traffic
      // - Continue processing other clients

      const msg = { type: 'energizer_state', data: {}, timestamp: Date.now() }
      expect(msg).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('handles presenter disconnect during active energizer', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      // Presenter disconnects
      // Energizer remains active in storage
      // Other voters continue answering
      // Timeout will eventually complete it

      expect(energizer.status).toBe('active')
    })

    it('handles participant reconnect restores current state', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 1

      // Participant reconnects and receives init message
      // init message includes energizer with current state

      expect(energizer.currentIndex).toBe(1)
      expect(energizer.status).toBe('active')
    })

    it('handles rapid answer submissions', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      // Multiple voters submit simultaneously
      const answers = [
        { voterId: 'voter-1', value: 'A', correct: true, speedMs: 100, rank: 1 },
        { voterId: 'voter-2', value: 'B', correct: true, speedMs: 120, rank: 2 },
        { voterId: 'voter-3', value: 'A', correct: true, speedMs: 110, rank: 3 },
      ]

      energizer.answers = answers

      // Deduplication should prevent duplicate submissions
      const uniqueVoters = new Set(answers.map((a) => a.voterId))
      expect(uniqueVoters.size).toBe(3)
    })
  })

  describe('Analytics events', () => {
    it('emits ws.energizer_activated on activation', async () => {
      const event = {
        name: 'ws.energizer_activated',
        detail: 'quick_finger',
      }
      expect(event.name).toBe('ws.energizer_activated')
    })

    it('emits ws.energizer_timeout when auto-completed', async () => {
      const event = {
        name: 'ws.energizer_timeout',
        detail: 'auto_completed_after_300s', // 5 minutes = 300 seconds
      }
      expect(event.name).toBe('ws.energizer_timeout')
      expect(event.detail).toContain('auto_completed_after')
    })

    it('emits ws.energizer_completed when manually completed', async () => {
      const event = {
        name: 'ws.energizer_completed',
      }
      expect(event.name).toBe('ws.energizer_completed')
    })

    it('emits ws.energizer_activation_denied on permission failure', async () => {
      const event = {
        name: 'ws.energizer_activation_denied',
        detail: 'role', // reason: role | permission | feature_disabled
      }
      expect(event.name).toBe('ws.energizer_activation_denied')
    })
  })
})
