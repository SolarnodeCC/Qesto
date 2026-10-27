/**
 * Requirement: issue #895 (DD-23) — impersonation tokens use a signing key
 * separate from sessions, are capped at 30 minutes, must be registered
 * server-side, and stop resolving the moment the acting admin is demoted or
 * the impersonation is ended.
 */
import { describe, expect, it } from 'vitest'
import { signJwt } from '../../functions/api/lib/jwt'
import {
  activeImpersonationKey,
  endImpersonation,
  impersonationSecrets,
  IMPERSONATION_MAX_TTL_SECONDS,
  mintImpersonationToken,
  resolveImpersonation,
} from '../../functions/api/lib/impersonation'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// jankurai:allow HLT-010-SECRET-SPRAWL reason="local HMAC key for test-only JWTs, never used outside this suite" expires=2027-12-31
const SECRET = 'integration-test-secret-at-least-32-bytes!'
const ADMIN = { adminId: 'admin-1', adminEmail: 'admin@example.com' }
const TARGET = { id: 'target-1', email: 'target@example.com' }

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    JWT_SECRET: SECRET,
    SEED_ADMIN_EMAIL: ADMIN.adminEmail,
    DB: new D1Mock() as unknown as D1Database,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
    ...overrides,
  } as unknown as Env
}

describe('impersonation tokens (DD-23)', () => {
  it('resolves a freshly minted, registered token', async () => {
    const env = makeEnv()
    const { token } = await mintImpersonationToken(env, { ...ADMIN, target: TARGET })
    const imp = await resolveImpersonation(env, token)
    expect(imp?.claims.sub).toBe(TARGET.id)
    expect(imp?.impersonatorId).toBe(ADMIN.adminId)
  })

  it('never uses JWT_SECRET itself as the signing key', async () => {
    const secrets = await impersonationSecrets({ JWT_SECRET: SECRET })
    expect(secrets).not.toContain(SECRET)
    expect(await impersonationSecrets({ JWT_SECRET: SECRET, IMPERSONATION_SECRET: 'dedicated' })).toEqual([
      'dedicated',
    ])
  })

  it('rejects an imp:-jti token signed with the session key, even if registered', async () => {
    const env = makeEnv()
    const jti = `imp:${ADMIN.adminId}:forged`
    await env.ACTIONS_KV.put(activeImpersonationKey(jti), JSON.stringify({ ...ADMIN, targetId: TARGET.id }))
    const forged = await signJwt({ sub: TARGET.id, email: TARGET.email, jti }, SECRET, 900)
    expect(await resolveImpersonation(env, forged)).toBeNull()
  })

  it('rejects a correctly signed token with no registry entry', async () => {
    const env = makeEnv()
    const [key] = await impersonationSecrets(env)
    const token = await signJwt({ sub: TARGET.id, email: TARGET.email, jti: 'imp:admin-1:x' }, key!, 900)
    expect(await resolveImpersonation(env, token)).toBeNull()
  })

  it('rejects a token whose lifetime exceeds the 30-minute cap', async () => {
    const env = makeEnv()
    const [key] = await impersonationSecrets(env)
    const jti = 'imp:admin-1:long'
    await env.ACTIONS_KV.put(activeImpersonationKey(jti), JSON.stringify({ ...ADMIN, targetId: TARGET.id }))
    const token = await signJwt(
      { sub: TARGET.id, email: TARGET.email, jti },
      key!,
      IMPERSONATION_MAX_TTL_SECONDS + 60,
    )
    expect(await resolveImpersonation(env, token)).toBeNull()
  })

  it('stops resolving once the acting admin is no longer a platform admin', async () => {
    const env = makeEnv()
    const { token } = await mintImpersonationToken(env, { ...ADMIN, target: TARGET })
    const demoted = { ...env, SEED_ADMIN_EMAIL: undefined } as unknown as Env
    expect(await resolveImpersonation(demoted, token)).toBeNull()
  })

  it('stops resolving after endImpersonation', async () => {
    const env = makeEnv()
    const { token } = await mintImpersonationToken(env, { ...ADMIN, target: TARGET })
    await endImpersonation(env, token)
    expect(await resolveImpersonation(env, token)).toBeNull()
  })
})
