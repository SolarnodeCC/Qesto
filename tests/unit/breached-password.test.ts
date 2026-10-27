/**
 * Requirement: issue #908 (DD-36) — new passwords are screened against breach
 * corpora (NIST SP 800-63B §5.1.1.2): a bundled common-password denylist
 * always, plus an HIBP k-anonymity lookup that sends only a 5-char SHA-1
 * prefix and fails open.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  isBreachedPassword,
  isCommonPassword,
  isPwnedViaHibp,
} from '../../functions/api/lib/breached-password'

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = '5BAA6'
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'

function fakeFetch(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch
}

describe('breached password screening (DD-36)', () => {
  it('denylists common passwords case-insensitively', () => {
    expect(isCommonPassword('Password123')).toBe(true)
    expect(isCommonPassword('correct horse battery staple')).toBe(false)
  })

  it('sends only the 5-char prefix to HIBP and matches the suffix', async () => {
    const f = fakeFetch(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${SUFFIX}:3861493\r\n`)
    expect(await isPwnedViaHibp('password', f)).toBe(true)
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])
    expect(url.endsWith(`/range/${PREFIX}`)).toBe(true)
    expect(url).not.toContain(SUFFIX)
  })

  it('ignores padding entries with a zero count', async () => {
    expect(await isPwnedViaHibp('password', fakeFetch(`${SUFFIX}:0\n`))).toBe(false)
  })

  it('fails open on HTTP errors and network failures', async () => {
    expect(await isPwnedViaHibp('password', fakeFetch('', 503))).toBe(false)
    const boom = vi.fn(async () => {
      throw new Error('timeout')
    }) as unknown as typeof fetch
    expect(await isPwnedViaHibp('password', boom)).toBe(false)
  })

  it('only calls HIBP when BREACHED_PASSWORD_CHECK=hibp', async () => {
    const f = fakeFetch(`${SUFFIX}:5\n`)
    expect(await isBreachedPassword({}, 'unusual-but-pwned', f)).toBe(false)
    expect(f).not.toHaveBeenCalled()
    expect(await isBreachedPassword({ BREACHED_PASSWORD_CHECK: 'hibp' }, 'Password123', f)).toBe(true)
  })
})
