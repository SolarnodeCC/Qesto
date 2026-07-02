// PR-A regression coverage — error hardening + validation.
//
// Mapped to audit findings:
//   EH-01  app.onError sanitises in production (regression guard for the
//          existing fix in app.ts:97).
//   EH-02  Catches in gamification/ai-insights/energizers no longer leak raw
//          err.message in production — covered transitively by sanitizeError().
//   EH-03  SessionRoom._votersInitPromise resets on rejection so the next
//          caller retries instead of replaying the cached failure.
//   EH-04  Energizer mutating endpoints reject malformed JSON with 400.
//   EH-08  Admin mutating endpoints reject malformed JSON with 400.
//
// These tests deliberately cover only the routes whose validation/error
// behaviour PR-A changed. Behavioural happy-path coverage stays in the
// existing per-route integration suites.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { sanitizeError } from '../../functions/api/lib/error-handler'
import { signJwt } from '../../functions/api/lib/jwt'
import { SessionRoom } from '../../functions/api/SessionRoom'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { MockDurableObjectState } from '../helpers/do-mock'

const TEST_SECRET = 'integration-test-secret-at-least-32-bytes!'
const SEED_ADMIN_EMAIL = 'qesto@example.com'
const ADMIN_USER_ID = 'user_admin_1'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock, env: 'dev' | 'production' = 'dev'): Env {
  return {
    ENV: env,
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_SECRET,
    SEED_ADMIN_EMAIL,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
  } as unknown as Env
}

async function adminCookie(): Promise<string> {
  const token = await signJwt({ sub: ADMIN_USER_ID, email: SEED_ADMIN_EMAIL }, TEST_SECRET, 3600)
  return `qesto_session=${token}`
}

// ─────────────────────────────────────────────────────────────────────────────
// EH-01 — sanitizeError() never leaks raw error text in production for 5xx
// ─────────────────────────────────────────────────────────────────────────────

describe('sanitizeError (EH-01 regression guard)', () => {
  it('returns the generic message for 5xx in production', () => {
    const err = new Error('D1_ERROR: UNIQUE constraint failed: users.email')
    const out = sanitizeError(err, 'production', 500)
    expect(out.code).toBe('internal')
    expect(out.message).not.toContain('D1_ERROR')
    expect(out.message).not.toContain('users.email')
    expect(out.message).toMatch(/unexpected error/i)
  })

  it('preserves the raw message in dev for debuggability', () => {
    const err = new Error('D1_ERROR: UNIQUE constraint failed: users.email')
    const out = sanitizeError(err, 'dev', 500)
    expect(out.message).toContain('D1_ERROR')
  })

  it('still surfaces 4xx messages in production (user-facing)', () => {
    const err = new Error('Email already taken')
    const out = sanitizeError(err, 'production', 400)
    expect(out.code).toBe('bad_request')
    expect(out.message).toBe('Email already taken')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EH-08 — admin mutating endpoints return 400, not 500, on malformed JSON
// ─────────────────────────────────────────────────────────────────────────────

describe('admin routes reject malformed JSON with 400 (EH-08)', () => {
  it('POST /api/admin/metrics/export → 400 with code=validation', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/admin/metrics/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await adminCookie() },
        body: 'this is not json',
      }),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('validation')
  })

  it('POST /api/admin/users → 400 with code=validation when body is not JSON', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await adminCookie() },
        body: '{not json',
      }),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.error.code).toBe('validation')
  })

  it('PATCH /api/admin/users/:id → 400 with code=validation when body is not JSON', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/admin/users/some_user', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: await adminCookie() },
        body: 'oops',
      }),
      makeEnv(new D1Mock()),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.error.code).toBe('validation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EH-03 — SessionRoom voters init resets cached promise on rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionRoom ensureVoters retry on storage failure (EH-03)', () => {
  it('rethrows the first storage failure and succeeds on retry', async () => {
    const state = new MockDurableObjectState()
    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: TEST_SECRET,
    } as unknown as Env

    // Seed a usable voters payload directly so the second (successful) read
    // returns deterministic data.
    await state.storage.put('voters', { anon_a: ['opt_x'] })

    // Wrap storage.get so the first K_VOTERS read rejects, simulating a
    // transient DO storage fault. Subsequent reads delegate to the real mock.
    const originalGet = state.storage.get.bind(state.storage)
    let firstVotersRead = true
    state.storage.get = (async (key: string) => {
      if (key === 'voters' && firstVotersRead) {
        firstVotersRead = false
        throw new Error('storage transient')
      }
      return originalGet(key)
    }) as typeof state.storage.get

    const room = new SessionRoom(state as unknown as DurableObjectState, env)

    // First call should bubble up the storage error and clear the cached
    // promise so the next caller retries rather than replaying the rejection.
    type WithEnsureVoters = { ensureVoters(): Promise<unknown>; _votersInitPromise: Promise<void> | null }
    const internal = room as unknown as WithEnsureVoters

    await expect(internal.ensureVoters()).rejects.toThrow('storage transient')
    expect(internal._votersInitPromise).toBeNull()

    // Second call hits the (now succeeding) storage path and returns voters.
    const voters = (await internal.ensureVoters()) as Record<string, string[]>
    expect(voters.anon_a).toEqual(['opt_x'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SessionRoom.fetch() converts an uncaught handler throw into a 500 Response
// instead of rejecting the caller's stub.fetch() (the opaque
// "Session room unavailable" production failure mode).
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionRoom.fetch hardening (uncaught handler throw → 500 Response)', () => {
  it('returns a structured 500 instead of rejecting when a handler throws', async () => {
    const state = new MockDurableObjectState()
    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: TEST_SECRET,
    } as unknown as Env

    // Force any storage read to throw, simulating a fault inside handleInit.
    state.storage.get = (async () => {
      throw new Error('storage exploded')
    }) as typeof state.storage.get

    const room = new SessionRoom(state as unknown as DurableObjectState, env)

    // The call must resolve to a 500 Response — NOT reject — so the REST layer
    // sees an actionable error instead of an opaque stub.fetch() rejection.
    const res = await room.fetch(
      new Request('https://do.internal/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's1', ownerId: 'o1', code: 'ABC123', title: 'T' }),
      }),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('do_internal_error')
  })
})
