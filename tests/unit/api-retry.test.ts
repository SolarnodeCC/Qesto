// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRetry } from '../../src/api/client'

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl) as unknown as typeof fetch)
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('apiRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries do_init_failed then succeeds', async () => {
    let call = 0
    const fetchMock = mockFetch(async () => {
      call++
      if (call === 1) {
        return jsonResponse({ ok: false, error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' } }, 500)
      }
      return jsonResponse({ ok: true, data: { session: { status: 'live' } } })
    })

    const res = await apiRetry<{ session: { status: string } }>('/api/sessions/abc/start', { method: 'POST' }, { backoffMs: 0 })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.session.status).toBe('live')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-retryable error (conflict)', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse({ ok: false, error: { code: 'conflict', message: 'Session could not be started' } }, 409),
    )

    const res = await apiRetry('/api/sessions/abc/start', { method: 'POST' }, { backoffMs: 0 })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('conflict')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retry budget and returns the last error', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse({ ok: false, error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' } }, 500),
    )

    const res = await apiRetry('/api/sessions/abc/start', { method: 'POST' }, { retries: 2, backoffMs: 0 })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('do_init_failed')
    // initial attempt + 2 retries
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
