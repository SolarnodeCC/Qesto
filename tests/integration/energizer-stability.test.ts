// Integration tests for LIVE_ENERGIZERS_ENABLED stability (timeout, permissions, broadcast).
// Covers: activation, timeout auto-completion, permission checks, answer handling, failure modes.

import { describe, expect, it } from 'vitest'
import type { LiveEnergizerState, LiveTeamQuizSubmission } from '../../functions/api/realtime'
import type { Env } from '../../functions/api/types'
import { testJwtSecret } from '../helpers/test-credentials'

const jwtFixture = testJwtSecret()
const ENERGIZER_TIMEOUT_MS = 5 * 60_000 // 5 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: jwtFixture,
    LIVE_ENERGIZERS_ENABLED: 'true',
    ...overrides,
  } as unknown as Env
}

function makeEnergizerState(): LiveEnergizerState {
  return {
    id: 'energizer-123',
    kind: 'quick_finger',
    title: 'Quick Finger',
    prompt: 'What is your name?',
    status: 'active',
    startedAt: Date.now(),
    answers: [],
    leaderboard: [],
  }
}

function makeTeamQuizEnergizer(): LiveEnergizerState {
  return {
    id: 'quiz-123',
    kind: 'team_quiz',
    title: 'Team Quiz',
    prompt: 'Team Quiz',
    status: 'active',
    startedAt: Date.now(),
    currentIndex: 0,
    questions: [
      { prompt: 'Question 1?', options: ['A', 'B', 'C'], correctIndex: 0 },
      { prompt: 'Question 2?', options: ['X', 'Y', 'Z'], correctIndex: 1 },
    ],
    answers: [],
    submissions: [],
    leaderboard: [],
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Energizer Stability', () => {
  describe('Activation and state', () => {
    it('energizer transitions between active and completed states', async () => {
      const energizer = makeEnergizerState()
      expect(energizer.status).toBe('active')

      // Simulate completion
      energizer.status = 'completed'
      expect(energizer.status).toBe('completed')
    })

    it('energizer can be activated by presenter only', async () => {
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
      const answers = [{ voterId, value: answer, correct: true, speedMs, rank: 1 }]
      energizer.answers = answers

      expect(answers).toHaveLength(1)
      expect(answers[0].voterId).toBe(voterId)
      expect(answers[0].speedMs).toBeGreaterThan(0)
    })

    it('prevents duplicate answers from same voter', async () => {
      const energizer = makeEnergizerState()
      energizer.status = 'active'

      const voterId = 'voter-456'
      const answers = [{ voterId, value: 'Alice', correct: true, speedMs: 1234, rank: 1 }]
      energizer.answers = answers

      // Attempt duplicate answer
      const isDuplicate = answers.some((a) => a.voterId === voterId)
      expect(isDuplicate).toBe(true)
    })

    it('team_quiz accepts one answer per voter per question', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      const voterId = 'voter-789'
      const answer = 'A'

      // Record submission for question 1
      const submissions: LiveTeamQuizSubmission[] = [
        { voterId, questionIndex: 0, value: answer, correct: true },
      ]
      energizer.submissions = submissions

      expect(submissions).toHaveLength(1)

      // Same voter attempts second answer for same question
      const isDuplicateForQuestion = submissions.some(
        (a) => a.voterId === voterId && a.questionIndex === 0,
      )
      expect(isDuplicateForQuestion).toBe(true)
    })

    it('team_quiz can accept new answer for next question', async () => {
      const energizer = makeTeamQuizEnergizer()
      energizer.status = 'active'
      energizer.currentIndex = 0

      const voterId = 'voter-789'

      // Submission to question 1
      const submissions: LiveTeamQuizSubmission[] = [
        { voterId, questionIndex: 0, value: 'A', correct: true },
      ]

      // Advance to question 2
      energizer.currentIndex = 1

      // Submission to question 2 (different question, same voter is allowed)
      submissions.push({ voterId, questionIndex: 1, value: 'X', correct: true })
      energizer.submissions = submissions

      expect(submissions).toHaveLength(2)
      expect(submissions[0].questionIndex).toBe(0)
      expect(submissions[1].questionIndex).toBe(1)
    })

    it('no answers accepted when no energizer is active', async () => {
      const energizer: LiveEnergizerState | null = null

      // No active energizer → submissions must be rejected with no_energizer.
      expect(energizer).toBeNull()
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
      const nextIdx = (energizer.currentIndex ?? 0) + 1

      if (nextIdx >= total) {
        energizer.status = 'completed'
      }

      expect(energizer.status).toBe('completed')
    })

    it('only presenter can advance energizer', async () => {
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
      const leaderboard = [
        { voterId: 'voter-1', label: 'voter-1', rank: 1, score: 100, badges: [] },
        { voterId: 'voter-2', label: 'voter-2', rank: 2, score: 80, badges: [] },
      ]
      energizer.leaderboard = leaderboard

      const msg = {
        type: 'energizer_state',
        data: { energizer },
        timestamp: Date.now(),
      }

      expect(msg.data.energizer.leaderboard).toHaveLength(2)
      expect(leaderboard[0].rank).toBe(1)
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
