// Sprint 91 foundation — platform version + ADR acceptance evidence

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

describe('Sprint 91 foundation', () => {
  it('ADR-0054/0055/0057 documents exist and are accepted', () => {
    for (const slug of [
      'ADR-0054-cadence-9-governance',
      'ADR-0055-reactions-ga-channel',
      'ADR-0057-pulse-analytics-data-model',
    ]) {
      const path = join(process.cwd(), 'knowledge-base/adr', `${slug}.md`)
      expect(existsSync(path)).toBe(true)
      const body = readFileSync(path, 'utf8')
      expect(body).toMatch(/status: accepted/i)
    }
  })

  it('platform releases include 6.1.0-dev sprint 91 entry', async () => {
    const res = await get('/api/platform/releases')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { releases: Array<{ version: string; sprint: number }> } }
    const dev = json.data.releases.find((r) => r.version === '6.1.0-dev')
    expect(dev?.sprint).toBe(91)
  })
})
