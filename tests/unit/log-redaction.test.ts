/**
 * Requirement: issue #906 (DD-34) — the PII redactor must not erase git SHAs or
 * SHA-1 digests, which incident responders need, while still redacting real
 * labelled tokens. Also pins that stack traces keep their full 2048-char budget
 * rather than the 256-char message cap.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { redactSecrets, safeLogContext } from '../../functions/api/lib/log'

const GIT_SHA = '44f6ff3a1b2c3d4e5f60718293a4b5c6d7e8f901'

describe('redactSecrets (DD-34)', () => {
  it('keeps a bare 40-char git SHA', () => {
    expect(redactSecrets(`deploy commit ${GIT_SHA} failed`)).toBe(
      `deploy commit ${GIT_SHA} failed`,
    )
  })

  it('redacts a labelled 40-char token but keeps the label', () => {
    const out = redactSecrets(`token=${GIT_SHA}`)
    expect(out).toBe('token=[REDACTED]')
    expect(redactSecrets(`"authorization": "${GIT_SHA}"`)).toContain('[REDACTED]')
    expect(redactSecrets(`"authorization": "${GIT_SHA}"`)).not.toContain(GIT_SHA)
  })

  it('redacts cfat_-prefixed Cloudflare tokens', () => {
    const tok = 'cfat_' + 'Ab1'.repeat(16)
    expect(redactSecrets(`using ${tok}`)).toBe('using [REDACTED]')
  })

  it('does not mangle identifiers that merely contain "re_"', () => {
    expect(redactSecrets('store_kv failed; are_open=false')).toBe(
      'store_kv failed; are_open=false',
    )
    expect(redactSecrets('key re_AbCdEfGh12345678XyZ leaked')).toBe('key [REDACTED] leaked')
  })

  it('still redacts emails and JWTs', () => {
    expect(redactSecrets('mail a.b@example.com')).toBe('mail [REDACTED]')
    expect(redactSecrets('eyJhbGc.eyJzdWIi.sig')).toBe('[REDACTED]')
  })
})

describe('safeLogContext stack budget', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps stacks beyond 256 chars', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    err.stack = 'Error: boom\n' + '    at frame (file.ts:1:1)\n'.repeat(40)
    safeLogContext(err, { traceId: 't', route: '/x', errorClass: 'Error' })
    const entry = JSON.parse(String(spy.mock.calls[0]?.[0]))
    expect(entry.stack.length).toBeGreaterThan(256)
    expect(entry.stack.length).toBeLessThanOrEqual(2048)
  })
})
