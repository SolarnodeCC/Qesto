/**
 * Requirement: GDPR Art. 32 / SPEC_BACKEND logging — no credentials or participant IPs in logs (2026-11 go-live review).
 */
import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../../functions/api/lib/log'

describe('redactSecrets — credential URLs, hex tokens, IPs', () => {
  it('redacts a magic-link token in a URL', () => {
    const token = 'a1'.repeat(32)
    const out = redactSecrets(`Sign in: https://qesto.cc/api/auth/callback?token=${token}&next=/dashboard`)
    expect(out).not.toContain(token)
    expect(out).toContain('token=[REDACTED]')
    expect(out).toContain('next=/dashboard')
  })

  it('redacts bare 64-hex tokens but keeps 40-hex git SHAs', () => {
    const sha = '92cc253d74032cae6580b2b1626875b5777aa7b3'
    const tok = 'f'.repeat(64)
    const out = redactSecrets(`commit ${sha} token ${tok}`)
    expect(out).toContain(sha)
    expect(out).not.toContain(tok)
  })

  it('redacts IPv4 addresses', () => {
    expect(redactSecrets('from 203.0.113.7 ok')).toBe('from [REDACTED] ok')
  })
})
