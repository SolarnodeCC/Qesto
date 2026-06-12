// EMBED-WIDGET-API-01 (ADR-0050) — mint plane plan-gating + revoke, and the
// aggregate-only invariant of the public read plane.
//
// Uses a FOCUSED in-memory D1 fake covering exactly the embed surface's queries
// (the shared D1Mock is pattern-matched literally and the next backend wave will
// also edit it; a scoped fake keeps these tests robust and collision-free).

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const EMBED_SECRET = 'embed-widget-secret-at-least-32-bytes!!'
const HOST = 'user_host_1'
const ORIGIN = 'https://customer.example.com'

// ── A purpose-built D1 fake for the embed queries ───────────────────────────

type Row = Record<string, unknown>

class EmbedD1 {
  users = new Map<string, Row>()
  sessions = new Map<string, Row>()
  questions: Row[] = []
  votes: Row[] = []
  embedWidgets = new Map<string, Row>()
  userRoles: Row[] = []

  prepare(sql: string) {
    return new Stmt(this, sql.replace(/\s+/g, ' ').trim())
  }
  async batch(stmts: Stmt[]) {
    const out = []
    for (const s of stmts) out.push(await s.run())
    return out
  }
}

class Stmt {
  private args: unknown[] = []
  constructor(private db: EmbedD1, private sql: string) {}
  bind(...args: unknown[]) {
    this.args = args
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    const s = this.sql
    if (s.startsWith('SELECT plan FROM users')) {
      const u = this.db.users.get(this.args[0] as string)
      return (u ? { plan: u.plan } : null) as T | null
    }
    if (s.includes('FROM sessions WHERE id = ?1 AND owner_id = ?2')) {
      const row = this.db.sessions.get(this.args[0] as string)
      return (row && row.owner_id === this.args[1] ? row : null) as T | null
    }
    if (s.includes('FROM sessions WHERE code = ?1 AND owner_id = ?2')) {
      const row = [...this.db.sessions.values()].find((r) => r.code === this.args[0] && r.owner_id === this.args[1])
      return (row ?? null) as T | null
    }
    if (s.includes('FROM sessions WHERE id = ?1 OR code = ?1')) {
      const k = this.args[0]
      const row = [...this.db.sessions.values()].find((r) => r.id === k || r.code === k)
      return (row ? { id: row.id, code: row.code, title: row.title, status: row.status, anonymity: row.anonymity } : null) as T | null
    }
    if (s.includes('FROM embed_widgets WHERE id = ?1 AND team_id = ?2')) {
      const row = this.db.embedWidgets.get(this.args[0] as string)
      return (row && row.team_id === this.args[1] ? row : null) as T | null
    }
    if (s.includes('FROM embed_widgets WHERE id = ?1')) {
      return (this.db.embedWidgets.get(this.args[0] as string) ?? null) as T | null
    }
    if (s.includes('FROM questions WHERE session_id = ?1 ORDER BY position')) {
      const row = this.db.questions
        .filter((q) => q.session_id === this.args[0])
        .sort((a, b) => (a.position as number) - (b.position as number))[0]
      return (row ?? null) as T | null
    }
    if (s.includes('COUNT(*) AS n FROM votes WHERE session_id = ?1')) {
      const n = this.db.votes.filter((v) => v.session_id === this.args[0]).length
      return { n } as T
    }
    return null
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const s = this.sql
    if (s.includes('FROM user_roles WHERE user_id')) {
      return { results: this.db.userRoles.filter((r) => r.user_id === this.args[0]) as T[] }
    }
    if (s.includes('FROM embed_widgets WHERE team_id = ?1')) {
      const rows = [...this.db.embedWidgets.values()].filter((r) => r.team_id === this.args[0])
      return { results: rows as T[] }
    }
    if (s.includes('SELECT option_id, COUNT(*)')) {
      const sid = this.args[0]
      const qid = this.args[1]
      const counts = new Map<string, number>()
      for (const v of this.db.votes) {
        if (v.session_id === sid && v.question_id === qid) {
          counts.set(v.option_id as string, (counts.get(v.option_id as string) ?? 0) + 1)
        }
      }
      return { results: [...counts.entries()].map(([option_id, count]) => ({ option_id, count })) as T[] }
    }
    return { results: [] as T[] }
  }

  async run() {
    const s = this.sql
    if (s.startsWith('INSERT INTO embed_widgets')) {
      const [id, team_id, session_id, session_code, allowed_origins, created_by, created_at] = this.args
      this.db.embedWidgets.set(id as string, {
        id,
        team_id,
        session_id,
        session_code,
        allowed_origins,
        scope: 'read',
        created_by,
        created_at,
        revoked_at: null,
      })
      return { meta: { changes: 1 } }
    }
    if (s.startsWith('UPDATE embed_widgets SET revoked_at')) {
      const [id, team_id, now] = this.args
      const row = this.db.embedWidgets.get(id as string)
      if (row && row.team_id === team_id && row.revoked_at === null) {
        row.revoked_at = now
        return { meta: { changes: 1 } }
      }
      return { meta: { changes: 0 } }
    }
    return { meta: { changes: 0 } }
  }
}

