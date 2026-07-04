// COMPLIANCE-TYPE2-EVIDENCE-01 — verifies the evidence-pack response shape and
// that automated/manual status claims stay distinguishable and machine-checkable
// (see #523: artifacts must carry collected_at, and only the genuinely
// recurring manual control carries next_collection).
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const ADMIN_EMAIL = 'admin@example.com'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

async function cookieFor(email: string): Promise<string> {
  const token = await signJwt({ sub: 'admin_1', email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('GET /api/compliance/evidence-pack', () => {
  it('returns artifacts with truthful automated/manual status, collected_at, and next_collection only where a real cadence exists', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor(ADMIN_EMAIL)

    const res = await app.fetch(
      new Request('http://local/api/compliance/evidence-pack', {
        headers: { cookie },
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: {
        artifacts: Array<{
          id: string
          status: string
          source: string
          description: string
          collected_at: number
          next_collection: number | null
        }>
      }
    }
    expect(body.ok).toBe(true)

    const artifacts = body.data.artifacts

    expect(artifacts.length).toBe(5)
    const byId = Object.fromEntries(artifacts.map((a) => [a.id, a]))

    // Automated artifacts: continuously enforced/recorded by code, no batch job,
    // so next_collection is null (there's no "next" for an always-on check).
    for (const id of ['access-control', 'audit-trail', 'gdpr-deletion', 'api-key-lifecycle']) {
      expect(byId[id].status).toBe('automated')
      expect(byId[id].next_collection).toBeNull()
      expect(typeof byId[id].collected_at).toBe('number')
      expect(byId[id].description.length).toBeGreaterThan(0)
    }

    // The audit-trail source must point at the real D1 table that is actually
    // written to (lib/audit.ts), not the unused AUDIT_KV namespace.
    expect(byId['audit-trail'].source).toContain('audit_events')
    expect(byId['audit-trail'].source).not.toBe('AUDIT_KV')

    // Pentest remediation is the one genuinely manual, recurring control.
    expect(byId['pentest-remediation'].status).toBe('manual_upload')
    expect(byId['pentest-remediation'].next_collection).not.toBeNull()
    expect(byId['pentest-remediation'].next_collection as number).toBeGreaterThan(
      byId['pentest-remediation'].collected_at,
    )
  })

  it('requires admin auth', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('not-an-admin@example.com')

    const res = await app.fetch(
      new Request('http://local/api/compliance/evidence-pack', {
        headers: { cookie },
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(403)
  })
})
