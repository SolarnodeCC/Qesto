import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    SEED_ADMIN_EMAIL: 'admin@example.com',
    DB: db as unknown as D1Database,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function adminCookie(): Promise<string> {
  const token = await signJwt({ sub: 'admin', email: 'admin@example.com' }, SECRET, 3600)
  return `qesto_session=${token}`
}

describe('Sprint 19 baseline endpoint', () => {
  it('reports durable AI wizard and Launchpad baseline proxies with explicit measurement gaps', async () => {
    const db = new D1Mock()
    db.users.set('admin', {
      id: 'admin',
      email: 'admin@example.com',
      display_name: 'Admin',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })
    db.sessions.set('ai_started', {
      id: 'ai_started',
      owner_id: 'admin',
      code: 'ABC123',
      title: 'AI started',
      status: 'live',
      anonymity: 'full',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: null,
      archived_at: null,
      ai_generated: 1,
      ai_consent_at: Date.now(),
      ai_grounding_hash: 'hash',
    })
    db.sessions.set('manual_draft', {
      id: 'manual_draft',
      owner_id: 'admin',
      code: 'DEF456',
      title: 'Manual draft',
      status: 'draft',
      anonymity: 'full',
      created_at: Date.now(),
      started_at: null,
      closed_at: null,
      archived_at: null,
      ai_generated: 0,
      ai_consent_at: null,
      ai_grounding_hash: null,
    })

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/admin/sprint19-baseline', {
        headers: { cookie: await adminCookie() },
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: {
        ai_usage_rate: number
        wizard_completion_rate: number
        launchpad_success_rate: number
        inline_suggestion_acceptance_rate: null
        invalid_live_attempts: null
        counts: { total_sessions: number; ai_generated_sessions: number; started_or_closed_sessions: number }
        measurement_gaps: string[]
      }
    }
    expect(body.data.counts.total_sessions).toBe(2)
    expect(body.data.counts.ai_generated_sessions).toBe(1)
    expect(body.data.counts.started_or_closed_sessions).toBe(1)
    expect(body.data.ai_usage_rate).toBe(0.5)
    expect(body.data.wizard_completion_rate).toBe(0.5)
    expect(body.data.launchpad_success_rate).toBe(0.5)
    expect(body.data.inline_suggestion_acceptance_rate).toBeNull()
    expect(body.data.invalid_live_attempts).toBeNull()
    expect(body.data.measurement_gaps.length).toBeGreaterThan(0)
  })
})
