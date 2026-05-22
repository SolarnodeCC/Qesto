import { describe, it, expect } from 'vitest'
import { validateWebhookTargetUrl } from '../../functions/api/lib/webhook-url'

describe('validateWebhookTargetUrl (WEBHOOK-01 SSRF)', () => {
  it('accepts public https URLs', () => {
    expect(validateWebhookTargetUrl('https://hooks.example.com/qesto')).toEqual({ ok: true })
  })

  it('rejects localhost and loopback', () => {
    expect(validateWebhookTargetUrl('https://localhost/hook').ok).toBe(false)
    expect(validateWebhookTargetUrl('https://127.0.0.1/hook').ok).toBe(false)
  })

  it('rejects RFC1918 private IPv4', () => {
    const r = validateWebhookTargetUrl('https://192.168.1.10/webhook')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ssrf_blocked')
  })

  it('rejects non-https in validator (routes also enforce)', () => {
    const r = validateWebhookTargetUrl('http://example.com/hook')
    expect(r.ok).toBe(false)
  })
})
