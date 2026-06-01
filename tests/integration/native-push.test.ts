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
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function authHeaders(userId: string, email: string) {
  const token = await signJwt({ sub: userId, email }, SECRET, 3600)
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('native push tokens (Sprint 81)', () => {
  it('registers, lists, and revokes a device token', async () => {
    const db = new D1Mock()
    const userId = 'user-native-1'
    db.users.set(userId, {
      id: userId,
      email: 'native@example.com',
      display_name: null,
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })

    const app = createApp()
    const env = makeEnv(db)
    const headers = await authHeaders(userId, 'native@example.com')

    const reg = await app.fetch(
      new Request('http://local/api/native/push/tokens', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platform: 'ios',
          token: 'fcm-or-apns-device-token-abc123456789',
          appVersion: '5.1.0-beta',
          locale: 'en',
        }),
      }),
      env,
    )
    expect(reg.status).toBe(200)
    const regBody = (await reg.json()) as { ok: boolean; data: { id: string } }
    expect(regBody.ok).toBe(true)
    expect(regBody.data.id).toBeTruthy()

    const list = await app.fetch(new Request('http://local/api/native/push/tokens', { headers }), env)
    expect(list.status).toBe(200)
    const listBody = (await list.json()) as { data: { tokens: { id: string; platform: string }[] } }
    expect(listBody.data.tokens).toHaveLength(1)
    expect(listBody.data.tokens[0].platform).toBe('ios')

    const del = await app.fetch(
      new Request(`http://local/api/native/push/tokens/${regBody.data.id}`, {
        method: 'DELETE',
        headers,
      }),
      env,
    )
    expect(del.status).toBe(200)

    const listAfter = await app.fetch(new Request('http://local/api/native/push/tokens', { headers }), env)
    const afterBody = (await listAfter.json()) as { data: { tokens: unknown[] } }
    expect(afterBody.data.tokens).toHaveLength(0)
  })

  it('exposes native push status without auth', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/native/push/status'), makeEnv(new D1Mock()))
    expect(res.status).toBe(401)
  })
})
