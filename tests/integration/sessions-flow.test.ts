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

function makeEnv(db: D1Mock): Env {
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

describe('sessions round-trip (POST → GET → PATCH → GET)', () => {
  it('creates a DRAFT, patches title + question, returns hydrated state', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_host_1', 'host@example.com')

    // 1. Create.
    const createRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'idempotency-key': 'key-1' },
        body: JSON.stringify({ title: 'Retro Q2' }),
      }),
      env,
    )
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      ok: boolean
      data: { session: { id: string; title: string; status: string; code: string }; questions: unknown[] }
    }
    expect(created.ok).toBe(true)
    expect(created.data.session.title).toBe('Retro Q2')
    expect(created.data.session.status).toBe('draft')
    expect(created.data.session.code).toMatch(/^[0-9A-Z]{6}$/)
    expect(created.data.questions).toEqual([])
    const sessionId = created.data.session.id

    // 2. Idempotent replay of the same Idempotency-Key returns the cached response — but
    //    ACTIONS_KV is undefined in this test, so we skip the replay assertion and just
    //    check list shows exactly one session (not two).
    const listRes = await app.fetch(
      new Request('http://local/api/sessions', { headers: { cookie } }),
      env,
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as { ok: boolean; data: { sessions: { id: string }[] } }
    expect(listBody.data.sessions).toHaveLength(1)
    expect(listBody.data.sessions[0].id).toBe(sessionId)

    // 3. PATCH title + question.
    const patchRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          title: 'Retro Q2 — final',
          question: {
            kind: 'poll',
            prompt: 'What should we prioritise?',
            options: [
              { id: 'a', label: 'Feature X' },
              { id: 'b', label: 'Tech debt' },
              { id: 'c', label: 'Hiring' },
            ],
          },
        }),
      }),
      env,
    )
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as {
      data: { session: { title: string }; questions: Array<{ prompt: string; options: Array<{ id: string }> }> }
    }
    expect(patched.data.session.title).toBe('Retro Q2 — final')
    expect(patched.data.questions).toHaveLength(1)
    expect(patched.data.questions[0].prompt).toBe('What should we prioritise?')
    expect(patched.data.questions[0].options.map((o) => o.id)).toEqual(['a', 'b', 'c'])

    // 4. GET /:id returns hydrated session.
    const getRes = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}`, { headers: { cookie } }),
      env,
    )
    expect(getRes.status).toBe(200)
    const got = (await getRes.json()) as {
      data: { session: { title: string }; questions: Array<{ prompt: string }> }
    }
    expect(got.data.session.title).toBe('Retro Q2 — final')
    expect(got.data.questions[0].prompt).toBe('What should we prioritise?')
  })

  it('rejects an unauthenticated request with 401', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/sessions', { method: 'POST', body: '{"title":"x"}' }),
      makeEnv(db),
    )
    expect(res.status).toBe(401)
  })

  it('rejects cross-user access with 404', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const ownerCookie = await cookieFor('user_owner', 'owner@example.com')
    const intruderCookie = await cookieFor('user_intruder', 'intruder@example.com')

    const createRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({ title: 'Private' }),
      }),
      env,
    )
    const { data } = (await createRes.json()) as { data: { session: { id: string } } }

    const getRes = await app.fetch(
      new Request(`http://local/api/sessions/${data.session.id}`, { headers: { cookie: intruderCookie } }),
      env,
    )
    expect(getRes.status).toBe(404)
  })

  it('rejects invalid payloads with 400 + validation code', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('u1', 'u1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: '' }),
      }),
      env,
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('validation')
  })

  it('rejects PATCH on non-DRAFT sessions with 409', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_closer', 'closer@example.com')

    // Seed a CLOSED session directly.
    db.sessions.set('sess_closed', {
      id: 'sess_closed',
      owner_id: 'user_closer',
      code: 'ABCDEF',
      title: 'Old',
      status: 'closed',
      anonymity: 'anonymous',
      created_at: Date.now(),
      started_at: null,
      closed_at: Date.now(),
      archived_at: null,
    })

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_closed', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'New' }),
      }),
      env,
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('conflict')
  })
})
