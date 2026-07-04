import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock, sessionsKv: KVMock, teamsKv = new KVMock()): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    SESSIONS_KV: sessionsKv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
    METRICS_AE: {
      writeDataPoint: () => {}, // mock Analytics Engine
    } as unknown as AnalyticsEngineDataset,
    AI: {
      run: async () => ({
        success: true,
        result: { response: 'mocked' },
      }),
    } as unknown as Ai,
    DECISIONS_VECTORIZE: undefined as unknown as VectorizeIndex,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
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

  it('gates CSV export on resultsExport entitlement: free blocked, starter/team allowed (EXPORT-RICH-01-A)', async () => {
    // CSV export is gated on resultsExport feature: Free=false, Starter=true, Team=true.
    // JSON/HTML/PDF exports remain team-plan only.
    addUser(db, 'free_export', 'free')
    addUser(db, 'starter_export', 'starter')
    addUser(db, 'team_export', 'team')
    const freeCookie = await cookieFor('free_export', 'free_export@example.com')
    const starterCookie = await cookieFor('starter_export', 'starter_export@example.com')
    const teamCookie = await cookieFor('team_export', 'team_export@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter export')
    const teamSessionId = await createSession(app, env, teamCookie, 'team export')

    // free → 403 on CSV (resultsExport=false) and JSON (plan!=team)
    const freeCsvRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.csv`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeCsvRes.status).toBe(403)

    const freeJsonRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.json`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeJsonRes.status).toBe(403)

    // starter → 403 on JSON (plan!=team), but allowed on CSV by resultsExport=true
    // CSV gets 409 session_not_closed since session is draft
    const starterCsvRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.csv`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterCsvRes.status).toBe(409) // allowed by resultsExport; blocked by session status

    const starterJsonRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.json`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterJsonRes.status).toBe(403) // blocked by plan check

    // team → allowed on both (session must be closed; draft returns 409)
    const teamCsvRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.csv`, { headers: { cookie: teamCookie } }),
      env,
    )
    // Draft session → 409 session_not_closed (plan gate passes; status gate blocks)
    expect(teamCsvRes.status).toBe(409)

    const teamJsonRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.json`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamJsonRes.status).toBe(409)
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

  it('gates CSV export on resultsExport (Free blocked, Starter/Team allowed)', async () => {
    addUser(db, 'free_csv', 'free')
    addUser(db, 'starter_csv', 'starter')
    addUser(db, 'team_csv', 'team')
    const freeCookie = await cookieFor('free_csv', 'free_csv@example.com')
    const starterCookie = await cookieFor('starter_csv', 'starter_csv@example.com')
    const teamCookie = await cookieFor('team_csv', 'team_csv@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free csv export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter csv export')
    const teamSessionId = await createSession(app, env, teamCookie, 'team csv export')

    // Free user blocked by resultsExport=false entitlement
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.csv`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)
    const freeBody = (await freeRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(freeBody.error.code).toBe('feature_not_available')
    expect(freeBody.error.details.feature).toBe('resultsExport')

    // Starter user allowed by resultsExport=true entitlement
    // (session is draft, so returns 409 session_not_closed, not 403)
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.csv`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(409)
    const starterBody = (await starterRes.json()) as { error: { code: string } }
    expect(starterBody.error.code).toBe('session_not_closed')

    // Team user allowed by resultsExport=true entitlement
    // (session is draft, so returns 409 session_not_closed, not 403)
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.csv`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(409)
    const teamBody = (await teamRes.json()) as { error: { code: string } }
    expect(teamBody.error.code).toBe('session_not_closed')
  })

  it('gates JSON export on Team plan only (Free/Starter blocked)', async () => {
    addUser(db, 'free_json', 'free')
    addUser(db, 'starter_json', 'starter')
    addUser(db, 'team_json', 'team')
    const freeCookie = await cookieFor('free_json', 'free_json@example.com')
    const starterCookie = await cookieFor('starter_json', 'starter_json@example.com')
    const teamCookie = await cookieFor('team_json', 'team_json@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free json export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter json export')
    const teamSessionId = await createSession(app, env, teamCookie, 'team json export')

    // Free user blocked by plan check (plan !== 'team')
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.json`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)
    const freeBody = (await freeRes.json()) as { error: { code: string } }
    expect(freeBody.error.code).toBe('upgrade_required')

    // Starter user blocked by plan check
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.json`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(403)
    const starterBody = (await starterRes.json()) as { error: { code: string } }
    expect(starterBody.error.code).toBe('upgrade_required')

    // Team user allowed by plan check
    // (session is draft, so returns 409 session_not_closed, not 403)
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.json`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(409)
    const teamBody = (await teamRes.json()) as { error: { code: string } }
    expect(teamBody.error.code).toBe('session_not_closed')
  })

  it('gates HTML export on Team plan only (Free/Starter blocked)', async () => {
    addUser(db, 'free_html', 'free')
    addUser(db, 'starter_html', 'starter')
    addUser(db, 'team_html', 'team')
    const freeCookie = await cookieFor('free_html', 'free_html@example.com')
    const starterCookie = await cookieFor('starter_html', 'starter_html@example.com')
    const teamCookie = await cookieFor('team_html', 'team_html@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free html export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter html export')
    const teamSessionId = await createSession(app, env, teamCookie, 'team html export')

    // Free user blocked by plan check (plan !== 'team')
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.html`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)

    // Starter user blocked by plan check
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.html`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(403)

    // Team user allowed by plan check
    // (session is draft, so returns 409 session_not_closed, not 403)
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.html`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(409)
  })

  it('gates PDF export on Team plan only (Free/Starter blocked)', async () => {
    addUser(db, 'free_pdf', 'free')
    addUser(db, 'starter_pdf', 'starter')
    addUser(db, 'team_pdf', 'team')
    const freeCookie = await cookieFor('free_pdf', 'free_pdf@example.com')
    const starterCookie = await cookieFor('starter_pdf', 'starter_pdf@example.com')
    const teamCookie = await cookieFor('team_pdf', 'team_pdf@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free pdf export')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter pdf export')
    const teamSessionId = await createSession(app, env, teamCookie, 'team pdf export')

    // Free user blocked by plan check (plan !== 'team')
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/export.pdf`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)

    // Starter user blocked by plan check
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/export.pdf`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(403)

    // Team user allowed by plan check
    // (session is draft, so returns 409 session_not_closed, not 403)
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/export.pdf`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(409)
  })

  it('gates GET /api/sessions/:id/insights on insightsAI (Free/Starter blocked, Team allowed)', async () => {
    addUser(db, 'free_insights', 'free')
    addUser(db, 'starter_insights', 'starter')
    addUser(db, 'team_insights', 'team')
    const freeCookie = await cookieFor('free_insights', 'free_insights@example.com')
    const starterCookie = await cookieFor('starter_insights', 'starter_insights@example.com')
    const teamCookie = await cookieFor('team_insights', 'team_insights@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free insights')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter insights')
    const teamSessionId = await createSession(app, env, teamCookie, 'team insights')

    // Free user blocked by insightsAI=false entitlement
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/insights`, { headers: { cookie: freeCookie } }),
      env,
    )
    expect(freeRes.status).toBe(403)
    const freeBody = (await freeRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(freeBody.error.code).toBe('feature_not_available')
    expect(freeBody.error.details.feature).toBe('insightsAI')

    // Starter user blocked by insightsAI=false entitlement
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/insights`, { headers: { cookie: starterCookie } }),
      env,
    )
    expect(starterRes.status).toBe(403)
    const starterBody = (await starterRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(starterBody.error.code).toBe('feature_not_available')
    expect(starterBody.error.details.feature).toBe('insightsAI')

    // Team user allowed by insightsAI=true entitlement
    // (session is draft, so returns 409 session_not_closed_for_insights, not 403)
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/insights`, { headers: { cookie: teamCookie } }),
      env,
    )
    expect(teamRes.status).toBe(409)
  })

  it('gates POST /api/sessions/:id/insights/analyze on insightsAI (Free/Starter blocked, Team allowed)', async () => {
    addUser(db, 'free_analyze', 'free')
    addUser(db, 'starter_analyze', 'starter')
    addUser(db, 'team_analyze', 'team')
    const freeCookie = await cookieFor('free_analyze', 'free_analyze@example.com')
    const starterCookie = await cookieFor('starter_analyze', 'starter_analyze@example.com')
    const teamCookie = await cookieFor('team_analyze', 'team_analyze@example.com')

    const freeSessionId = await createSession(app, env, freeCookie, 'free analyze')
    const starterSessionId = await createSession(app, env, starterCookie, 'starter analyze')
    const teamSessionId = await createSession(app, env, teamCookie, 'team analyze')

    // Free user blocked by insightsAI=false entitlement
    const freeRes = await app.fetch(
      new Request(`http://local/api/sessions/${freeSessionId}/insights/analyze`, {
        method: 'POST',
        headers: { cookie: freeCookie },
      }),
      env,
    )
    expect(freeRes.status).toBe(403)
    const freeBody = (await freeRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(freeBody.error.code).toBe('feature_not_available')
    expect(freeBody.error.details.feature).toBe('insightsAI')

    // Starter user blocked by insightsAI=false entitlement
    const starterRes = await app.fetch(
      new Request(`http://local/api/sessions/${starterSessionId}/insights/analyze`, {
        method: 'POST',
        headers: { cookie: starterCookie },
      }),
      env,
    )
    expect(starterRes.status).toBe(403)
    const starterBody = (await starterRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(starterBody.error.code).toBe('feature_not_available')
    expect(starterBody.error.details.feature).toBe('insightsAI')

    // Team user passes the insightsAI gate; downstream may fail in the test env
    // (no real AI/Vectorize binding) — what matters is status is NOT 403 feature_not_available.
    const teamRes = await app.fetch(
      new Request(`http://local/api/sessions/${teamSessionId}/insights/analyze`, {
        method: 'POST',
        headers: { cookie: teamCookie },
      }),
      env,
    )
    expect(teamRes.status).not.toBe(403)
    if (teamRes.status === 403) {
      const body = (await teamRes.json()) as { error: { code: string } }
      expect(body.error.code).not.toBe('feature_not_available')
    }
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
