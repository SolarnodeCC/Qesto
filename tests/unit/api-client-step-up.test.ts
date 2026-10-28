/**
 * Requirement: issue #877 (DD-04) — when an action answers 403
 * `mfa_step_up_required`, the SPA asks for a code once (shared across
 * concurrent requests) and retries the original request; cancelling returns
 * the original error.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, setStepUpHandler } from '../../src/api/client'

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
const stepUp = () => respond(403, { ok: false, error: { code: 'mfa_step_up_required', message: 'confirm' } })
const ok = () => respond(200, { ok: true, data: { done: true } })

afterEach(() => {
  setStepUpHandler(null)
  vi.unstubAllGlobals()
})

describe('api() step-up retry', () => {
  it('prompts, then retries the original request once', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(stepUp()).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', fetchMock)
    const handler = vi.fn().mockResolvedValue(true)
    setStepUpHandler(handler)
    const res = await api<{ done: boolean }>('/api/api-keys', { method: 'POST', body: { name: 'k' } })
    expect(res).toEqual({ ok: true, data: { done: true } })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ name: 'k' }))
  })

  it('returns the original error when the prompt is cancelled', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(stepUp())
    vi.stubGlobal('fetch', fetchMock)
    setStepUpHandler(vi.fn().mockResolvedValue(false))
    const res = await api('/api/teams/t1', { method: 'DELETE' })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error.code).toBe('mfa_step_up_required')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares one prompt across concurrent requests', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => (fetchMock.mock.calls.length <= 2 ? stepUp() : ok()))
    vi.stubGlobal('fetch', fetchMock)
    let release: (v: boolean) => void = () => {}
    const handler = vi.fn(() => new Promise<boolean>((r) => (release = r)))
    setStepUpHandler(handler)
    const both = Promise.all([api('/a', { method: 'POST' }), api('/b', { method: 'POST' })])
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1))
    release(true)
    const [a, b] = await both
    expect(a.ok && b.ok).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('never recurses on the step-up endpoint itself, and leaves other 403s alone', async () => {
    const handler = vi.fn().mockResolvedValue(true)
    setStepUpHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stepUp()))
    await api('/api/auth/mfa/step-up', { method: 'POST', body: {} })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(403, { ok: false, error: { code: 'forbidden', message: 'no' } })))
    await api('/api/x', { method: 'POST' })
    expect(handler).not.toHaveBeenCalled()
  })
})
