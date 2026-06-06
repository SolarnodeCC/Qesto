import { describe, expect, it } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SERVICE_KEY = 'kb-service-key-at-least-16-chars'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

/** Env where KB search would succeed (empty result) once auth passes. */
function makeEnv(): Env {
  return {
    ENV: 'dev',
    JWT_SECRET: testJwtSecret(),
    KB_SEARCH_SERVICE_KEY: SERVICE_KEY,
    DB: new D1Mock() as unknown as D1Database,
    ACTIONS_KV: kv(),
    AI: { run: async () => ({ data: [new Array(1024).fill(0)] }) } as unknown as Ai,
    KB_VECTORIZE: { query: async () => ({ matches: [] }) } as unknown as VectorizeIndex,
  } as unknown as Env
}

function search(env: Env, headers: Record<string, string>) {
  const app = createApp()
  return app.fetch(
    new Request('http://local/api/knowledge-base/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query: 'how does auth work' }),
    }),
    env,
  )
}

describe('POST /api/knowledge-base/search — service-key auth', () => {
  it('allows a valid x-kb-service-key without a JWT', async () => {
    const res = await search(makeEnv(), { 'x-kb-service-key': SERVICE_KEY })
    expect(res.status).toBe(200)
  })

  it('rejects a wrong service key (falls back to JWT → 401)', async () => {
    const res = await search(makeEnv(), { 'x-kb-service-key': 'wrong-key' })
    expect(res.status).toBe(401)
  })

  it('rejects when no key and no JWT are provided', async () => {
    const res = await search(makeEnv(), {})
    expect(res.status).toBe(401)
  })

  it('does not accept the service key when KB_SEARCH_SERVICE_KEY is unset', async () => {
    const env = makeEnv()
    delete (env as { KB_SEARCH_SERVICE_KEY?: string }).KB_SEARCH_SERVICE_KEY
    const res = await search(env, { 'x-kb-service-key': SERVICE_KEY })
    expect(res.status).toBe(401)
  })
})
