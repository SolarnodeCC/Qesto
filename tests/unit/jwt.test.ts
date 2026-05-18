import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signJwt, verifyJwt } from '../../functions/api/lib/jwt'

const SECRET = 'unit-test-secret-at-least-32-bytes!'
const OTHER = 'different-secret-nope-not-the-one!'

describe('jwt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips claims when signed and verified with the same secret', async () => {
    const token = await signJwt({ sub: 'user_1', email: 'test@example.com' }, SECRET, 3600)
    const claims = await verifyJwt(token, SECRET)
    expect(claims).not.toBeNull()
    expect(claims?.sub).toBe('user_1')
    expect(claims?.email).toBe('test@example.com')
    expect(claims?.exp).toBeGreaterThan(claims?.iat ?? 0)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt({ sub: 'u', email: 'test@example.com' }, SECRET, 3600)
    const claims = await verifyJwt(token, OTHER)
    expect(claims).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signJwt({ sub: 'u', email: 'test@example.com' }, SECRET, 3600)
    const [h, , s] = token.split('.')
    const fakePayload = btoa(JSON.stringify({ sub: 'attacker', email: 'attacker@example.com', iat: 0, exp: 9_999_999_999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const claims = await verifyJwt(`${h}.${fakePayload}.${s}`, SECRET)
    expect(claims).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signJwt({ sub: 'u', email: 'test@example.com' }, SECRET, 60)
    vi.setSystemTime(new Date('2026-04-20T13:00:00Z')) // +1h, > 60s
    const claims = await verifyJwt(token, SECRET)
    expect(claims).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    expect(await verifyJwt('not.a.token', SECRET)).toBeNull()
    expect(await verifyJwt('only-two-parts', SECRET)).toBeNull()
    expect(await verifyJwt('', SECRET)).toBeNull()
  })
})
