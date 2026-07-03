// /start DO-failure hardening: a SessionRoom stub.fetch rejection must be
// logged with class/message/retryable, retried exactly once when Cloudflare
// marks it `retryable` (guaranteed undelivered), and otherwise surface the
// existing `do_init_failed` envelope with the DB rolled back to draft.
// Companion to tests/unit/error-hardening.test.ts (DO-side half, PR #674).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { describeDOError } from '../../functions/api/routes/sessions/shared'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'
const SESSION_ID = 'sess_retro'

const kv = () => new KVMock() as unknown as KVNamespace

// Scripted SESSION_ROOM namespace: each /init fetch consumes the next behavior.
// Counts stub creations (get) and fetch attempts so retry semantics are assertable.
function makeRoomNamespace(script: Array<() => Response>) {
  let fetchCalls = 0
  let getCalls = 0
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: () => {
      getCalls++
      return {
        async fetch() {
          const behavior = script[Math.min(fetchCalls, script.length - 1)]
          fetchCalls++
          return behavior()
        },
      }
    },
  }
  return {
    namespace: namespace as unknown as DurableObjectNamespace,
    counts: () => ({ fetchCalls, getCalls }),
  }
}

const ok200 = () =>
  new Response(JSON.stringify({ ok: true, data: { initialised: true } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const doError500 = () =>
  new Response(
    JSON.stringify({ ok: false, error: { code: 'do_internal_error', message: 'Session room encountered an internal error' } }),
    { status: 500, headers: { 'content-type': 'application/json' } },
  )

const rejectWith = (err: Error) => () => {
  throw err
}

const retryableError = () =>
  Object.assign(new Error('Durable Object is overloaded'), { retryable: true, overloaded: true })

function makeEnv(db: D1Mock, room: DurableObjectNamespace): Env {
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
    SESSION_ROOM: room,
  } as unknown as Env
}

async function cookie(userId = USER_ID): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
}

// Draft retro session: board mode, so /start is reachable without questions.
function seed(db: D1Mock) {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    plan: 'team',
    created_at: Date.now(),
    last_login_at: null,
  } as never)
  db.sessions.set(SESSION_ID, {
    id: SESSION_ID,
    owner_id: USER_ID,
    code: 'RET123',
    title: 'Sprint Retro',
    status: 'draft',
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: 'retro',
    created_at: Date.now(),
    started_at: null,
    closed_at: null,
    archived_at: null,
  } as never)
}

const start = (env: Env, c: string) =>
  createApp().fetch(
    new Request(`http://local/api/sessions/${SESSION_ID}/start`, {
      method: 'POST',
      headers: { cookie: c },
    }),
    env,
  )

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/sessions/:id/start — SessionRoom stub.fetch failure handling', () => {
  it('retries once on a retryable rejection and succeeds with a fresh stub', async () => {
    const db = new D1Mock()
    seed(db)
    const room = makeRoomNamespace([rejectWith(retryableError()), ok200])
    const res = await start(makeEnv(db, room.namespace), await cookie())

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(db.sessions.get(SESSION_ID)?.status).toBe('live')
    expect(room.counts().fetchCalls).toBe(2)
    // Fresh stub per attempt, per Cloudflare retry guidance.
    expect(room.counts().getCalls).toBe(2)
  })

  it('does not retry a non-retryable rejection and rolls the session back to draft', async () => {
    const db = new D1Mock()
    seed(db)
    const logSpy = vi.spyOn(console, 'log')
    const room = makeRoomNamespace([rejectWith(new Error('boom'))])
    const res = await start(makeEnv(db, room.namespace), await cookie())

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('do_init_failed')
    // Exact-string contract: the client retry loop and Launchpad display this verbatim.
    expect(body.error.message).toBe('Session room unavailable, please try again')
    expect(room.counts().fetchCalls).toBe(1)
    expect(db.sessions.get(SESSION_ID)?.status).toBe('draft')

    const events = logSpy.mock.calls
      .map(([line]) => {
        try {
          return JSON.parse(line as string) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((e): e is Record<string, unknown> => e !== null)
    const rejected = events.find((e) => e.event === 'do.stub_fetch_rejected')
    expect(rejected).toMatchObject({ path: '/init', attempt: 1, retryable: false, errorClass: 'Error' })
    const routeLevel = events.find((e) => e.event === 'session.start.do_network_error')
    expect(routeLevel).toMatchObject({ session_id: SESSION_ID, errorClass: 'Error' })
  })

  it('gives up after the single retry when both attempts reject retryable', async () => {
    const db = new D1Mock()
    seed(db)
    const room = makeRoomNamespace([rejectWith(retryableError()), rejectWith(retryableError())])
    const res = await start(makeEnv(db, room.namespace), await cookie())

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('do_init_failed')
    expect(body.error.message).toBe('Session room unavailable, please try again')
    expect(room.counts().fetchCalls).toBe(2)
    expect(db.sessions.get(SESSION_ID)?.status).toBe('draft')
  })

  it('does not retry when the DO returns a non-200 Response (existing refused-init path)', async () => {
    const db = new D1Mock()
    seed(db)
    const room = makeRoomNamespace([doError500])
    const res = await start(makeEnv(db, room.namespace), await cookie())

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('do_init_failed')
    expect(body.error.message).toBe('DurableObject refused init (500)')
    expect(room.counts().fetchCalls).toBe(1)
    expect(db.sessions.get(SESSION_ID)?.status).toBe('draft')
  })
})

describe('describeDOError', () => {
  it('extracts Cloudflare retryable/overloaded flags from a flagged Error', () => {
    const info = describeDOError(retryableError())
    expect(info).toMatchObject({
      errorClass: 'Error',
      errorMessage: 'Durable Object is overloaded',
      retryable: true,
      overloaded: true,
    })
    expect(info.stack).toBeDefined()
  })

  it('marks a plain Error non-retryable', () => {
    expect(describeDOError(new Error('boom'))).toMatchObject({
      errorClass: 'Error',
      errorMessage: 'boom',
      retryable: false,
      overloaded: false,
    })
  })

  it('handles non-Error throw values', () => {
    expect(describeDOError('string failure')).toMatchObject({
      errorClass: 'UnknownError',
      errorMessage: 'string failure',
      retryable: false,
      overloaded: false,
    })
  })
})
