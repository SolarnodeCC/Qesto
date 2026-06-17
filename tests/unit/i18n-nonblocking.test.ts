// @vitest-environment jsdom
//
// LCP render-delay fix: English locales are bundled and seeded synchronously, so
// the app renders correct English copy on first paint with NO network round-trip
// and `initI18n()` no longer needs to be awaited before render. These tests lock
// in that contract:
//   1. English is available synchronously at import time (no fetch, no raw keys).
//   2. An English visitor's initI18n() performs zero network requests.
//   3. A non-English load overlays onto the bundled English baseline (which doubles
//      as the missing-key fallback) — so incomplete locales never show raw keys.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Each test gets a fresh module instance: the i18n module memoises initPromise and
// mutates module-level currentLanguage/cachedLocales, so isolation prevents bleed.
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('i18n non-blocking init (LCP render-delay fix)', () => {
  it('seeds English synchronously at import — before any init or fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { getLoadedLocales, getCurrentLanguage } = await import('../../src/i18n')

    const locales = getLoadedLocales()
    // Namespaces are present without ever calling initI18n().
    expect(Object.keys(locales).length).toBeGreaterThan(0)
    expect(locales['common']?.['save']).toBe('Save')
    expect(locales['home']).toBeDefined()
    expect(getCurrentLanguage()).toBe('en')
    // No network was touched to make English available.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('performs no network requests for an English visitor', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    // jsdom navigator.language defaults to en-US → detectLanguage() resolves 'en'.

    const { initI18n, getCurrentLanguage } = await import('../../src/i18n')
    await initI18n()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getCurrentLanguage()).toBe('en')
  })

  it('overlays a non-English locale onto the bundled English baseline', async () => {
    // Mock only a partial Dutch "common" namespace; everything else 404s so the
    // English baseline must fill the gaps.
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url === '/locales/nl/common.json') {
        return { ok: true, json: async () => ({ save: 'Opslaan' }) } as Response
      }
      return { ok: false, json: async () => ({}) } as Response
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { setLanguage, getLoadedLocales, getCurrentLanguage } = await import('../../src/i18n')
    await setLanguage('nl')

    expect(getCurrentLanguage()).toBe('nl')
    const common = getLoadedLocales()['common']!
    // Translated key wins…
    expect(common['save']).toBe('Opslaan')
    // …and a key absent from the Dutch file falls back to bundled English.
    expect(common['cancel']).toBe('Cancel')
    // A namespace with no Dutch file at all still resolves to English.
    expect(getLoadedLocales()['home']).toBeDefined()
  })
})
