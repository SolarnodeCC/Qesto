/**
 * Requirement: issue #879 (DD-06) — limiter faults fail closed; only profiles
 * listed in RATE_LIMIT_FAIL_OPEN_PROFILES may fail open, and auth profiles
 * never can (an unlimited PBKDF2 login path is a CPU-exhaustion DoS).
 */
import { describe, expect, it } from 'vitest'
import { failsClosed } from '../../functions/api/middleware/rate-limit'

describe('failsClosed (DD-06)', () => {
  it('fails open everywhere when the global flag is off', () => {
    expect(failsClosed({ RATE_LIMIT_FAIL_CLOSED: 'false' }, 'auth_login_ip')).toBe(false)
  })

  it('fails closed by default when the flag is on', () => {
    expect(failsClosed({ RATE_LIMIT_FAIL_CLOSED: 'true' }, 'og_image')).toBe(true)
  })

  it('lets listed non-auth profiles fail open', () => {
    const env = { RATE_LIMIT_FAIL_CLOSED: 'true', RATE_LIMIT_FAIL_OPEN_PROFILES: 'og_image, sitemap' }
    expect(failsClosed(env, 'og_image')).toBe(false)
    expect(failsClosed(env, 'sitemap')).toBe(false)
    expect(failsClosed(env, 'admin_destructive')).toBe(true)
  })

  it('never lets an auth profile fail open, even if listed', () => {
    const env = { RATE_LIMIT_FAIL_CLOSED: 'true', RATE_LIMIT_FAIL_OPEN_PROFILES: 'auth_login_ip' }
    expect(failsClosed(env, 'auth_login_ip')).toBe(true)
  })
})
