/**
 * Health endpoint contract — DD-08.
 *
 * Requirement: knowledge-base/quality/audits/DUE_DILIGENCE_2026-09-15.md (DD-08)
 *
 * The post-deploy gate in .github/workflows/ci.yml reads
 * `.data.checks.{d1,kv,do}` from GET /api/admin/health. It previously read
 * `.d1`/`.kv`/`.do`, which the handler has never returned at any nesting level,
 * so the step failed on every release while verifying nothing.
 *
 * These tests pin the shape the CI script depends on, so the handler and the
 * deploy gate cannot silently drift apart again.
 */
import { describe, it, expect } from 'vitest'
import { createApp } from '../../functions/api/app'

type HealthBody = {
  ok: boolean
  data: { checks: Record<string, string>; env?: string; commit?: string }
}

/** Minimal env: bindings that answer, so the probes resolve to 'ok'. */
function healthyEnv() {
  return {
    ENV: 'dev',
    COMMIT_SHA: 'abc123',
    DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
    ACTIONS_KV: { get: async () => null },
    SESSION_ROOM: { idFromName: () => ({}) },
  } as unknown as Parameters<ReturnType<typeof createApp>['request']>[2]
}

async function getHealth(env: unknown) {
  const app = createApp()
  const res = await app.request('/api/admin/health', {}, env as never)
  return { res, body: (await res.json()) as HealthBody }
}

describe('DD-08: /api/admin/health contract', () => {
  it('exposes the exact keys the CI deploy gate reads', async () => {
    const { res, body } = await getHealth(healthyEnv())

    expect(res.status).toBe(200)
    // These three paths are what ci.yml queries with jq. Changing them without
    // changing the workflow is the defect this test exists to prevent.
    expect(body.data.checks.d1).toBe('ok')
    expect(body.data.checks.kv).toBe('ok')
    expect(body.data.checks.do).toBe('ok')
  })

  it('reports 503 and a non-ok check when a dependency is failing', async () => {
    const env = healthyEnv() as unknown as Record<string, unknown>
    env.DB = {
      prepare: () => ({
        first: async () => {
          throw new Error('D1_ERROR')
        },
      }),
    }

    const { res, body } = await getHealth(env)

    // curl -sf in the workflow turns this into a non-zero exit, which is the
    // point: a degraded dependency must fail the deploy gate.
    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.data.checks.d1).not.toBe('ok')
    expect(body.data.checks.kv).toBe('ok')
  })

  it('reports absent bindings as unconfigured and stays 200', async () => {
    // Unbound is the normal shape under Vitest and before bootstrap. It is a
    // deployment fact, not an outage, so it must not 503 — the CI gate is the
    // control that requires all three to be exactly 'ok' in production.
    const { res, body } = await getHealth({ ENV: 'dev' })

    expect(res.status).toBe(200)
    expect(body.data.checks.d1).toBe('unconfigured')
    expect(body.data.checks.kv).toBe('unconfigured')
    expect(body.data.checks.do).toBe('unconfigured')
  })
})
