/**
 * Requirement: ADR-0050 §Origin validation — local-dev host detection and expected origin resolution for CSRF.
 */
import { describe, expect, it } from 'vitest'
import { isLocalDevHost, resolveExpectedOrigin } from '../../functions/api/lib/origin'

describe('isLocalDevHost', () => {
  it('treats wrangler --local and Playwright origins as local', () => {
    expect(isLocalDevHost('http://localhost:8788/api/auth/password/signup')).toBe(true)
    expect(isLocalDevHost('http://127.0.0.1:8788/api/auth/password/signup')).toBe(true)
  })

  it('does not treat production or synthetic integration hosts as local', () => {
    expect(isLocalDevHost('https://qesto.cc/api/auth/password/signup')).toBe(false)
    expect(isLocalDevHost('http://local/api/auth/password/signup')).toBe(false)
    expect(isLocalDevHost('not a url')).toBe(false)
  })
})

describe('resolveExpectedOrigin', () => {
  it('prefers PAGES_URL, then API_URL, then the request URL', () => {
    expect(resolveExpectedOrigin({ PAGES_URL: 'https://qesto.cc', API_URL: 'https://api.qesto.cc' }, 'http://localhost:8788/x')).toBe(
      'https://qesto.cc',
    )
    expect(resolveExpectedOrigin({ PAGES_URL: '', API_URL: 'https://api.qesto.cc' }, 'http://localhost:8788/x')).toBe(
      'https://api.qesto.cc',
    )
    expect(resolveExpectedOrigin({ PAGES_URL: '', API_URL: '' }, 'http://localhost:8788/x')).toBe('http://localhost:8788')
  })
})
