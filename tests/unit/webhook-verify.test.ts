import { describe, it, expect } from 'vitest'
import { verifyHMAC } from '../../functions/api/lib/integrations/webhook-verify'

describe('webhook-verify (INT-PROVIDER-01)', () => {
  it('verifyHMAC accepts matching sha256 signature', async () => {
    const secret = 'whsec_test_secret'
    const payload = '{"event":"session.closed"}'
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    expect(await verifyHMAC(payload, hex, secret)).toBe(true)
    expect(await verifyHMAC(payload, 'deadbeef', secret)).toBe(false)
  })
})
