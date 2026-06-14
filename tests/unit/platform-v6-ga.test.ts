// V60-GA-RELEASE-01 / PLATFORM-CERTIFICATION-V6-01 (ADR-0053) — Sprint 90.
// Public platform contract for the v6.0 GA: version string, GA RELEASES entry,
// the v6.0 certification bundle, and the v5.x sunset notice. These are public
// (unauthenticated) routes, so the app is built with a minimal Env.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

const kv = () => new KVMock() as unknown as KVNamespace

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    METRICS_KV: kv(),
  } as unknown as Env
}

const get = (path: string) => createApp().fetch(new Request(`http://local${path}`), makeEnv())

describe('platform v6.0 GA contract (Sprint 90)', () => {
  it('reports current api version 6.1.0 (v6.1 GA supersedes v6.0)', async () => {
    const res = await get('/api/platform/version')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { api: string } }
    expect(body.ok).toBe(true)
    expect(body.data.api).toBe('6.1.0')
  })

  it('lists the v6.0 GA release', async () => {
    const res = await get('/api/platform/releases')
    const body = (await res.json()) as {
      data: { releases: ReadonlyArray<{ version: string; status: string; sprint: number; codename: string }> }
    }
    const ga = body.data.releases.find((r) => r.version === '6.0.0')
    expect(ga).toEqual({ version: '6.0.0', codename: 'v6.0', status: 'ga', sprint: 90 })
    // The RC stays in the history alongside the GA entry.
    expect(body.data.releases.some((r) => r.version === '6.0.0-rc.1' && r.status === 'rc')).toBe(true)
  })

  it('exposes the v6.0 certification bundle', async () => {
    const res = await get('/api/platform/certification')
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.platformCertification).toBe(true)
    expect(body.data.certifiedVersion).toBe('6.0.0')
    expect(body.data.pentest5).toBe('complete')
    expect(body.data.soc2Type2).toBe('closed')
    expect(body.data.drDrillRtoHours).toBe(2)
    // Bounded AAA claim held at GA (core + captions + canvas AAA, broader app AA).
    expect(body.data.aaaConformance).toBe('partial')
    expect(body.data.fedRampAto).toBe('path_documented')
  })

  it('publishes the v5.x sunset notice', async () => {
    const res = await get('/api/platform/v5-sunset')
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.currentGa).toBe('6.1.0')
    expect(typeof body.data.v5MaintenanceEnd).toBe('string')
    expect(body.data.policyDoc).toContain('ADR-0053')
  })
})
