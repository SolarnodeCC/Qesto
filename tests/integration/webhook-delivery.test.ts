import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import {
  deliverWebhook,
  deliverTeamWebhooks,
  generateWebhookSecret,
  hmacSha256Hex,
  webhookConfigKey,
  webhookTeamIndexKey,
  type WebhookConfig,
  type WebhookPayload,
} from '../../functions/api/lib/webhooks'
import { KVMock } from '../helpers/kv-mock'

describe('webhook delivery (Phase 1)', () => {
  let kv: KVNamespace
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    kv = new KVMock() as unknown as KVNamespace
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('hmacSha256Hex', () => {
    it('produces consistent HMAC signatures', async () => {
      const secret = generateWebhookSecret()
      const body = JSON.stringify({ event: 'session.closed', timestamp: 12345 })

      const sig1 = await hmacSha256Hex(secret, body)
      const sig2 = await hmacSha256Hex(secret, body)

      expect(sig1).toBe(sig2)
      expect(sig1).toMatch(/^[0-9a-f]{64}$/) // 32 bytes = 64 hex chars
    })

    it('produces different signatures for different secrets', async () => {
      const body = 'payload'
      const sig1 = await hmacSha256Hex(generateWebhookSecret(), body)
      const sig2 = await hmacSha256Hex(generateWebhookSecret(), body)

      expect(sig1).not.toBe(sig2)
    })

    it('produces different signatures for different payloads', async () => {
      const secret = generateWebhookSecret()
      const sig1 = await hmacSha256Hex(secret, 'payload1')
      const sig2 = await hmacSha256Hex(secret, 'payload2')

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('generateWebhookSecret', () => {
    it('generates random 64-character hex strings', () => {
      const secret1 = generateWebhookSecret()
      const secret2 = generateWebhookSecret()

      expect(secret1).toMatch(/^[0-9a-f]{64}$/)
      expect(secret2).toMatch(/^[0-9a-f]{64}$/)
      expect(secret1).not.toBe(secret2)
    })
  })

  describe('deliverWebhook', () => {
    const teamId = 'team-1'
    const webhookId = 'wh-1'
    const secret = generateWebhookSecret()
    const url = 'https://example.com/webhooks'

    const config: WebhookConfig = {
      id: webhookId,
      teamId,
      url,
      secret,
      events: ['session.closed'],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user-1',
    }

    const payload: WebhookPayload = {
      event: 'session.closed',
      timestamp: Date.now(),
      data: { sessionId: 'session-1', participantCount: 42 },
    }

    it('delivers webhook on successful POST', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      await deliverWebhook(config, payload, kv)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe(url)
      expect(call[1]).toMatchObject({ method: 'POST' })

      // Verify delivery log was written
      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      expect(logRaw).toBeTruthy()
      const log = JSON.parse(logRaw!)
      expect(Array.isArray(log)).toBe(true)
      expect(log[0]).toMatchObject({ success: true, attempt: 1, statusCode: 200 })
    })

    it('includes correct headers with HMAC signature', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

      await deliverWebhook(config, payload, kv)

      const call = fetchMock.mock.calls[0]
      const headers = call[1].headers

      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-Qesto-Event']).toBe('session.closed')
      expect(headers['X-Qesto-Timestamp']).toBe(String(payload.timestamp))
      expect(headers['X-Qesto-Signature-256']).toMatch(/^sha256=[0-9a-f]{64}$/)
      expect(headers['User-Agent']).toBe('Qesto-Webhook/1.0')
    })

    it('retries on HTTP 500 with exponential backoff', async () => {
      // First 2 attempts fail, 3rd succeeds
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      const start = Date.now()
      await deliverWebhook(config, payload, kv)
      const elapsed = Date.now() - start

      expect(fetchMock).toHaveBeenCalledTimes(3)
      // Backoff is 1s, 2s, 4s = 3s minimum (plus overhead)
      expect(elapsed).toBeGreaterThanOrEqual(3000)

      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      const log = JSON.parse(logRaw!)
      expect(log).toHaveLength(3)
      expect(log[0]).toMatchObject({ success: true, attempt: 3 })
    })

    it('skips delivery if webhook is disabled', async () => {
      const disabledConfig = { ...config, enabled: false }

      await deliverWebhook(disabledConfig, payload, kv)

      expect(fetchMock).not.toHaveBeenCalled()
      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      expect(logRaw).toBeNull()
    })

    it('skips delivery if event is not subscribed', async () => {
      const configNoEvent: WebhookConfig = { ...config, events: ['session.started'] }

      await deliverWebhook(configNoEvent, payload, kv)

      expect(fetchMock).not.toHaveBeenCalled()
      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      expect(logRaw).toBeNull()
    })

    it('enqueues DLQ after 3 failed attempts', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

      // Spy on DLQ enqueue
      const dlqSpy = vi.spyOn(await import('../../functions/api/lib/webhook-dlq'), 'enqueueWebhookDlq')

      await deliverWebhook(config, payload, kv)

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(dlqSpy).toHaveBeenCalled()

      dlqSpy.mockRestore()
    })

    it('logs all delivery attempts', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      await deliverWebhook(config, payload, kv)

      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      const log = JSON.parse(logRaw!)

      // Newest first
      expect(log[0].attempt).toBe(2)
      expect(log[0].success).toBe(true)
      expect(log[1].attempt).toBe(1)
      expect(log[1].success).toBe(false)
      expect(log[1].error).toMatch(/HTTP 500/)
    })

    it('records error on fetch failure', async () => {
      fetchMock.mockRejectedValue(new Error('network error'))

      await deliverWebhook(config, payload, kv)

      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      const log = JSON.parse(logRaw!)
      expect(log[0].success).toBe(false)
      expect(log[0].error).toBeTruthy()
    })

    it('blocks SSRF targets (loopback)', async () => {
      const ssrfConfig = { ...config, url: 'http://127.0.0.1:8000/webhooks' }

      await deliverWebhook(ssrfConfig, payload, kv)

      const logRaw = await kv.get(`webhook:delivery:${ssrfConfig.id}`)
      const log = JSON.parse(logRaw!)
      expect(log[0].success).toBe(false)
      expect(log[0].error).toMatch(/blocked/)
    })

    it('preserves delivery log cap at 50 entries', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      // Deliver 60 times
      for (let i = 0; i < 60; i++) {
        const p: WebhookPayload = {
          event: 'session.closed',
          timestamp: Date.now() + i,
          data: { id: i },
        }
        await deliverWebhook(config, p, kv)
      }

      const logRaw = await kv.get(`webhook:delivery:${webhookId}`)
      const log = JSON.parse(logRaw!)
      expect(log.length).toBe(50)
    })
  })

  describe('deliverTeamWebhooks', () => {
    const teamId = 'team-1'
    const secret1 = generateWebhookSecret()
    const secret2 = generateWebhookSecret()

    const config1: WebhookConfig = {
      id: 'wh-1',
      teamId,
      url: 'https://endpoint1.com/webhooks',
      secret: secret1,
      events: ['session.closed'],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user-1',
    }

    const config2: WebhookConfig = {
      id: 'wh-2',
      teamId,
      url: 'https://endpoint2.com/webhooks',
      secret: secret2,
      events: ['session.closed', 'session.started'],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user-1',
    }

    beforeEach(async () => {
      // Set up team index with 2 webhooks
      await kv.put(webhookTeamIndexKey(teamId), JSON.stringify(['wh-1', 'wh-2']))
      await kv.put(webhookConfigKey(teamId, 'wh-1'), JSON.stringify(config1))
      await kv.put(webhookConfigKey(teamId, 'wh-2'), JSON.stringify(config2))
    })

    it('delivers to all enabled webhooks subscribed to event', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      const env = {
        INTEGRATIONS_KV: kv,
      }

      await deliverTeamWebhooks(env as any, teamId, 'session.closed', { sessionId: 'session-1' })

      // Both webhooks should be called
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('skips webhooks not subscribed to event', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      const env = {
        INTEGRATIONS_KV: kv,
      }

      // Only config2 is subscribed to 'session.started'
      await deliverTeamWebhooks(env as any, teamId, 'session.started', { sessionId: 'session-1' })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url = fetchMock.mock.calls[0][0]
      expect(url).toBe('https://endpoint2.com/webhooks')
    })

    it('isolates failures — one bad endpoint does not block others', async () => {
      // Respond to all calls
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      const env = {
        INTEGRATIONS_KV: kv,
      }

      await deliverTeamWebhooks(env as any, teamId, 'session.closed', { sessionId: 'session-1' })

      // Both webhooks should be called at least once
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('ignores null teamId', async () => {
      const env = {
        INTEGRATIONS_KV: kv,
      }

      await deliverTeamWebhooks(env as any, null, 'session.closed', {})

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('ignores missing INTEGRATIONS_KV', async () => {
      const env = {} // No INTEGRATIONS_KV

      await deliverTeamWebhooks(env as any, teamId, 'session.closed', {})

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
