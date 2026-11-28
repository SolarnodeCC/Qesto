/**
 * Requirement: SPEC_FRONTEND error handling + ADR-0009 PII logging — browser crashes are reported, redacted, and never stored.
 */
import { describe, expect, it, vi } from 'vitest'
import { testHonoApp } from './setup'

function post(app: Awaited<ReturnType<typeof testHonoApp>>['app'], env: unknown, body: unknown) {
  return app.fetch(
    new Request('http://local/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-qesto-client': 'web', origin: 'http://local' },
      body: JSON.stringify(body),
    }),
    env as never,
  )
}

describe('POST /api/client-errors', () => {
  it('accepts an anonymous crash report and logs it redacted', async () => {
    const { app, env } = await testHonoApp()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post(app, env, {
      kind: 'render',
      message: 'Cannot read properties of undefined (user alice@example.com)',
      stack: 'at Dashboard (https://qesto.cc/assets/index.js:1:2)',
      path: '/dashboard?token=abc',
    })
    expect(res.status).toBe(204)
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n')
    spy.mockRestore()
    expect(logged).toContain('Client_render')
    expect(logged).not.toContain('alice@example.com')
    expect(logged).not.toContain('token=abc')
  })

  it('rejects malformed reports', async () => {
    const { app, env } = await testHonoApp()
    const res = await post(app, env, { kind: 'nope', message: '' })
    expect(res.status).toBe(400)
  })
})
