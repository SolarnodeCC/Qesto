/**
 * Requirement: OWASP A01 / cross-site WebSocket hijacking — presenter role via cookie only from a trusted Origin (2026-11 go-live review).
 */
import { describe, expect, it } from 'vitest'
import { isTrustedBrowserOrigin } from '../../functions/api/lib/origin'

const PROD = { PAGES_URL: 'https://qesto.cc', API_URL: 'https://qesto.cc', ENV: 'production' }
const URL_PROD = 'https://qesto.cc/api/sessions/s1/ws'

describe('isTrustedBrowserOrigin', () => {
  it('trusts the configured frontend origin', () => {
    expect(isTrustedBrowserOrigin(PROD, URL_PROD, 'https://qesto.cc')).toBe(true)
  })

  it('rejects a foreign site (cross-site WebSocket hijack)', () => {
    expect(isTrustedBrowserOrigin(PROD, URL_PROD, 'https://evil.example')).toBe(false)
    expect(isTrustedBrowserOrigin(PROD, URL_PROD, null)).toBe(false)
  })

  it('rejects loopback against a deployed API, allows it for a local API', () => {
    expect(isTrustedBrowserOrigin(PROD, URL_PROD, 'http://localhost:5173')).toBe(false)
    expect(isTrustedBrowserOrigin(PROD, 'http://localhost:8787/api/sessions/s1/ws', 'http://localhost:5173')).toBe(true)
  })

  it('trusts a Pages preview calling its own co-located Functions only', () => {
    const preview = 'https://abc123.qesto.pages.dev/api/sessions/s1/ws'
    expect(isTrustedBrowserOrigin(PROD, preview, 'https://abc123.qesto.pages.dev')).toBe(true)
    expect(isTrustedBrowserOrigin(PROD, URL_PROD, 'https://abc123.qesto.pages.dev')).toBe(false)
  })
})
