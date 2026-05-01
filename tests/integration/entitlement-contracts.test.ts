import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock, sessionsKv: KVMock, teamsKv = new KVMock()): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    SESSIONS_KV: sessionsKv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, SECRET, 3600)
  return `qesto_session=${token}`
}

function addUser(db: D1Mock, id: string, plan: 'free' | 'starter' | 'team') {
  db.users.set(id, {
    id,
    email: `${id}@example.com`,
    display_name: id,
    created_at: Date.now(),
    last_login_at: null,
    plan,
  })
}

async function createSession(app: ReturnType<typeof createApp>, env: Env, cookie: string, title: string) {
  const res = await app.fetch(
    new Request('http://local/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'idempotency-key': title },
      body: JSON.stringify({ title }),
    }),
    env,
  )
  expect(res.status).toBe(201)
  const body = (await res.json()) as { data: { session: { id: string } } }
  return body.data.session.id
}

describe('Sprint 20 entitlement contracts', () => {
  let db: D1Mock
  let sessionsKv: KVMock
  let teamsKv: KVMock
  let app: ReturnType<typeof createApp>
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    sessionsKv = new KVMock()
    teamsKv = new KVMock()
    app = createApp()
    env = makeEnv(db, sessionsKv, teamsKv)
  })

  it('denies results export on free and allows it on starter', async () => {
    addUser(db, 'free_export', 'free')
    addUser(db, 'starter_export', 'starter')
    const freeCookie = await cookieFor('free_export', 'free_export@example.com')
    const starterCookie = await cookieFor('starter_export', 'starter_export@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter export')

    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.csv`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)

    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.csv`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(200)
    expect(starterRes.headers.get('content-type')).toContain('text/csv')
  })

  it('denies ranking and consent question writes on free and allows ranking on starter', async () => {
    addUser(db, 'free_questions', 'free')
    addUser(db, 'starter_questions', 'starter')
    const freeCookie = await cookieFor('free_questions', 'free_questions@example.com')
    const starterCookie = await cookieFor('starter_questions', 'starter_questions@example.com')
    const freeSessionId = await createSession(app, env, freeCookie, 'free questions')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter questions')

    const rankingRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: freeCookie },
        body: JSON.stringify({ kind: 'ranking', prompt: 'Rank these', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] }),
      }),
      env,
    )
    expect(rankingRes.status).toBe(403)

    const consentRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: freeCookie },
        body: JSON.stringify({ kind: 'consent', prompt: 'Proceed?' }),
      }),
      env,
    )
    expect(consentRes.status).toBe(403)

    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: starterCookie },
        body: JSON.stringify({ kind: 'ranking', prompt: 'Rank these', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] }),
      }),
      env,
    )
    expect(starterRes.status).toBe(201)
  })

  it('gates SAML configuration to team plan', async () => {
    addUser(db, 'starter_saml', 'starter')
    addUser(db, 'team_saml', 'team')
    const starterCookie = await cookieFor('starter_saml', 'starter_saml@example.com')
    const teamCookie = await cookieFor('team_saml', 'team_saml@example.com')

    const starterTeam = await createTeam(starterCookie, 'Starter SAML')
    const teamTeam = await createTeam(teamCookie, 'Team SAML')

    const samlConfig = {
      idpEntityId: 'urn:test:idp',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpCertificate: '-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----',
    }

    const starterRes = await app.fetch(
      new Request(`http://local/api/teams/${starterTeam}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: starterCookie },
        body: JSON.stringify({ samlConfig }),
      }),
      env,
    )
    expect(starterRes.status).toBe(403)

    const teamRes = await app.fetch(
      new Request(`http://local/api/teams/${teamTeam}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: teamCookie },
        body: JSON.stringify({ samlConfig }),
      }),
      env,
    )
    expect(teamRes.status).toBe(200)
  })

  it('enforces team member cap on invites', async () => {
    addUser(db, 'starter_members', 'starter')
    const cookie = await cookieFor('starter_members', 'starter_members@example.com')
    const teamId = await createTeam(cookie, 'Starter Members')
    const raw = await teamsKv.get(`team:${teamId}`)
    const team = JSON.parse(raw as string)
    team.members.push(
      { userId: 'member_1', email: 'member_1@example.com', role: 'member', joinedAt: Date.now() },
      { userId: 'member_2', email: 'member_2@example.com', role: 'member', joinedAt: Date.now() },
    )
    await teamsKv.put(`team:${teamId}`, JSON.stringify(team))

    const res = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ email: 'member_3@example.com', role: 'member' }),
      }),
      env,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string; details: { limit: number } } }
    expect(body.error.code).toBe('limit_exceeded')
    expect(body.error.details.limit).toBe(3)
  })

  it('applies monthly session quota to duplicate creation', async () => {
    addUser(db, 'free_duplicate', 'free')
    const cookie = await cookieFor('free_duplicate', 'free_duplicate@example.com')
    const firstSessionId = await createSession(app, env, cookie, 'free duplicate 1')
    await createSession(app, env, cookie, 'free duplicate 2')
    await createSession(app, env, cookie, 'free duplicate 3')
    await createSession(app, env, cookie, 'free duplicate 4')
    await createSession(app, env, cookie, 'free duplicate 5')

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${firstSessionId}/duplicate`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('quota_exceeded')
  })

  it('gates precomputed insights themes to team plan', async () => {
    addUser(db, 'free_themes', 'free')
    addUser(db, 'team_themes', 'team')
    const freeCookie = await cookieFor('free_themes', 'free_themes@example.com')
    const teamCookie = await cookieFor('team_themes', 'team_themes@example.com')
    const freeSessionId = await createSession(app, env, freeCookie, 'free themes')
    const teamSessionId = await createSession(app, env, teamCookie, 'team themes')
    db.sessions.get(freeSessionId)!.status = 'closed'
    db.sessions.get(teamSessionId)!.status = 'closed'
    db.insightsDaily.set('themes_team', {
      id: 'themes_team',
      session_id: teamSessionId,
      day: '2026-05-01',
      themes_json: JSON.stringify([{ label: 'Alignment', count: 3 }]),
      confidence: 0.92,
      n_votes: 12,
      computed_at: Date.now(),
    })

    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/insights/themes`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)

    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/insights/themes`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(200)
    const body = (await teamRes.json()) as { data: { themes: Array<{ label: string; count: number }> } }
    expect(body.data.themes[0]).toEqual({ label: 'Alignment', count: 3 })
  })

  it('uses the shared insightsAI entitlement for legacy AI insights analysis', async () => {
    addUser(db, 'starter_legacy_insights', 'starter')
    const cookie = await cookieFor('starter_legacy_insights', 'starter_legacy_insights@example.com')
    const sessionId = await createSession(app, env, cookie, 'starter legacy insights')

    const res = await app.fetch(
      new Request(`http://local/api/sessions/${sessionId}/insights/analyze`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string; details: { feature: string } } }
    expect(body.error.code).toBe('feature_not_available')
    expect(body.error.details.feature).toBe('insightsAI')
  })

  async function createTeam(cookie: string, name: string) {
    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name }),
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { team: { id: string } } }
    return body.data.team.id
  }
})
