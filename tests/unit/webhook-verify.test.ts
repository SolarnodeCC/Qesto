import { describe, it, expect } from 'vitest'
import {
  verifyAirtableSignature,
  verifyHMAC,
  verifySlackRequest,
  verifyWebhookAndParse,
} from '../../functions/api/lib/integrations/webhook-verify'

async function signHex(payload: string, testSigningSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(testSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signBase64(payload: string, testSigningSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(testSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Buffer.from(sig).toString('base64')
}

describe('webhook-verify (INT-PROVIDER-01)', () => {
  it('verifyHMAC accepts matching sha256 signature', async () => {
    const testSigningSecret = 'whsec_test_secret'
    const payload = '{"event":"session.closed"}'
    const hex = await signHex(payload, testSigningSecret)
    expect(await verifyHMAC(payload, hex, testSigningSecret)).toBe(true)
    expect(await verifyHMAC(payload, 'deadbeef', testSigningSecret)).toBe(false)
  })

  it('accepts Slack signed requests with the provider v0 prefix', async () => {
    const testSigningSecret = 'slack_signing_secret'
    const body = '{"type":"event_callback","team_id":"T123"}'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = await signHex(`v0:${timestamp}:${body}`, testSigningSecret)
    const req = new Request('https://qesto.test/webhooks/slack', {
      method: 'POST',
      headers: {
        'X-Slack-Request-Timestamp': timestamp,
        'X-Slack-Signature': `v0=${signature}`,
      },
      body,
    })

    expect(await verifySlackRequest(req, testSigningSecret)).toBe(true)
  })

  it('rejects Slack replay and malformed timestamp attempts', async () => {
    const testSigningSecret = 'slack_signing_secret'
    const body = '{"type":"event_callback"}'
    const oldTimestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString()
    const oldSignature = await signHex(`v0:${oldTimestamp}:${body}`, testSigningSecret)
    const replayReq = new Request('https://qesto.test/webhooks/slack', {
      method: 'POST',
      headers: {
        'X-Slack-Request-Timestamp': oldTimestamp,
        'X-Slack-Signature': `v0=${oldSignature}`,
      },
      body,
    })
    const malformedTimestamp = 'not-a-timestamp'
    const malformedSignature = await signHex(`v0:${malformedTimestamp}:${body}`, testSigningSecret)
    const malformedReq = new Request('https://qesto.test/webhooks/slack', {
      method: 'POST',
      headers: {
        'X-Slack-Request-Timestamp': malformedTimestamp,
        'X-Slack-Signature': `v0=${malformedSignature}`,
      },
      body,
    })

    expect(await verifySlackRequest(replayReq, testSigningSecret)).toBe(false)
    expect(await verifySlackRequest(malformedReq, testSigningSecret)).toBe(false)
  })

  it('accepts Airtable base64 signatures', async () => {
    const testSigningSecret = 'airtable_webhook_secret'
    const body = '{"base":{"id":"app123"},"payloads":[{"id":"evt1"}]}'
    const signature = await signBase64(body, testSigningSecret)
    const req = new Request('https://qesto.test/webhooks/airtable', {
      method: 'POST',
      headers: { 'X-Airtable-Signature': signature },
      body,
    })

    expect(await verifyAirtableSignature(req, testSigningSecret)).toBe(true)
  })

  it('parses verified JSON and rejects invalid provider signatures', async () => {
    const testSigningSecret = 'notion_webhook_secret'
    const body = '{"type":"page.updated","page_id":"page_123"}'
    const signature = await signHex(body, testSigningSecret)
    const validReq = new Request('https://qesto.test/webhooks/notion', {
      method: 'POST',
      headers: { 'X-Notion-Signature': signature },
      body,
    })
    const invalidReq = new Request('https://qesto.test/webhooks/notion', {
      method: 'POST',
      headers: { 'X-Notion-Signature': 'bad-signature' },
      body,
    })

    await expect(verifyWebhookAndParse(validReq, testSigningSecret, 'notion')).resolves.toEqual({
      type: 'page.updated',
      page_id: 'page_123',
    })
    await expect(verifyWebhookAndParse(invalidReq, testSigningSecret, 'notion')).rejects.toThrow(
      'Invalid notion webhook signature',
    )
  })
})