function makeEnv(db: EmbedD1): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    EMBED_WIDGET_SECRET: EMBED_SECRET,
    DB: db as unknown as D1Database,
  } as unknown as Env
}

async function cookie(userId = HOST): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
}

function seedHost(db: EmbedD1, plan: 'free' | 'starter' | 'team') {
  db.users.set(HOST, { id: HOST, email: `${HOST}@example.com`, plan })
  db.sessions.set('sess_1', {
    id: 'sess_1',
    owner_id: HOST,
    code: 'ABC123',
    title: 'Embed Poll',
    status: 'live',
    anonymity: 'full',
  })
}

const mint = (env: Env, path: string, method: string, c: string | null, body?: unknown) =>
  createApp().fetch(
    new Request(`http://local/api/embed/${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: 'http://local', ...(c ? { cookie: c } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  )

const widgetApi = (env: Env, path: string, method: string, token: string | null, origin = ORIGIN) =>
  createApp().fetch(
    new Request(`http://local/api/embed/v1/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        origin,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }),
    env,
  )

// ── Mint plane: plan gating ─────────────────────────────────────────────────

describe('POST /api/embed/widgets — plan gating (embedWidgets, Team only)', () => {
  it('denies the free plan with feature_not_available', async () => {
    const db = new EmbedD1()
    seedHost(db, 'free')
    const res = await mint(makeEnv(db), 'widgets', 'POST', await cookie(), {
      session_id: 'sess_1',
      allowed_origins: [ORIGIN],
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { details: { feature: string } } }
    expect(body.error.details.feature).toBe('embedWidgets')
  })

  it('denies the starter plan', async () => {
    const db = new EmbedD1()
    seedHost(db, 'starter')
    const res = await mint(makeEnv(db), 'widgets', 'POST', await cookie(), {
      session_id: 'sess_1',
      allowed_origins: [ORIGIN],
    })
    expect(res.status).toBe(403)
  })

  it('allows the team plan to create a widget config', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const res = await mint(makeEnv(db), 'widgets', 'POST', await cookie(), {
      session_id: 'sess_1',
      allowed_origins: [ORIGIN],
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { widget: { id: string; allowed_origins: string[] } } }
    expect(body.data.widget.allowed_origins).toEqual([ORIGIN])
    expect(db.embedWidgets.size).toBe(1)
  })

  it('requires authentication', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const res = await mint(makeEnv(db), 'widgets', 'POST', null, { session_id: 'sess_1', allowed_origins: [ORIGIN] })
    expect(res.status).toBe(401)
  })
})

// ── Mint plane: token + revoke ──────────────────────────────────────────────

async function createWidget(db: EmbedD1): Promise<string> {
  const res = await mint(makeEnv(db), 'widgets', 'POST', await cookie(), {
    session_id: 'sess_1',
    allowed_origins: [ORIGIN],
  })
  const body = (await res.json()) as { data: { widget: { id: string } } }
  return body.data.widget.id
}

describe('POST /api/embed/widgets/:wid/token — mint + subset enforcement', () => {
  it('mints a token for a registered origin subset', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const wid = await createWidget(db)
    const res = await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { token: string; exp: number } }
    expect(body.data.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(body.data.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects minting for an origin not in the widget allowlist', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const wid = await createWidget(db)
    const res = await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), {
      origins: ['https://attacker.example.com'],
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('origin_not_registered')
  })
})

describe('DELETE /api/embed/widgets/:wid — revoke', () => {
  it('revokes a widget and a subsequent read-plane call is rejected', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const wid = await createWidget(db)
    const tokenRes = await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })
    const { data } = (await tokenRes.json()) as { data: { token: string } }

    // Before revoke: read plane works.
    const ok = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', data.token)
    expect(ok.status).toBe(200)

    // Revoke.
    const del = await mint(makeEnv(db), `widgets/${wid}`, 'DELETE', await cookie())
    expect(del.status).toBe(200)
    expect(db.embedWidgets.get(wid)?.revoked_at).not.toBeNull()

    // After revoke: same token is killed even though exp is still valid.
    const after = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', data.token)
    expect(after.status).toBe(401)
    const body = (await after.json()) as { error: { code: string } }
    expect(body.error.code).toBe('token_revoked')
  })
})

// ── Public read plane: token + origin enforcement + anonymity ───────────────

