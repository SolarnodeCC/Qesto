import { describe, expect, it } from 'vitest'
import { PushPayloadSchema, PushSubscriptionSchema } from '../../functions/api/lib/pwa-push'

describe('pwa-push', () => {
  it('validates subscription shape', () => {
    const sub = PushSubscriptionSchema.parse({
      endpoint: 'https://push.example/send/abc',
      keys: { p256dh: 'key', auth: 'auth' },
    })
    expect(sub.endpoint).toContain('https://')
  })

  it('validates push payload', () => {
    const p = PushPayloadSchema.parse({
      title: 'Live',
      body: 'Question open',
      tag: 'session-1',
      url: 'https://qesto.cc/j/ABC',
    })
    expect(p.tag).toBe('session-1')
  })
})
