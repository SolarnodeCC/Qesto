import { describe, expect, it } from 'vitest'
import { parseInitPayload } from '../../src/lib/live-session-protocol'

const VALID_INIT = {
  session: { id: 's1', code: 'ABC123', title: 'Test session', status: 'live' },
  role: 'presenter',
  voterId: 'v1',
  questionIndex: 0,
  questionTotal: 2,
  results: { counts: { o1: 0 }, total: 0 },
  participants: 3,
}

describe('parseInitPayload', () => {
  it('preserves the session join code through validation', () => {
    // Regression: the QR code in presenting mode was broken because the
    // schema stripped `code`, leaving `/j/undefined`.
    const parsed = parseInitPayload(VALID_INIT)
    expect(parsed).not.toBeNull()
    expect(parsed?.session.code).toBe('ABC123')
  })

  it('hydrates the core session fields', () => {
    const parsed = parseInitPayload(VALID_INIT)
    expect(parsed?.session).toEqual({ id: 's1', code: 'ABC123', title: 'Test session', status: 'live' })
    expect(parsed?.role).toBe('presenter')
    expect(parsed?.voterId).toBe('v1')
  })

  it('rejects a payload whose session is missing the code', () => {
    const parsed = parseInitPayload({ ...VALID_INIT, session: { id: 's1', title: 'No code', status: 'live' } })
    expect(parsed).toBeNull()
  })
})
