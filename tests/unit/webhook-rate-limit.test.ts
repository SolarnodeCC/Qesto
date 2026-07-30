import { describe, expect, it } from 'vitest'
import { checkWebhookRateLimit } from '../../functions/api/lib/webhook-rate-limit'
import type { Env } from '../../functions/api/types'

describe('webhook-rate-limit (ADR-0073)', () => {
  it('allows up to 100 per minute window via atomic KV fallback', async () => {
    const store = new Map<string, string>()
    const kv = {
      get: async (key: string, type?: string) => {
        const v = store.get(key)
        if (v === undefined) return null
        return type === 'json' ? JSON.parse(v) : v
      },
      put: async (key: string, value: string) => {
        store.set(key, value)
      },
    } as unknown as KVNamespace

    const env = { ACTIONS_KV: kv } as Env

    for (let i = 0; i < 100; i++) {
      expect(await checkWebhookRateLimit(env, 'team1')).toBe(true)
    }
    expect(await checkWebhookRateLimit(env, 'team1')).toBe(false)
  })
})
