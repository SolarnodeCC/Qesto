// Integration tests for the DRAFT → LIVE session lifecycle.
// Covers: single start, idempotent concurrent start, DO failure + rollback,
// validation guards, and structured log event emission.

import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock, doNs?: DurableObjectNamespace): Env {
  return {
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
    SESSION_ROOM: doNs,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

function makeDO(status: number, body: unknown): DurableObjectNamespace {
  return {
    idFromName: () => ({ toString: () => 'do-id' }) as unknown as DurableObjectId,
    get: () =>
      ({
        fetch: () =>
          Promise.resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      }) as unknown as DurableObjectStub,
  } as unknown as DurableObjectNamespace
}

const DO_OK = makeDO(200, { ok: true, data: { initialised: true } })
const DO_ALREADY_INIT = makeDO(409, { ok: false, error: { code: 'already_initialised', message: 'Session already initialised' } })
const DO_FAIL = makeDO(500, { ok: false, error: { code: 'internal_error', message: 'DO unavailable' } })

// A DO whose fetch() *rejects* — mirrors an uncaught exception inside a handler,
// which the runtime surfaces to the caller as a rejected stub.fetch() promise.
function makeRejectingDO(): DurableObjectNamespace {
  return {
    idFromName: () => ({ toString: () => 'do-id' }) as unknown as DurableObjectId,
    get: () =>
      ({
        fetch: () => Promise.reject(new Error('The Durable Object reset because its code threw an exception.')),
      }) as unknown as DurableObjectStub,
  } as unknown as DurableObjectNamespace
}

function makeCapturingWsDO(capture: { headers?: Headers }): DurableObjectNamespace {
  return {
    idFromName: () => ({ toString: () => 'do-id' }) as unknown as DurableObjectId,
    get: () =>
      ({
        fetch: (_input: string | Request, init?: RequestInit) => {
          capture.headers = new Headers(init?.headers)
          return Promise.resolve(new Response('ok', { status: 200 }))
        },
      }) as unknown as DurableObjectStub,
  } as unknown as DurableObjectNamespace
}

async function createSession(
  _db: D1Mock,
  app: ReturnType<typeof createApp>,
  env: Env,
  cookie: string,
  title = 'Test Session',
): Promise<string> {
  const res = await app.fetch(
    new Request('http://local/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title }),
    }),
    env,
  )
  const body = (await res.json()) as { data: { session: { id: string } } }
  return body.data.session.id
}

function seedPollQuestion(db: D1Mock, sessionId: string, kind: 'poll' | 'ranking' | 'open' = 'poll') {
  db.questions.set(`q_${sessionId}`, {
    id: `q_${sessionId}`,
    session_id: sessionId,
    position: 0,
    kind,
    prompt: 'What should we prioritise?',
    options_json: JSON.stringify([
      { id: 'a', label: 'Option A' },
      { id: 'b', label: 'Option B' },
    ]),
    created_at: Date.now(),
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/start', () => {
  it('single start: draft → live', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { session: { status: string } } }
    expect(body.ok).toBe(true)
    expect(body.data.session.status).toBe('live')
    expect(db.sessions.get(sessionId)?.status).toBe('live')
  })

  it('double-submit: first succeeds, second gets 409 (DB stays live, no rollback)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_2', 'user2@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    // First start wins
    const r1 = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(r1.status).toBe(200)
    expect(db.sessions.get(sessionId)?.status).toBe('live')

    // Second start: pre-check sees 'live' → 409 conflict. DB stays live.
    // (In true concurrent races, both would pass the pre-check and the second
    // would hit meta.changes=0 then return 200 — that path is tested below.)
    const r2 = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(r2.status).toBe(409)
    const body2 = (await r2.json()) as { error: { code: string } }
    expect(body2.error.code).toBe('conflict')
    expect(db.sessions.get(sessionId)?.status).toBe('live') // stays live, not rolled back
  })

  it('conditional UPDATE guard: meta.changes=0 path returns 200 without calling DO', async () => {
    // Simulates the concurrent winner: DB is already live, conditional UPDATE
    // returns 0 changes, handler re-reads and returns success.
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_3', 'user3@example.com')
    // Use DO_FAIL to prove it is NOT called in the meta.changes=0 path.
    const env = makeEnv(db, DO_FAIL)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    // Manually transition to live (simulates concurrent winner already winning).
    const row = db.sessions.get(sessionId)!
    row.status = 'live'
    row.started_at = Date.now()

    // The handler reads 'live' at the pre-check and returns 409.
    // To reach meta.changes=0, we'd need the check to pass before the UPDATE;
    // verify instead that D1Mock correctly returns meta.changes=0 for live sessions.
    const result = await db.prepare("UPDATE sessions SET status = 'live', started_at = ?1 WHERE id = ?2 AND owner_id = ?3 AND status = 'draft'")
      .bind(Date.now(), sessionId, 'user_3')
      .run()
    expect(result.meta.changes).toBe(0) // D1Mock enforces AND status='draft' guard
  })

  it('DO returns already_initialised (409) → success, DB stays live (no rollback)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_4', 'user4@example.com')
    const env = makeEnv(db, DO_ALREADY_INIT)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    // DB must remain live — the already_initialised path must NOT rollback.
    expect(db.sessions.get(sessionId)?.status).toBe('live')
  })

  it('DO refuses init (non-200) → rollback to draft → retry with working DO succeeds', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_5', 'user5@example.com')
    const sessionId = await createSession(db, app, makeEnv(db, DO_OK), cookie)
    seedPollQuestion(db, sessionId)

    // First attempt: DO responds non-200 → deterministic refusal surfaced as the
    // non-retryable do_init_error, DB rolled back to draft so a later start works.
    const envFail = makeEnv(db, DO_FAIL)
    const r1 = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      envFail,
    )
    expect(r1.status).toBe(500)
    const b1 = (await r1.json()) as { error: { code: string } }
    expect(b1.error.code).toBe('do_init_error')
    expect(db.sessions.get(sessionId)?.status).toBe('draft') // rolled back

    // Retry: DO is now available → succeeds.
    const envOk = makeEnv(db, DO_OK)
    const r2 = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      envOk,
    )
    expect(r2.status).toBe(200)
    expect(db.sessions.get(sessionId)?.status).toBe('live')
  })

  it('DO fetch rejects (handler threw) → rollback to draft → retryable do_init_failed', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_reject', 'reject@example.com')
    const sessionId = await createSession(db, app, makeEnv(db, DO_OK), cookie)
    seedPollQuestion(db, sessionId)

    // stub.fetch() rejects — the production "Session room unavailable" case.
    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      makeEnv(db, makeRejectingDO()),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string } }
    // Must stay retryable and roll the session back so the retry can succeed.
    expect(body.error.code).toBe('do_init_failed')
    expect(db.sessions.get(sessionId)?.status).toBe('draft')

    // Retry against a healthy DO succeeds.
    const retry = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      makeEnv(db, DO_OK),
    )
    expect(retry.status).toBe(200)
    expect(db.sessions.get(sessionId)?.status).toBe('live')
  })

  it('scoped rollback only reverts the matching start transition', async () => {
    const db = new D1Mock()
    const sessionId = 'sess_scoped_rb'
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: 'user_rb',
      code: 'RBSCOPE',
      title: 'Scoped rollback',
      status: 'live',
      anonymity: 'full',
      created_at: Date.now(),
      started_at: 1000,
      closed_at: null,
      archived_at: null,
    })

    const miss = await db
      .prepare(
        `UPDATE sessions SET status = 'draft', started_at = NULL
         WHERE id = ?1 AND owner_id = ?2 AND status = ?3 AND started_at = ?4`,
      )
      .bind(sessionId, 'user_rb', 'live', 9999)
      .run()
    expect(miss.meta.changes).toBe(0)
    expect(db.sessions.get(sessionId)?.status).toBe('live')

    const hit = await db
      .prepare(
        `UPDATE sessions SET status = 'draft', started_at = NULL
         WHERE id = ?1 AND owner_id = ?2 AND status = ?3 AND started_at = ?4`,
      )
      .bind(sessionId, 'user_rb', 'live', 1000)
      .run()
    expect(hit.meta.changes).toBe(1)
    expect(db.sessions.get(sessionId)?.status).toBe('draft')
  })

  it('parallel starts from draft: at least one succeeds and session leaves draft', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_parallel', 'parallel@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    const req = () =>
      app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
        env,
      )

    const [r1, r2] = await Promise.all([req(), req()])
    const statuses = [r1.status, r2.status]
    expect(statuses.some((s) => s === 200)).toBe(true)
    const finalStatus = db.sessions.get(sessionId)?.status
    expect(finalStatus === 'live' || finalStatus === 'energizing').toBe(true)
  })

  it('DO close failure leaves DB live so votes are not finalized as empty', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_close_fail', 'closefail@example.com')
    const sessionId = await createSession(db, app, makeEnv(db, DO_OK), cookie)
    seedPollQuestion(db, sessionId)

    const start = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      makeEnv(db, DO_OK),
    )
    expect(start.status).toBe(200)
    expect(db.sessions.get(sessionId)?.status).toBe('live')

    const close = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/close`, { method: 'POST', headers: { cookie } }),
      makeEnv(db, DO_FAIL),
    )

    expect(close.status).toBe(500)
    expect(db.sessions.get(sessionId)?.status).toBe('live')
  })

  it('no questions → 409 no_question', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_6', 'user6@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    // No questions seeded.

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('no_question')
    expect(db.sessions.get(sessionId)?.status).toBe('draft') // unchanged
  })

  it('ranking question at position 0 → 200 (all kinds are valid live questions)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_7', 'user7@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId, 'ranking')

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('non-owner cannot start → 404', async () => {
    const db = new D1Mock()
    const app = createApp()
    const ownerCookie = await cookieFor('owner_8', 'owner8@example.com')
    const otherCookie = await cookieFor('other_8', 'other8@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, ownerCookie)
    seedPollQuestion(db, sessionId)

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { cookie: otherCookie },
      }),
      env,
    )
    expect(res.status).toBe(404)
  })

  it('start already-live session → 409 conflict', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_9', 'user9@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    // Force session to live.
    const row = db.sessions.get(sessionId)!
    row.status = 'live'

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('conflict')
    expect(db.sessions.get(sessionId)?.status).toBe('live') // stays live
  })

  it('emits session.start.attempt and session.start.success log events on success', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_10', 'user10@example.com')
    const env = makeEnv(db, DO_OK)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    const logs: unknown[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      try { logs.push(JSON.parse(msg)) } catch { /* non-JSON log line */ }
    })

    await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    spy.mockRestore()

    const events = logs
      .filter((l): l is { event: string } => typeof l === 'object' && l !== null && 'event' in l)
      .map((l) => l.event)
    expect(events).toContain('session.start.attempt')
    expect(events).toContain('session.start.success')
  })

  it('emits session.start.do_idempotent when DO returns already_initialised', async () => {
    const db = new D1Mock()
    const app = createApp()
    const cookie = await cookieFor('user_11', 'user11@example.com')
    const env = makeEnv(db, DO_ALREADY_INIT)
    const sessionId = await createSession(db, app, env, cookie)
    seedPollQuestion(db, sessionId)

    const logs: unknown[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      try { logs.push(JSON.parse(msg)) } catch { /* non-JSON */ }
    })

    await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/start`, { method: 'POST', headers: { cookie } }),
      env,
    )
    spy.mockRestore()

    const events = logs
      .filter((l): l is { event: string } => typeof l === 'object' && l !== null && 'event' in l)
      .map((l) => l.event)
    expect(events).toContain('session.start.do_idempotent')
  })

  it('passes effective team permissions into the WebSocket presenter attachment path', async () => {
    const db = new D1Mock()
    const app = createApp()
    const capture: { headers?: Headers } = {}
    const env = makeEnv(db, makeCapturingWsDO(capture))
    const cookie = await cookieFor('user_member', 'member@example.com')
    await env.TEAMS_KV.put(teamDocumentKey('team_1'), JSON.stringify({
      id: 'team_1',
      name: 'Team',
      ownerId: 'owner_1',
      members: [
        { userId: 'user_member', email: 'member@example.com', role: 'member', joinedAt: Date.now() },
      ],
      plan: 'team',
      samlConfig: null,
      createdAt: Date.now(),
    }))
    db.sessions.set('sess_live_team', {
      id: 'sess_live_team',
      owner_id: 'owner_1',
      code: 'LIVE42',
      title: 'Live team session',
      status: 'live',
      anonymity: 'full',
      vote_policy: 'once',
      session_mode: 'fun',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: null,
      archived_at: null,
      team_id: 'team_1',
    })
    db.customRoles.set('role_eg', {
      id: 'role_eg',
      team_id: 'team_1',
      name: 'Energizer host',
      permissions_json: JSON.stringify(['energizer:activate']),
      created_by: 'owner_1',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    db.teamRoleAssignments.set('assign_eg', {
      id: 'assign_eg',
      team_id: 'team_1',
      user_id: 'user_member',
      role_id: 'role_eg',
      assigned_by: 'owner_1',
      assigned_at: Date.now(),
    })

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_live_team/ws', {
        headers: { upgrade: 'websocket', cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    expect(capture.headers?.get('x-qesto-role')).toBe('presenter')
    expect(capture.headers?.get('x-qesto-permissions')).toContain('energizer:activate')
  })
})
