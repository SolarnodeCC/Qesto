import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createApp } from '../../functions/api/app'
import { hmacSha256Hex } from '../../functions/api/lib/webhooks'
import type { Env } from '../../functions/api/types'

describe('POST /api/webhooks/marketing', () => {
  const secret = 'marketing-test-secret-at-least-32-chars!!'

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
  })

  it('rejects invalid HMAC without leaking signature fragments', async () => {
    const app = createApp()
    const env = {
      ENV: 'dev',
      MARKETING_WEBHOOK_SECRET: secret,
      METRICS_KV: undefined,
    } as unknown as Env
    const body = JSON.stringify({
      sessionId: 'sess1',
      isPublic: true,
      language: 'en',
      sessionMode: 'reflection',
      questionCount: 1,
      participantCount: 2,
      responseRate: 0.5,
      durationMinutes: 5,
      energizerUsed: false,
    })

    const res = await app.fetch(
      new Request('http://local/api/webhooks/marketing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-qesto-signature': 'sha256=deadbeef',
        },
        body,
      }),
      env,
    )

    expect(res.status).toBe(401)
  })

  it('accepts valid HMAC signature', async () => {
    const app = createApp()
    const env = {
      ENV: 'dev',
      MARKETING_WEBHOOK_SECRET: secret,
      METRICS_KV: undefined,
    } as unknown as Env
    const body = JSON.stringify({
      sessionId: 'sess1',
      isPublic: true,
      language: 'en',
      sessionMode: 'reflection',
      questionCount: 1,
      participantCount: 2,
      responseRate: 0.5,
      durationMinutes: 5,
      energizerUsed: false,
    })
    const sig = `sha256=${await hmacSha256Hex(secret, body)}`

    const res = await app.fetch(
      new Request('http://local/api/webhooks/marketing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-qesto-signature': sig,
        },
        body,
      }),
      env,
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
  })
})
