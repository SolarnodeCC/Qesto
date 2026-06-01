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

  it('rejects link-local / cloud-metadata address (169.254.169.254)', () => {
    expect(validateWebhookTargetUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false)
  })

  // H-2: numeric IPv4 encodings that previously bypassed the dotted-quad check.
  it('rejects decimal-integer encoding of loopback (2130706433 = 127.0.0.1)', () => {
    const r = validateWebhookTargetUrl('https://2130706433/hook')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('ssrf_blocked')
  })

  it('rejects hex encoding of loopback (0x7f000001)', () => {
    expect(validateWebhookTargetUrl('https://0x7f000001/hook').ok).toBe(false)
  })

  it('rejects octal/short-form encodings of private ranges', () => {
    expect(validateWebhookTargetUrl('https://0177.0.0.1/hook').ok).toBe(false) // octal 127
    expect(validateWebhookTargetUrl('https://10.0.0.1/hook').ok).toBe(false)
  })

  it('rejects IPv4-mapped IPv6 loopback', () => {
    expect(validateWebhookTargetUrl('https://[::ffff:127.0.0.1]/hook').ok).toBe(false)
    expect(validateWebhookTargetUrl('https://[::1]/hook').ok).toBe(false)
  })

  it('still accepts ordinary public hostnames and numeric-looking names', () => {
    expect(validateWebhookTargetUrl('https://hooks.example.com/qesto')).toEqual({ ok: true })
    expect(validateWebhookTargetUrl('https://api.qesto.cc/webhook')).toEqual({ ok: true })
    // A public dotted-quad must still pass.
    expect(validateWebhookTargetUrl('https://93.184.216.34/hook')).toEqual({ ok: true })
  })
})
