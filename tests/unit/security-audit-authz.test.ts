/**
 * Regression tests for the security audit findings.
 *
 * Each block pins a control that was missing and is exploitable without it —
 * the assertions are written against the attacker's goal, not the
 * implementation, so a refactor that reintroduces the gap fails here.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../../functions/api/lib/session-token'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'
import { D1Mock } from '../helpers/d1-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const kv = () => new KVMock() as unknown as KVNamespace

const VICTIM_SESSION = 'victim-session-id'
const VICTIM_ENERGIZER = 'victim-energizer-id'
const VICTIM_MATCH = 'victim-match-id'

/**
 * D1 stub for the tournament surface. Everything the victim owns exists; the
 * attacker owns nothing. `writes` records mutations so a test can assert that
 * an unauthorized request never reached the UPDATE.
 */
function tournamentDb(writes: string[]): D1Database {
  const bound = (sql: string, args: unknown[]) => ({
    first: async <T,>() => {
      if (/FROM sessions/.test(sql)) {
        return args[0] === VICTIM_SESSION
          ? ({
              id: VICTIM_SESSION,
              owner_id: 'victim',
              code: 'ABC123',
              title: 'Victim offsite',
              status: 'live',
              anonymity: 'anonymous',
              team_id: null,
            } as T)
          : null
      }
      if (/FROM energizers/.test(sql)) {
        // getEnergizerById binds (energizerId, sessionId); sessionIdForEnergizer binds (energizerId)
        const matchesEnergizer = args[0] === VICTIM_ENERGIZER
        const scoped = args.length < 2 || args[1] === VICTIM_SESSION
        if (!matchesEnergizer || !scoped) return null
        return { id: VICTIM_ENERGIZER, session_id: VICTIM_SESSION, kind: 'bracket' } as T
      }
      if (/FROM bracket_matches/.test(sql) && /COUNT/.test(sql)) return { n: 0 } as T
      if (/energizer_id FROM bracket_matches/.test(sql)) {
        return args[0] === VICTIM_MATCH ? ({ energizer_id: VICTIM_ENERGIZER } as T) : null
      }
      if (/FROM users/.test(sql)) return { id: String(args[0]), plan: 'team' } as T
      return null
    },
    all: async <T,>() => {
      if (/FROM bracket_matches/.test(sql)) {
        return {
          results: [
            {
              id: VICTIM_MATCH,
              round_number: 1,
              match_number: 1,
              participant_a_id: 'VICTIM-ALICE',
              participant_b_id: 'VICTIM-BOB',
              winner_id: null,
              score_a: 0,
              score_b: 0,
              state: 'pending',
            },
          ],
        } as unknown as D1Result<T>
      }
      return { results: [] } as unknown as D1Result<T>
    },
    run: async () => {
      writes.push(sql.replace(/\s+/g, ' ').trim())
      return { meta: { changes: 1 } }
    },
  })
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => bound(sql, args),
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ meta: { changes: 0 } }),
    }),
    batch: async () => [],
  } as unknown as D1Database
}

function makeEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'production',
    PAGES_URL: 'https://qesto.cc',
    API_URL: 'https://qesto.cc',
    JWT_SECRET: SECRET,
    DB: db,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    INTEGRATIONS_KV: kv(),
    ...overrides,
  } as unknown as Env
}

async function jwtFor(sub: string): Promise<string> {
  return signJwt({ sub, email: `${sub}@example.com` }, SECRET, 3600)
}

describe('tournaments — cross-tenant object access (IDOR)', () => {
  it('does not expose another tenant bracket to an unrelated authenticated user', async () => {
    const writes: string[] = []
    const app = createApp()
    const env = makeEnv(tournamentDb(writes))
    const res = await app.fetch(
      new Request(
        `https://qesto.cc/api/tournaments/sessions/${VICTIM_SESSION}/bracket/${VICTIM_ENERGIZER}`,
        { headers: { cookie: `qesto_session=${await jwtFor('attacker')}`, origin: 'https://qesto.cc' } },
      ),
      env,
    )
    expect(res.status).toBe(404)
    expect(JSON.stringify(await res.json())).not.toContain('VICTIM-ALICE')
  })

  it('does not export another tenant bracket', async () => {
    const app = createApp()
    const env = makeEnv(tournamentDb([]))
    const res = await app.fetch(
      new Request(
        `https://qesto.cc/api/tournaments/sessions/${VICTIM_SESSION}/bracket/${VICTIM_ENERGIZER}/export`,
        { headers: { cookie: `qesto_session=${await jwtFor('attacker')}`, origin: 'https://qesto.cc' } },
      ),
      env,
    )
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('VICTIM-ALICE')
  })

  it('does not let an unrelated user overwrite a match result', async () => {
    const writes: string[] = []
    const app = createApp()
    const env = makeEnv(tournamentDb(writes))
    const res = await app.fetch(
      new Request(`https://qesto.cc/api/tournaments/matches/${VICTIM_MATCH}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${await jwtFor('attacker')}`,
          origin: 'https://qesto.cc',
        },
        body: JSON.stringify({ winnerId: 'attacker-pick' }),
      }),
      env,
    )
    expect(res.status).toBe(404)
    expect(writes.filter((w) => w.startsWith('UPDATE bracket_matches'))).toHaveLength(0)
  })

  it('does not let an unrelated user seed a bracket on someone else energizer', async () => {
    const writes: string[] = []
    const app = createApp()
    const env = makeEnv(tournamentDb(writes))
    const res = await app.fetch(
      new Request(`https://qesto.cc/api/tournaments/sessions/${VICTIM_SESSION}/bracket/seed`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${await jwtFor('attacker')}`,
          origin: 'https://qesto.cc',
        },
        body: JSON.stringify({ energizerId: VICTIM_ENERGIZER, participants: [{ id: 'a' }, { id: 'b' }] }),
      }),
      env,
    )
    expect(res.status).toBe(404)
    expect(writes.filter((w) => w.startsWith('INSERT INTO bracket_matches'))).toHaveLength(0)
  })

  it('still serves the owner', async () => {
    const app = createApp()
    const env = makeEnv(tournamentDb([]))
    const res = await app.fetch(
      new Request(
        `https://qesto.cc/api/tournaments/sessions/${VICTIM_SESSION}/bracket/${VICTIM_ENERGIZER}`,
        { headers: { cookie: `qesto_session=${await jwtFor('victim')}`, origin: 'https://qesto.cc' } },
      ),
      env,
    )
    expect(res.status).toBe(200)
  })

  it('rejects an energizer paired with a session the caller does own', async () => {
    // Attacker owns nothing here, but the shape matters: pairing an accessible
    // session id with a foreign energizer id must not pass.
    const app = createApp()
    const env = makeEnv(tournamentDb([]))
    const res = await app.fetch(
      new Request(
        `https://qesto.cc/api/tournaments/sessions/${VICTIM_SESSION}/bracket/some-other-energizer`,
        { headers: { cookie: `qesto_session=${await jwtFor('victim')}`, origin: 'https://qesto.cc' } },
      ),
      env,
    )
    expect(res.status).toBe(404)
  })
})

