/**
 * QA-WAVE1-LIFECYCLE-01 — real auth → session lifecycle integration (replaces stub suite).
 *
 * Validates: magic-link callback → JWT cookie → DRAFT create → LIVE start → close.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { makeSessionRoomNamespace } from '../helpers/session-room-stub'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../functions/api/lib/tokens'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  const env = {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
  env.SESSION_ROOM = makeSessionRoomNamespace(env) as unknown as DurableObjectNamespace
  return env
}

type ApiBody<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

async function authCookie(db: D1Mock, app: ReturnType<typeof createApp>, env: Env, email = 'host@example.com'): Promise<string> {
  const raw = generateMagicLinkToken()
  const hash = await hashMagicLinkToken(raw)
  const now = Date.now()
  db.magicLinks.set(hash, {
    token_hash: hash,
    email,
    created_at: now,
    expires_at: now + 15 * 60 * 1000,
    consumed_at: null,
    requester_ip: null,
  })
  const cbRes = await app.fetch(
    new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
    env,
  )
  expect(cbRes.status).toBe(302)
  const setCookie = cbRes.headers.get('set-cookie') ?? ''
  const jwt = setCookie.match(/qesto_session=([^;]+)/)?.[1]
  if (!jwt) throw new Error('missing session cookie')
  return `qesto_session=${jwt}`
}

describe('Wave 1: Auth → Session Lifecycle (integration)', () => {
  it('completes magic link auth and full DRAFT → LIVE → CLOSED lifecycle', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await authCookie(db, app, env)

    const createRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'Wave 1 Standup' }),
      }),
      env,
    )
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as ApiBody<{ session: { id: string; status: string } }>
    if (!created.ok) throw new Error('create failed')
    expect(created.data.session.status).toBe('draft')
    const sessionId = created.data.session.id

    const patchRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          question: {
            kind: 'poll',
            prompt: 'How are we doing?',
            options: [
              { id: 'a', label: 'Great' },
              { id: 'b', label: 'OK' },
            ],
          },
        }),
      }),
      env,
    )
    expect(patchRes.status).toBe(200)

    const startRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(startRes.status).toBe(200)
    const started = (await startRes.json()) as ApiBody<{ session: { status: string; code: string } }>
    if (!started.ok) throw new Error('start failed')
    expect(started.data.session.status).toBe('live')
    expect(started.data.session.code).toMatch(/^[A-Z0-9]{6}$/)

    const livePatchRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'Should fail in LIVE' }),
      }),
      env,
    )
    expect(livePatchRes.status).toBe(409)

    const closeRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(closeRes.status).toBe(200)
    const closed = (await closeRes.json()) as ApiBody<{ session: { status: string } }>
    if (!closed.ok) throw new Error('close failed')
    expect(closed.data.session.status).toBe('closed')
  })

  it('rejects expired magic link tokens', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const raw = generateMagicLinkToken()
    const hash = await hashMagicLinkToken(raw)
    const now = Date.now()
    db.magicLinks.set(hash, {
      token_hash: hash,
      email: 'expired@example.com',
      created_at: now - 20 * 60 * 1000,
      expires_at: now - 5 * 60 * 1000,
      consumed_at: null,
      requester_ip: null,
    })

    const cbRes = await app.fetch(
      new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
      env,
    )
    expect(cbRes.status).toBe(302)
    expect(cbRes.headers.get('location')).toContain('error=expired')
  })
})
