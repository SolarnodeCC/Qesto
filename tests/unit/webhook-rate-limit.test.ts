import { describe, expect, it } from 'vitest'
import { checkWebhookRateLimit } from '../../functions/api/lib/webhook-rate-limit'

describe('webhook-rate-limit', () => {
  it('allows up to 100 per minute window', async () => {
    const store = new Map<string, string>()
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value)
      },
    } as unknown as KVNamespace

    for (let i = 0; i < 100; i++) {
      expect(await checkWebhookRateLimit(kv, 'team1')).toBe(true)
    }
    expect(await checkWebhookRateLimit(kv, 'team1')).toBe(false)
  })
})
