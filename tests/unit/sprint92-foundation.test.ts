import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
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

describe('Sprint 92 foundation', () => {
  it('ADR-0056 document exists and is accepted', () => {
    const path = join(process.cwd(), 'knowledge-base/adr/ADR-0056-agentic-maturity-l2-copilot.md')
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf8')).toMatch(/status: accepted/i)
  })

  it('platform version is 6.1.0 GA', async () => {
    const res = await get('/api/platform/version')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { api: string } }
    expect(json.data.api).toBe('6.1.0')
  })

  it('platform releases include 6.1.0 sprint 92 GA entry', async () => {
    const res = await get('/api/platform/releases')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { releases: Array<{ version: string; sprint: number; status: string }> } }
    const ga = json.data.releases.find((r) => r.version === '6.1.0')
    expect(ga?.sprint).toBe(92)
    expect(ga?.status).toBe('ga')
  })
})
