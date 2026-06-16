// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  __resetUserPreferencesForTests,
  loadUserPreferences,
  setUserPreferencesAuthKnown,
} from '../../src/lib/user-preferences'

describe('loadUserPreferences auth gate', () => {
  beforeEach(() => {
    __resetUserPreferencesForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call the API before auth is known', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not call the API when auth resolves to anonymous', async () => {
    setUserPreferencesAuthKnown(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches with credentials when authenticated (HttpOnly cookie path)', async () => {
    setUserPreferencesAuthKnown(true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { density: 'compact' } }), { status: 200 }),
    )
    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({ density: 'compact' })
    expect(fetchSpy).toHaveBeenCalledWith('/api/users/preferences', { credentials: 'include' })
  })
})
