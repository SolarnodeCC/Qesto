// @vitest-environment jsdom
/**
 * Requirement: SPEC_FRONTEND error handling — a render crash shows a recoverable screen and is reported (no white screen).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary } from '../../src/components/AppErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

afterEach(() => vi.unstubAllGlobals())

describe('AppErrorBoundary', () => {
  it('renders the fallback and reports the crash', () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    errSpy.mockRestore()
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/client-errors')
    expect(JSON.parse(String(init.body)).kind).toBe('render')
  })
})