describe('widget read plane — token + origin enforcement', () => {
  async function tokenFor(db: EmbedD1): Promise<string> {
    seedHost(db, 'team')
    const wid = await createWidget(db)
    const res = await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })
    return ((await res.json()) as { data: { token: string } }).data.token
  }

  it('rejects a request with no token (401)', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const res = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', null)
    expect(res.status).toBe(401)
  })

  it('rejects a request from an origin outside the token allowlist (403)', async () => {
    const db = new EmbedD1()
    const token = await tokenFor(db)
    const res = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', token, 'https://attacker.example.com')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('origin_not_allowed')
  })

  it('reflects the allowlisted origin in CORS (never *) with Vary: Origin', async () => {
    const db = new EmbedD1()
    const token = await tokenFor(db)
    const res = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', token)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('vary')).toContain('Origin')
  })

  it('rejects a path param that does not match the token session (404)', async () => {
    const db = new EmbedD1()
    const token = await tokenFor(db)
    db.sessions.set('sess_other', { id: 'sess_other', owner_id: HOST, code: 'ZZZ999', title: 'x', status: 'live', anonymity: 'full' })
    const res = await widgetApi(makeEnv(db), 'sessions/sess_other/state', 'GET', token)
    expect(res.status).toBe(404)
  })
})

describe('widget read plane — AGGREGATE-ONLY anonymity invariant (Pentest #5)', () => {
  function seedVotes(db: EmbedD1) {
    db.questions.push({ id: 'q1', session_id: 'sess_1', position: 0, kind: 'poll', prompt: 'Pick one', options_json: JSON.stringify([{ id: 'opt_a', label: 'A' }, { id: 'opt_b', label: 'B' }]) })
    // Per-voter rows exist in the DB, each carrying a voter_id…
    db.votes.push({ id: 'v1', session_id: 'sess_1', question_id: 'q1', voter_id: 'voter_secret_1', option_id: 'opt_a', submitted_at: 1 })
    db.votes.push({ id: 'v2', session_id: 'sess_1', question_id: 'q1', voter_id: 'voter_secret_2', option_id: 'opt_a', submitted_at: 2 })
    db.votes.push({ id: 'v3', session_id: 'sess_1', question_id: 'q1', voter_id: 'voter_secret_3', option_id: 'opt_b', submitted_at: 3 })
  }

  it('returns ONLY counts_by_option + total — never a voter identity', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    seedVotes(db)
    const wid = await createWidget(db)
    const t = ((await (await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })).json()) as { data: { token: string } }).data.token

    const res = await widgetApi(makeEnv(db), 'sessions/sess_1/results', 'GET', t)
    expect(res.status).toBe(200)
    const raw = await res.text()

    // Aggregate shape is correct.
    const body = JSON.parse(raw) as { data: { question_id: string; counts_by_option: Record<string, number>; total: number } }
    expect(body.data.question_id).toBe('q1')
    expect(body.data.counts_by_option).toEqual({ opt_a: 2, opt_b: 1 })
    expect(body.data.total).toBe(3)

    // STRUCTURAL anonymity: not a single per-participant identifier leaks, even
    // though the underlying votes rows carry voter_id values.
    expect(raw).not.toContain('voter_id')
    expect(raw).not.toContain('voter_secret_1')
    expect(raw).not.toContain('voter_secret_2')
    expect(raw).not.toContain('voter_secret_3')
    expect(raw.toLowerCase()).not.toContain('voter_hash')
    expect(raw.toLowerCase()).not.toContain('fingerprint')
  })

  it('state endpoint surfaces an aggregate response_count, no voter rows', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    seedVotes(db)
    const wid = await createWidget(db)
    const t = ((await (await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })).json()) as { data: { token: string } }).data.token

    const res = await widgetApi(makeEnv(db), 'sessions/sess_1/state', 'GET', t)
    const raw = await res.text()
    const body = JSON.parse(raw) as { data: { status: string; response_count: number; active_question: { id: string } } }
    expect(body.data.status).toBe('live')
    expect(body.data.response_count).toBe(3)
    expect(body.data.active_question.id).toBe('q1')
    expect(raw).not.toContain('voter_secret_1')
  })
})

describe('POST /api/embed/v1/handshake — anonymous participant token', () => {
  it('returns an anonymous participant token + session display config', async () => {
    const db = new EmbedD1()
    seedHost(db, 'team')
    const wid = await createWidget(db)
    const t = ((await (await mint(makeEnv(db), `widgets/${wid}/token`, 'POST', await cookie(), { origins: [ORIGIN] })).json()) as { data: { token: string } }).data.token

    const res = await createApp().fetch(
      new Request('http://local/api/embed/v1/handshake', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: `Bearer ${t}` },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const raw = await res.text()
    const body = JSON.parse(raw) as { data: { participant_token: string; session: { code: string } } }
    // Anonymous by construction: opaque id, never the host user id.
    expect(body.data.participant_token).toMatch(/^ept_[0-9a-f]{32}$/)
    expect(body.data.participant_token).not.toContain(HOST)
    expect(body.data.session.code).toBe('ABC123')
    expect(raw).not.toContain(HOST)
  })
})
