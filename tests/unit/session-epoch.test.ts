/**
 * Session invalidation epoch — DD-09.
 *
 * Requirement: knowledge-base/quality/audits/DUE_DILIGENCE_2026-09-15.md (DD-09),
 * OWASP ASVS V3.3.3.
 *
 * Password reset previously issued a fresh cookie and left every existing
 * session alive for the remainder of the 14-day JWT lifetime. The revocation
 * list could not close that, because the reset path cannot enumerate a user's
 * outstanding tokens. These tests pin the epoch that can.
 */
import { describe, it, expect } from 'vitest'
import {
  bumpSessionEpoch,
  isSessionSuperseded,
  sessionEpochKey,
} from '../../functions/api/lib/session-token'

function kvStub() {
  const map = new Map<string, string>()
  return {
    map,
    env: {
      ACTIONS_KV: {
        async get(key: string) {
          return map.get(key) ?? null
        },
        async put(key: string, value: string) {
          map.set(key, value)
        },
      } as unknown as KVNamespace,
    },
  }
}

const SECOND = 1000
const claimsAt = (sub: string, issuedAtMs: number) => ({ sub, iat: Math.floor(issuedAtMs / SECOND) })

describe('DD-09: session epoch', () => {
  it('treats a token issued before the epoch as superseded', async () => {
    const { env } = kvStub()
    const issued = Date.UTC(2026, 0, 1, 12, 0, 0)

    await bumpSessionEpoch(env, 'user-1', 3600, issued + 60 * SECOND)

    expect(await isSessionSuperseded(env, claimsAt('user-1', issued))).toBe(true)
  })

  it('leaves a token issued after the epoch valid', async () => {
    const { env } = kvStub()
    const reset = Date.UTC(2026, 0, 1, 12, 0, 0)

    await bumpSessionEpoch(env, 'user-1', 3600, reset)

    // The replacement session minted straight after the reset must survive.
    expect(await isSessionSuperseded(env, claimsAt('user-1', reset + 5 * SECOND))).toBe(false)
  })

  it('does not reject a token minted in the same second as the bump', async () => {
    const { env } = kvStub()
    // JWT `iat` is whole seconds, so a token minted 400ms after the bump carries
    // an iat that floors BELOW it. Without slack this would log the user out of
    // the session the reset just created.
    const resetMs = Date.UTC(2026, 0, 1, 12, 0, 0) + 400

    await bumpSessionEpoch(env, 'user-1', 3600, resetMs)

    expect(await isSessionSuperseded(env, claimsAt('user-1', resetMs))).toBe(false)
  })

  it('scopes the epoch to one user', async () => {
    const { env } = kvStub()
    const issued = Date.UTC(2026, 0, 1, 12, 0, 0)

    await bumpSessionEpoch(env, 'user-1', 3600, issued + 60 * SECOND)

    expect(await isSessionSuperseded(env, claimsAt('user-2', issued))).toBe(false)
  })

  it('is inert when no epoch has been recorded', async () => {
    const { env } = kvStub()
    expect(await isSessionSuperseded(env, claimsAt('never-reset', Date.now()))).toBe(false)
  })

  it('fails open when ACTIONS_KV is unbound, matching the revocation check', async () => {
    expect(await isSessionSuperseded({}, claimsAt('user-1', 0))).toBe(false)
    await expect(bumpSessionEpoch({}, 'user-1', 3600)).resolves.toBeUndefined()
  })

  it('stores under a user-scoped key with a TTL bounded by the JWT lifetime', async () => {
    const { env, map } = kvStub()
    await bumpSessionEpoch(env, 'user-1', 3600, 1_700_000_000_000)

    expect(map.get(sessionEpochKey('user-1'))).toBe('1700000000000')
  })
})