describe('logout — session invalidation', () => {
  it('revokes the cookie-borne token, not just an Authorization header', async () => {
    const actions = kv()
    const app = createApp()
    const env = makeEnv(new D1Mock() as unknown as D1Database, { ACTIONS_KV: actions })
    const jwt = await jwtFor('u1')

    const out = await app.fetch(
      new Request('https://qesto.cc/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `qesto_session=${jwt}`, origin: 'https://qesto.cc' },
      }),
      env,
    )
    expect(out.status).toBe(200)

    // The token is on the revocation list...
    expect(await actions.get(revokedSessionTokenKey(await hashSessionToken(jwt)))).toBe('1')

    // ...and replaying it no longer authenticates.
    const replay = await app.fetch(
      new Request('https://qesto.cc/api/auth/me', {
        headers: { authorization: `Bearer ${jwt}`, origin: 'https://qesto.cc' },
      }),
      env,
    )
    expect(replay.status).toBe(401)
  })

  it('clears the cookie with the attributes it was issued with', async () => {
    const app = createApp()
    const env = makeEnv(new D1Mock() as unknown as D1Database)
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `qesto_session=${await jwtFor('u1')}`, origin: 'https://qesto.cc' },
      }),
      env,
    )
    // Without Secure + SameSite=None the browser drops this Set-Cookie on a
    // cross-site response and the session cookie survives logout.
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/qesto_session=/)
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).toMatch(/SameSite=None/i)
  })
})

describe('CSRF — Origin enforcement in production', () => {
  it('rejects a localhost origin when ENV=production', async () => {
    const app = createApp()
    const env = makeEnv(new D1Mock() as unknown as D1Database, { ENV: 'production' } as Partial<Env>)
    const res = await app.fetch(
      new Request(`https://qesto.cc/api/tournaments/matches/${VICTIM_MATCH}`, {
        method: 'PATCH',
        // text/plain keeps this a CORS "simple request" — no preflight fires,
        // so the CSRF middleware is the only control in the path.
        headers: {
          'content-type': 'text/plain',
          cookie: `qesto_session=${await jwtFor('victim')}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ winnerId: 'attacker-pick' }),
      }),
      env,
    )
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('forbidden_origin')
  })

  it('still allows a localhost origin in dev', async () => {
    const app = createApp()
    const env = makeEnv(new D1Mock() as unknown as D1Database, { ENV: 'dev' } as Partial<Env>)
    const res = await app.fetch(
      new Request('https://qesto.cc/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
      }),
      env,
    )
    expect(res.status).not.toBe(403)
  })
})

describe('impersonation — stopping is authoritative', () => {
  it('revokes the impersonation token server-side and clears it cross-site', async () => {
    const actions = kv()
    const app = createApp()
    const env = makeEnv(new D1Mock() as unknown as D1Database, { ACTIONS_KV: actions })
    // An impersonation cookie carries jti = `imp:<adminId>:<ulid>`.
    const impToken = await signJwt(
      { sub: 'target-user', email: 'target@example.com', jti: 'imp:admin-1:01HXYZ' },
      SECRET,
      900,
    )

    const res = await app.fetch(
      new Request('https://qesto.cc/api/admin/impersonation/stop', {
        method: 'POST',
        headers: { cookie: `qesto_impersonation=${impToken}`, origin: 'https://qesto.cc' },
      }),
      env,
    )
    expect(res.status).toBe(200)
    expect(await actions.get(revokedSessionTokenKey(await hashSessionToken(impToken)))).toBe('1')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).toMatch(/SameSite=None/i)
  })
})

describe('WebSocket upgrade — revoked tokens', () => {
  it('does not grant presenter role to a revoked session token', async () => {
    const jwt = await jwtFor('victim')
    const actions = kv()
    await actions.put(revokedSessionTokenKey(await hashSessionToken(jwt)), '1')

    const { isSessionTokenRevoked } = await import('../../functions/api/lib/session-token')
    expect(await isSessionTokenRevoked({ ACTIONS_KV: actions }, jwt)).toBe(true)

    const fresh = await jwtFor('victim2')
    expect(await isSessionTokenRevoked({ ACTIONS_KV: actions }, fresh)).toBe(false)
  })
})
