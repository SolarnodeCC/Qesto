import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDlqDeliveryFn,
  DLQ_MAX_RETRY_ATTEMPTS,
  enqueueWebhookDlq,
  listWebhookDlq,
  retryWebhookDlqEntry,
  webhookDlqKey,
  type WebhookDlqEntry,
} from '../../functions/api/lib/webhook-dlq'
import { KVMock } from '../helpers/kv-mock'

const TEAM_ID = 'team_1'

function asKv(kv: KVMock): KVNamespace {
  return kv as unknown as KVNamespace
}

function dlqEntry(overrides: Partial<WebhookDlqEntry> = {}): WebhookDlqEntry {
  return {
    id: 'entry_1',
    webhookId: 'webhook_1',
    teamId: TEAM_ID,
    event: 'session.closed',
    url: 'https://hooks.example.com/qesto',
    payload: { sessionId: 'session_1' },
    error: 'HTTP 500',
    attempts: 1,
    enqueuedAt: Date.now(),
    ...overrides,
  }
}

async function seed(kv: KVMock, entries: WebhookDlqEntry[]) {
  await kv.put(webhookDlqKey(TEAM_ID), JSON.stringify(entries))
}

describe('webhook DLQ retry helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T18:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps only the 100 most recent dead-letter entries', async () => {
    const kv = new KVMock()

    for (let i = 0; i < 101; i += 1) {
      await enqueueWebhookDlq(asKv(kv), {
        webhookId: `webhook_${i}`,
        teamId: TEAM_ID,
        event: 'session.closed',
        url: 'https://hooks.example.com/qesto',
        payload: { index: i },
        error: 'HTTP 500',
        attempts: 1,
      })
    }

    const entries = await listWebhookDlq(asKv(kv), TEAM_ID)
    expect(entries).toHaveLength(100)
    expect(entries[0].webhookId).toBe('webhook_100')
    expect(entries.at(-1)?.webhookId).toBe('webhook_1')
  })

  it('removes an entry after a successful retry delivery', async () => {
    const kv = new KVMock()
    const entry = dlqEntry()
    await seed(kv, [entry])
    const deliver = vi.fn(async () => ({ success: true }))

    const result = await retryWebhookDlqEntry(asKv(kv), TEAM_ID, entry.id, deliver)

    expect(result).toEqual({ ok: true, delivered: true })
    expect(deliver).toHaveBeenCalledWith(entry)
    await expect(listWebhookDlq(asKv(kv), TEAM_ID)).resolves.toEqual([])
  })

  it('increments attempts and preserves the entry after a failed retry below the ceiling', async () => {
    const kv = new KVMock()
    await seed(kv, [dlqEntry({ attempts: 2, error: 'HTTP 500' })])

    const result = await retryWebhookDlqEntry(asKv(kv), TEAM_ID, 'entry_1', async () => ({
      success: false,
      error: 'HTTP 503',
    }))

    expect(result).toEqual({ ok: false, reason: 'delivery_failed', error: 'HTTP 503' })
    await expect(listWebhookDlq(asKv(kv), TEAM_ID)).resolves.toMatchObject([
      { id: 'entry_1', attempts: 3, error: 'HTTP 503' },
    ])
  })

  it('drops entries at the max-attempt ceiling without retrying delivery', async () => {
    const kv = new KVMock()
    await seed(kv, [dlqEntry({ attempts: DLQ_MAX_RETRY_ATTEMPTS })])
    const deliver = vi.fn(async () => ({ success: true }))

    const result = await retryWebhookDlqEntry(asKv(kv), TEAM_ID, 'entry_1', deliver)

    expect(result).toEqual({ ok: false, reason: 'max_attempts_exceeded' })
    expect(deliver).not.toHaveBeenCalled()
    await expect(listWebhookDlq(asKv(kv), TEAM_ID)).resolves.toEqual([])
  })

  it('revalidates stored DLQ targets and blocks SSRF replay before signing or fetch', async () => {
    const fetchMock = vi.fn()
    const hmac = vi.fn(async () => 'signature')
    vi.stubGlobal('fetch', fetchMock)
    const deliver = await buildDlqDeliveryFn({ url: 'https://hooks.example.com/qesto', secret: 'secret' }, hmac)

    const result = await deliver(dlqEntry({ url: 'https://127.0.0.1/webhook' }))

    expect(result.success).toBe(false)
    expect(result.error).toContain('blocked:')
    expect(hmac).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signs and posts a stored DLQ event on replay', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const hmac = vi.fn(async () => 'signed-payload')
    vi.stubGlobal('fetch', fetchMock)
    const deliver = await buildDlqDeliveryFn({ url: 'https://hooks.example.com/qesto', secret: 'secret' }, hmac)

    const result = await deliver(dlqEntry())

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/qesto')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Qesto-Event': 'session.closed',
      'X-Qesto-Signature-256': 'sha256=signed-payload',
      'User-Agent': 'Qesto-Webhook-Retry/1.0',
    })
    expect(JSON.parse(init.body as string)).toEqual({
      event: 'session.closed',
      timestamp: Date.now(),
      data: { sessionId: 'session_1' },
    })
    expect(hmac).toHaveBeenCalledWith('secret', init.body)
  })
})
