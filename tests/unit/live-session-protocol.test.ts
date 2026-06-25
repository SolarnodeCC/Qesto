import { describe, expect, it } from 'vitest'
import { parseInitPayload } from '../../src/lib/live-session-protocol'

describe('live-session-protocol', () => {
  describe('parseInitPayload', () => {
    it('preserves the code field during validation', () => {
      const payload = {
        session: {
          id: 's123',
          code: 'ABC123',
          title: 'Test Session',
          status: 'live',
        },
        role: 'voter',
        voterId: 'v_abc',
        question: {
          id: 'q1',
          kind: 'poll',
          prompt: 'What is your favorite color?',
          options: ['Red', 'Blue', 'Green'],
        },
        questionIndex: 0,
        questionTotal: 5,
        results: { counts: { Red: 2, Blue: 1 }, total: 3 },
        participants: 10,
      }
      const result = parseInitPayload(payload)
      expect(result).not.toBeNull()
      expect(result?.session.code).toBe('ABC123')
      expect(result?.session.id).toBe('s123')
      expect(result?.session.title).toBe('Test Session')
    })

    it('returns null if code is missing from session', () => {
      const payload = {
        session: {
          id: 's123',
          title: 'Test Session',
          status: 'live',
          // code is missing
        },
        role: 'voter',
        voterId: 'v_abc',
      }
      const result = parseInitPayload(payload)
      expect(result).toBeNull()
    })

    it('returns null if session is missing', () => {
      const payload = {
        role: 'voter',
        voterId: 'v_abc',
        // session is missing
      }
      const result = parseInitPayload(payload)
      expect(result).toBeNull()
    })

    it('parses poll options as { id, label } objects from the DO init payload', () => {
      const payload = {
        session: {
          id: 's123',
          code: 'ABC123',
          title: 'Test Session',
          status: 'live',
        },
        role: 'voter',
        voterId: 'v_abc',
        question: {
          id: 'q1',
          kind: 'poll',
          prompt: 'What should we prioritize?',
          options: [
            { id: 'opt_a', label: 'Option A' },
            { id: 'opt_b', label: 'Option B' },
          ],
        },
        questionIndex: 0,
        questionTotal: 1,
        results: { counts: {}, total: 0 },
        participants: 1,
      }
      const result = parseInitPayload(payload)
      expect(result?.question).toMatchObject({
        id: 'q1',
        prompt: 'What should we prioritize?',
        options: [
          { id: 'opt_a', label: 'Option A' },
          { id: 'opt_b', label: 'Option B' },
        ],
      })
    })

    it('handles optional fields gracefully', () => {
      const payload = {
        session: {
          id: 's123',
          code: 'DEFG456',
          title: 'Another Session',
          status: 'live',
        },
        role: 'presenter',
        voterId: 'v_presenter',
        // question and other optional fields omitted
      }
      const result = parseInitPayload(payload)
      expect(result).not.toBeNull()
      expect(result?.session.code).toBe('DEFG456')
      expect(result?.question).toBeNull()
      expect(result?.questionIndex).toBe(0)
    })
  })
})
