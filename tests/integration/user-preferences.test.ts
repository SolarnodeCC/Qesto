import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(): Env {
  const db = new D1Mock()
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
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

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, SECRET, 3600)
  return `qesto_session=${token}`
}

describe('User Preferences CRUD', () => {
  it('gets empty preferences for new user', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/users/preferences', {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data).toEqual({})
  })

  it('updates user preferences', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'comfortable' }),
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.density).toBe('comfortable')
  })

  it('partially updates preferences', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // First update
    const update1 = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'compact' }),
      }),
      env,
    )
    expect(update1.status).toBe(200)

    // Verify it was saved
    const get1 = await app.fetch(
      new Request('http://local/api/users/preferences', {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    let body = (await get1.json()) as any
    expect(body.data.density).toBe('compact')

    // Second update (can be empty or partial)
    const update2 = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({}),
      }),
      env,
    )
    expect(update2.status).toBe(200)
    body = (await update2.json()) as any
    expect(body.data.density).toBe('compact')
  })

  it('rejects invalid density values', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'invalid' }),
      }),
      env,
    )

    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.error.code).toBe('bad_request')
  })

  it('rejects malformed json', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: 'not json',
      }),
      env,
    )

    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated preference access', async () => {
    const app = createApp()
    const env = makeEnv()

    const getRes = await app.fetch(
      new Request('http://local/api/users/preferences', {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    expect(getRes.status).toBe(401)

    const patchRes = await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'compact' }),
      }),
      env,
    )
    expect(patchRes.status).toBe(401)
  })

  it('isolates preferences between users', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie1 = await cookieFor('user_1', 'user1@example.com')
    const cookie2 = await cookieFor('user_2', 'user2@example.com')

    // User 1 sets preferences
    await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'compact' }),
      }),
      env,
    )

    // User 2 gets empty preferences
    const res = await app.fetch(
      new Request('http://local/api/users/preferences', {
        headers: { cookie: cookie2, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data).toEqual({})

    // User 2 sets different preference
    await app.fetch(
      new Request('http://local/api/users/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: cookie2, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ density: 'spacious' }),
      }),
      env,
    )

    // User 1 still has their preference
    const user1Get = await app.fetch(
      new Request('http://local/api/users/preferences', {
        headers: { cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    const body1 = (await user1Get.json()) as any
    expect(body1.data.density).toBe('compact')
  })

  it('supports all valid density values', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookie = await cookieFor('user_1', 'user1@example.com')

    for (const density of ['compact', 'comfortable', 'spacious']) {
      const res = await app.fetch(
        new Request('http://local/api/users/preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
          body: JSON.stringify({ density }),
        }),
        env,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.data.density).toBe(density)
    }
  })
})
