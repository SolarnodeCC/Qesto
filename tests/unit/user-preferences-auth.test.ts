// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  __resetUserPreferencesForTests,
  loadUserPreferences,
} from '../../src/lib/user-preferences'
import { setAuthToken } from '../../src/api/client'

describe('loadUserPreferences auth gate', () => {
  beforeEach(() => {
    __resetUserPreferencesForTests()
    setAuthToken(null)
    vi.restoreAllMocks()
  })

  afterEach(() => {
    setAuthToken(null)
  })

  it('does not call the API when there is no session cookie or token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls the API when the session cookie is present', async () => {
    document.cookie = 'qesto_session=test.jwt.token'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { density: 'compact' } }), { status: 200 }),
    )
    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({ density: 'compact' })
  })
})
