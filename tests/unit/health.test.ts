import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'

function fakeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'test-secret',
  } as unknown as Env
}

describe('GET /api/admin/health', () => {
  it('returns ok:true with env and trace_id', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/admin/health'), fakeEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { env: string }; trace_id: string }
    expect(body.ok).toBe(true)
    expect(body.data.env).toBe('dev')
    expect(body.trace_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('echoes incoming x-trace-id when well-formed', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/admin/health', { headers: { 'x-trace-id': 'abcdef1234567890' } }),
      fakeEnv(),
    )
    expect(res.headers.get('x-trace-id')).toBe('abcdef1234567890')
  })

  it('404s unknown routes with envelope', async () => {
    // Use a path outside /api/* so sub-app auth middleware does not intercept
    // before the notFound handler. The envelope format is the same regardless.
    const app = createApp()
    const res = await app.fetch(new Request('http://local/unknown-route-xyz'), fakeEnv())
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('not_found')
  })
})
