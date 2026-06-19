// V70-GA-RELEASE-01 / PLATFORM-CERTIFICATION-V7-01 (ADR-0063) — Sprint 99.
// Public platform contract for the v7.0 GA ("Engagement Intelligence Network"):
// version string, GA RELEASES entry, the v7.0 certification bundle, and the v6.x
// sunset notice. These are public (unauthenticated) routes, so the app is built
// with a minimal Env.

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

describe('platform v7.0 GA contract (Sprint 99)', () => {
  it('reports current api version 7.0.0 (v7.0 GA)', async () => {
    const res = await get('/api/platform/version')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { api: string; publicApi: Record<string, string> } }
    expect(body.ok).toBe(true)
    expect(body.data.api).toBe('7.0.0')
    // Additive at GA — publicApi map unchanged vs v6.x.
    expect(body.data.publicApi).toEqual({ v1: 'deprecated', v2: 'maintained', v3: 'ga' })
  })

  it('lists the v7.0 GA release at sprint 99, retaining the rc rows', async () => {
    const res = await get('/api/platform/releases')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { releases: ReadonlyArray<{ version: string; status: string; sprint: number; codename: string }> }
    }
    const ga = body.data.releases.find((r) => r.version === '7.0.0')
    expect(ga).toEqual({ version: '7.0.0', codename: 'v7.0', status: 'ga', sprint: 99 })
    // The RC rows stay in the history alongside the GA entry (additive registry).
    expect(body.data.releases.some((r) => r.version === '7.0.0-rc.1' && r.status === 'rc')).toBe(true)
    expect(body.data.releases.some((r) => r.version === '7.0.0-rc.2' && r.status === 'rc')).toBe(true)
  })

  it('exposes the v7.0 certification bundle', async () => {
    const res = await get('/api/platform/certification')
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.platformCertification).toBe(true)
    expect(body.data.certifiedVersion).toBe('7.0.0')
    expect(body.data.pentest3).toBe('complete')
    expect(body.data.pentest5).toBe('complete')
    expect(body.data.pentest6).toBe('complete')
    // Cross-tenant isolation proof (ADR-0062 / QA-CONNECT-SCALE-01).
    expect(body.data.isolationProof).toBe('verified')
    expect(body.data.soc2Type2).toBe('closed')
    expect(body.data.soc2AnnualEvidence).toEqual(expect.any(String))
    expect(body.data.drDrillRtoHours).toBe(2)
    // Bounded AAA claim held at GA — XR is beta-only and excluded from the certified claim.
    expect(body.data.aaaConformance).toBe('partial')
    expect(body.data.fedRampAto).toBe('path_documented')
    expect(body.data.sovereignTier).toEqual(expect.any(String))
    expect(body.data.deprecationPolicy).toEqual(expect.stringContaining('ADR-0063'))
    expect(body.data.certifiedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    // XR is excluded from the certified claim — no xr* certification field.
    expect(Object.keys(body.data).some((k) => k.toLowerCase().startsWith('xr'))).toBe(false)
  })

  it('publishes the v6.x sunset notice', async () => {
    const res = await get('/api/platform/v6-sunset')
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.currentGa).toBe('7.0.0')
    expect(body.data.v6MaintenanceEnd).toBe('2029-11-03')
    expect(body.data.v5MaintenanceEnd).toBe('2028-12-31')
    expect(body.data.v4MaintenanceEnd).toBe('2028-09-16')
    expect(body.data.v3End).toBe('2027-12-31')
    expect(typeof body.data.notice).toBe('string')
    expect(body.data.policyDoc).toContain('ADR-0063')
  })

  it('updates the v5.x sunset notice currentGa to the live GA', async () => {
    const res = await get('/api/platform/v5-sunset')
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.currentGa).toBe('7.0.0')
    expect(body.data.policyDoc).toContain('ADR-0053')
  })
})
