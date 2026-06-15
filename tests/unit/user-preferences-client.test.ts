// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadUserPreferences,
  patchUserPreference,
  __resetUserPreferencesForTests,
} from '../../src/lib/user-preferences'

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl) as unknown as typeof fetch)
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>
}

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response
}

describe('user-preferences client', () => {
  beforeEach(() => {
    __resetUserPreferencesForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns server preferences on success', async () => {
    mockFetch(async () => jsonResponse({ ok: true, data: { density: 'compact', colorScheme: 'dark', highContrast: true } }))

    const prefs = await loadUserPreferences()
    expect(prefs).toEqual({ density: 'compact', colorScheme: 'dark', highContrast: true })
  })

  it('memoises the GET so concurrent controls share one request', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ ok: true, data: { density: 'spacious' } }))

    await Promise.all([loadUserPreferences(), loadUserPreferences(), loadUserPreferences()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resolves to empty object when the request fails', async () => {
    mockFetch(async () => {
      throw new Error('offline')
    })

    await expect(loadUserPreferences()).resolves.toEqual({})
  })

  it('resolves to empty object when the body is not ok', async () => {
    mockFetch(async () => jsonResponse({ ok: false }))
    await expect(loadUserPreferences()).resolves.toEqual({})
  })

  it('PATCHes the changed preference and folds it into the cache', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ ok: true, data: { density: 'comfortable' } }))

    await loadUserPreferences()
    patchUserPreference({ colorScheme: 'light' })

    // PATCH issued with the partial payload
    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    expect(patchCall).toBeTruthy()
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ colorScheme: 'light' })

    // Subsequent reads see the optimistic value without another GET
    const prefs = await loadUserPreferences()
    expect(prefs.colorScheme).toBe('light')
    expect(prefs.density).toBe('comfortable')
  })

  it('never rejects even if PATCH fails', async () => {
    mockFetch(async () => {
      throw new Error('offline')
    })
    expect(() => patchUserPreference({ highContrast: true })).not.toThrow()
  })
})
