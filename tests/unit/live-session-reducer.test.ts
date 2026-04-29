import { describe, expect, it } from 'vitest'
import { reducer, INITIAL } from '../../src/hooks/useLiveSession'
import type { LiveState, LiveQuestion, LiveSessionSummary } from '../../src/hooks/useLiveSession'

const QUESTION: LiveQuestion = {
  id: 'q1',
  kind: 'poll',
  prompt: 'What is your favourite colour?',
  options: [
    { id: 'o1', label: 'Red' },
    { id: 'o2', label: 'Blue' },
  ],
}

const SESSION: LiveSessionSummary = {
  id: 's1',
  code: 'ABC123',
  title: 'Test session',
  status: 'live',
}

describe('useLiveSession reducer', () => {
  describe('connection lifecycle', () => {
    it('connecting: sets connection to connecting and clears error', () => {
      const state: LiveState = { ...INITIAL, connection: 'open', error: 'prev error' }
      const next = reducer(state, { kind: 'connecting' })
      expect(next.connection).toBe('connecting')
      expect(next.error).toBeNull()
    })

    it('open: sets connection to open', () => {
      const next = reducer(INITIAL, { kind: 'open' })
      expect(next.connection).toBe('open')
    })

    it('reconnecting: sets connection + attempt count', () => {
      const next = reducer(INITIAL, { kind: 'reconnecting', attempt: 3 })
      expect(next.connection).toBe('reconnecting')
      expect(next.reconnectAttempts).toBe(3)
    })

    it('closed: sets connection to closed', () => {
      const state: LiveState = { ...INITIAL, connection: 'open' }
      const next = reducer(state, { kind: 'closed' })
      expect(next.connection).toBe('closed')
    })

    it('failed: sets connection to failed and records error', () => {
      const next = reducer(INITIAL, { kind: 'failed', error: 'Connection lost' })
      expect(next.connection).toBe('failed')
      expect(next.error).toBe('Connection lost')
    })
  })

  describe('init', () => {
    it('hydrates all session fields from server state', () => {
      const next = reducer(INITIAL, {
        kind: 'init',
        session: SESSION,
        role: 'voter',
        voterId: 'v_abc',
        question: QUESTION,
        questionIndex: 0,
        questionTotal: 3,
        results: { counts: { o1: 3, o2: 1 }, total: 4 },
        participants: 7,
      })
      expect(next.session).toEqual(SESSION)
      expect(next.role).toBe('voter')
      expect(next.voterId).toBe('v_abc')
      expect(next.question).toEqual(QUESTION)
      expect(next.results.total).toBe(4)
      expect(next.participants).toBe(7)
      expect(next.reconnectAttempts).toBe(0)
      expect(next.error).toBeNull()
      expect(next.questionIndex).toBe(0)
      expect(next.questionTotal).toBe(3)
    })

    it('resets reconnect counter on successful init', () => {
      const state: LiveState = { ...INITIAL, reconnectAttempts: 3 }
      const next = reducer(state, {
        kind: 'init',
        session: SESSION,
        role: 'voter',
        voterId: 'v_abc',
        question: null,
        questionIndex: 0,
        questionTotal: 0,
        results: { counts: {}, total: 0 },
        participants: 0,
      })
      expect(next.reconnectAttempts).toBe(0)
    })
  })

  describe('question', () => {
    it('updates active question, resets lastVote and allDone, and tracks position', () => {
      const state: LiveState = { ...INITIAL, lastVote: { optionId: 'o1' }, allDone: true }
      const newQ: LiveQuestion = { ...QUESTION, id: 'q2', prompt: 'Next question' }
      const next = reducer(state, { kind: 'question', question: newQ, index: 1, total: 3 })
      expect(next.question).toEqual(newQ)
      expect(next.lastVote).toBeNull()
      expect(next.allDone).toBe(false)
      expect(next.questionIndex).toBe(1)
      expect(next.questionTotal).toBe(3)
    })
  })

  describe('results', () => {
    it('updates counts and total', () => {
      const next = reducer(INITIAL, { kind: 'results', counts: { o1: 5, o2: 2 }, total: 7 })
      expect(next.results.counts.o1).toBe(5)
      expect(next.results.total).toBe(7)
    })
  })

  describe('participants', () => {
    it('updates participant count', () => {
      const next = reducer(INITIAL, { kind: 'participants', count: 42 })
      expect(next.participants).toBe(42)
    })
  })

  describe('vote_sent', () => {
    it('records the voted option and keeps all other state', () => {
      const state: LiveState = { ...INITIAL, connection: 'open', question: QUESTION }
      const next = reducer(state, { kind: 'vote_sent', optionId: 'o2' })
      expect(next.lastVote).toEqual({ optionId: 'o2' })
      expect(next.connection).toBe('open')
    })
  })

  describe('session_closed', () => {
    it('transitions to closed state and updates final results', () => {
      const state: LiveState = { ...INITIAL, session: SESSION, connection: 'open' }
      const next = reducer(state, { kind: 'session_closed', counts: { o1: 10, o2: 5 }, total: 15 })
      expect(next.connection).toBe('closed')
      expect(next.results.total).toBe(15)
      expect(next.session?.status).toBe('closed')
    })

    it('handles null session gracefully', () => {
      const next = reducer(INITIAL, { kind: 'session_closed', counts: {}, total: 0 })
      expect(next.connection).toBe('closed')
      expect(next.session).toBeNull()
    })
  })

  describe('error', () => {
    it('records error code + message', () => {
      const next = reducer(INITIAL, { kind: 'error', code: 'rate_limited', message: 'Too fast' })
      expect(next.error).toBe('rate_limited: Too fast')
    })
  })

  describe('INITIAL state', () => {
    it('starts with idle connection and no session data', () => {
      expect(INITIAL.connection).toBe('idle')
      expect(INITIAL.session).toBeNull()
      expect(INITIAL.question).toBeNull()
      expect(INITIAL.lastVote).toBeNull()
      expect(INITIAL.participants).toBe(0)
      expect(INITIAL.reconnectAttempts).toBe(0)
    })
  })
})
