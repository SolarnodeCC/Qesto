import { describe, expect, it, beforeEach } from 'vitest'
import {
  PushSubscriptionSchema,
  PushPayloadSchema,
  savePushSubscription,
  loadPushSubscription,
  deletePushSubscription,
  getVapidPublicKey,
  isPushConfigured,
  pushSubscriptionKvKey,
} from '../../functions/api/lib/pwa-push'
import { KVMock } from '../helpers/kv-mock'

describe('pwa-push lib (Phase 1)', () => {
  let kv: KVNamespace

  beforeEach(() => {
    kv = new KVMock() as unknown as KVNamespace
  })

  describe('PushSubscriptionSchema', () => {
    it('validates correct Web Push subscription', () => {
      const valid = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: {
          auth: 'base64auth',
          p256dh: 'base64p256dh',
        },
      }

      const result = PushSubscriptionSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects invalid endpoint URL', () => {
      const invalid = {
        endpoint: 'not-a-url',
        keys: {
          auth: 'base64auth',
          p256dh: 'base64p256dh',
        },
      }

      const result = PushSubscriptionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects missing keys.auth', () => {
      const invalid = {
        endpoint: 'https://example.com',
        keys: {
          p256dh: 'base64p256dh',
        },
      }

      const result = PushSubscriptionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects missing keys.p256dh', () => {
      const invalid = {
        endpoint: 'https://example.com',
        keys: {
          auth: 'base64auth',
        },
      }

      const result = PushSubscriptionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('accepts optional userAgent', () => {
      const withUserAgent = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: {
          auth: 'base64auth',
          p256dh: 'base64p256dh',
        },
        userAgent: 'Mozilla/5.0...',
      }

      const result = PushSubscriptionSchema.safeParse(withUserAgent)
      expect(result.success).toBe(true)
    })
  })

  describe('PushPayloadSchema', () => {
    it('validates correct push payload', () => {
      const valid = {
        title: 'Test Notification',
        body: 'This is a test',
        url: 'https://example.com',
        sessionId: 'session-123',
      }

      const result = PushPayloadSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('requires title', () => {
      const invalid = {
        body: 'No title',
      }

      const result = PushPayloadSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('allows empty title to fail', () => {
      const invalid = {
        title: '',
        body: 'Body',
      }

      const result = PushPayloadSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('defaults empty body to empty string', () => {
      const valid = {
        title: 'Title only',
      }

      const result = PushPayloadSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.body).toBe('')
      }
    })

    it('accepts optional url and sessionId', () => {
      const valid = {
        title: 'Notification',
        url: 'https://example.com',
        tag: 'unique-tag',
        sessionId: 'session-xyz',
      }

      const result = PushPayloadSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('savePushSubscription', () => {
    it('saves subscription under user key', async () => {
      const userId = 'user-1'
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/token123',
        keys: {
          auth: 'auth123',
          p256dh: 'p256dh123',
        },
      }

      await savePushSubscription(kv, userId, subscription)

      const stored = await kv.get(pushSubscriptionKvKey(userId))
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.endpoint).toBe(subscription.endpoint)
      expect(parsed.keys).toEqual(subscription.keys)
    })

    it('includes updatedAt timestamp', async () => {
      const userId = 'user-2'
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: { auth: 'auth', p256dh: 'p256dh' },
      }

      const before = Date.now()
      await savePushSubscription(kv, userId, subscription)
      const after = Date.now()

      const stored = await kv.get(pushSubscriptionKvKey(userId))
      const parsed = JSON.parse(stored!)

      expect(parsed.updatedAt).toBeGreaterThanOrEqual(before)
      expect(parsed.updatedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('loadPushSubscription', () => {
    it('loads stored subscription', async () => {
      const userId = 'user-3'
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: { auth: 'auth', p256dh: 'p256dh' },
      }

      await savePushSubscription(kv, userId, subscription)
      const loaded = await loadPushSubscription(kv, userId)

      expect(loaded).toBeTruthy()
      expect(loaded?.endpoint).toBe(subscription.endpoint)
      expect(loaded?.keys).toEqual(subscription.keys)
    })

    it('returns null for nonexistent user', async () => {
      const loaded = await loadPushSubscription(kv, 'nonexistent-user')
      expect(loaded).toBeNull()
    })

    it('returns null for malformed data', async () => {
      const userId = 'user-4'
      await kv.put(pushSubscriptionKvKey(userId), '{invalid json')

      const loaded = await loadPushSubscription(kv, userId)
      expect(loaded).toBeNull()
    })

    it('validates loaded data against schema', async () => {
      const userId = 'user-5'
      // Store invalid data directly
      await kv.put(pushSubscriptionKvKey(userId), JSON.stringify({ endpoint: 'not-a-url', keys: {} }))

      const loaded = await loadPushSubscription(kv, userId)
      expect(loaded).toBeNull()
    })
  })

  describe('deletePushSubscription', () => {
    it('deletes subscription', async () => {
      const userId = 'user-6'
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: { auth: 'auth', p256dh: 'p256dh' },
      }

      await savePushSubscription(kv, userId, subscription)
      await deletePushSubscription(kv, userId)

      const loaded = await loadPushSubscription(kv, userId)
      expect(loaded).toBeNull()
    })

    it('handles deleting nonexistent subscription', async () => {
      // Should not throw
      await expect(deletePushSubscription(kv, 'nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('getVapidPublicKey', () => {
    it('returns VAPID public key from env', () => {
      const env = { VAPID_PUBLIC_KEY: 'public_key_123' }
      const key = getVapidPublicKey(env)

      expect(key).toBe('public_key_123')
    })

    it('returns null when VAPID_PUBLIC_KEY not set', () => {
      const env = {}
      const key = getVapidPublicKey(env)

      expect(key).toBeNull()
    })

    it('returns null when VAPID_PUBLIC_KEY is empty', () => {
      const env = { VAPID_PUBLIC_KEY: '' }
      const key = getVapidPublicKey(env)

      expect(key).toBeNull()
    })

    it('trims whitespace', () => {
      const env = { VAPID_PUBLIC_KEY: '  public_key_123  ' }
      const key = getVapidPublicKey(env)

      expect(key).toBe('public_key_123')
    })
  })

  describe('isPushConfigured', () => {
    it('returns true when both keys are present', () => {
      const env = {
        VAPID_PUBLIC_KEY: 'public',
        VAPID_PRIVATE_KEY: 'private',
      }

      expect(isPushConfigured(env)).toBe(true)
    })

    it('returns false when VAPID_PUBLIC_KEY missing', () => {
      const env = { VAPID_PRIVATE_KEY: 'private' }

      expect(isPushConfigured(env)).toBe(false)
    })

    it('returns false when VAPID_PRIVATE_KEY missing', () => {
      const env = { VAPID_PUBLIC_KEY: 'public' }

      expect(isPushConfigured(env)).toBe(false)
    })

    it('returns false when both keys empty', () => {
      const env = {
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
      }

      expect(isPushConfigured(env)).toBe(false)
    })

    it('ignores whitespace', () => {
      const env = {
        VAPID_PUBLIC_KEY: '  public  ',
        VAPID_PRIVATE_KEY: '  private  ',
      }

      expect(isPushConfigured(env)).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('complete subscription lifecycle', async () => {
      const userId = 'user-7'
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device123',
        keys: {
          auth: 'base64auth',
          p256dh: 'base64p256dh',
        },
      }

      // Save
      await savePushSubscription(kv, userId, subscription)

      // Load
      let loaded = await loadPushSubscription(kv, userId)
      expect(loaded).toEqual(subscription)

      // Delete
      await deletePushSubscription(kv, userId)
      loaded = await loadPushSubscription(kv, userId)
      expect(loaded).toBeNull()
    })
  })
})
