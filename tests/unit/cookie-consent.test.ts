// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  CONSENT_STORAGE_KEY,
  readConsent,
  writeConsent,
} from '../../src/lib/cookie-consent'
import {
  CLARITY_PROJECT_ID,
  loadClarity,
  __resetClarityForTests,
} from '../../src/lib/clarity'
import { isConsentBannerSuppressed } from '../../src/components/CookieConsentBanner'

describe('cookie-consent storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when the visitor has not decided', () => {
    expect(readConsent()).toBeNull()
  })

  it('round-trips an accepted decision', () => {
    writeConsent('accepted')
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('accepted')
    expect(readConsent()).toBe('accepted')
  })

  it('round-trips a rejected decision', () => {
    writeConsent('rejected')
    expect(readConsent()).toBe('rejected')
  })

  it('treats an unrecognised stored value as undecided', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'maybe')
    expect(readConsent()).toBeNull()
  })
})

describe('Clarity loader (consent-gated)', () => {
  beforeEach(() => {
    __resetClarityForTests()
    delete (window as { clarity?: unknown }).clarity
    document.querySelectorAll('script').forEach((s) => s.remove())
  })

  it('injects exactly one Clarity tag and exposes window.clarity', () => {
    loadClarity()
    const tags = document.querySelectorAll(`script[src*="clarity.ms/tag/${CLARITY_PROJECT_ID}"]`)
    expect(tags.length).toBe(1)
    expect(typeof window.clarity).toBe('function')
  })

  it('is idempotent — repeated calls do not add a second tag', () => {
    loadClarity()
    loadClarity()
    const tags = document.querySelectorAll('script[src*="clarity.ms/tag/"]')
    expect(tags.length).toBe(1)
  })
})

describe('isConsentBannerSuppressed', () => {
  it('suppresses on projected / embedded routes', () => {
    expect(isConsentBannerSuppressed('/display/ABC123')).toBe(true)
    expect(isConsentBannerSuppressed('/sessions/abc/present')).toBe(true)
    expect(isConsentBannerSuppressed('/sessions/abc/townhall')).toBe(true)
    expect(isConsentBannerSuppressed('/th/XYZ/display')).toBe(true)
  })

  it('shows on normal in-app and marketing routes', () => {
    expect(isConsentBannerSuppressed('/')).toBe(false)
    expect(isConsentBannerSuppressed('/join')).toBe(false)
    expect(isConsentBannerSuppressed('/dashboard')).toBe(false)
    expect(isConsentBannerSuppressed('/sessions/abc/results')).toBe(false)
  })
})
