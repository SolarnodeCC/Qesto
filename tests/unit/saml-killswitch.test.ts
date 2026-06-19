import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// SEC-SAML-01 (#529): the SAML SP does not yet verify the XML-DSig signature on
// assertions. Routes stay disabled (503) unless BOTH SAML_SSO_ENABLED and
// SAML_SIGNATURE_VERIFY_ENABLED are explicitly 'true'.

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'production',
    PAGES_URL: 'https://qesto.cc',
    API_URL: 'https://qesto.cc',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    SAML_SP_ENTITY_ID: 'https://qesto.cc',
    SAML_ACS_URL: 'https://qesto.cc/api/auth/saml/callback',
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
    ...overrides,
  } as unknown as Env
}

describe('SAML SP kill-switch (#529)', () => {
  it('returns 503 for /saml/metadata when flags are unset (default off)', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('https://qesto.cc/api/auth/saml/metadata'), makeEnv())
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('saml_disabled')
  })

  it('returns 503 for /saml/init when the flag is unset', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/saml/init?team_id=team-1'),
      makeEnv(),
    )
    expect(res.status).toBe(503)
  })

  it('returns 503 for POST /saml/callback when flags are unset — no forged assertion is parsed', async () => {
    const app = createApp()
    const form = new FormData()
    form.set('SAMLResponse', btoa('<forged/>'))
    form.set('RelayState', 'x'.repeat(64))
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/saml/callback', { method: 'POST', body: form }),
      makeEnv(),
    )
    expect(res.status).toBe(503)
  })

  it('returns 503 when SAML_SSO_ENABLED is true but signature verify is off', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/saml/metadata'),
      makeEnv({ SAML_SSO_ENABLED: 'true' } as Partial<Env>),
    )
    expect(res.status).toBe(503)
  })

  it('returns 503 when the flag is any non-"true" value', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/saml/metadata'),
      makeEnv({ SAML_SSO_ENABLED: 'false' } as Partial<Env>),
    )
    expect(res.status).toBe(503)
  })

  it('serves metadata (200) only when BOTH SAML flags are "true"', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/saml/metadata'),
      makeEnv({
        SAML_SSO_ENABLED: 'true',
        SAML_SIGNATURE_VERIFY_ENABLED: 'true',
      } as Partial<Env>),
    )
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain('md:EntityDescriptor')
  })
})
