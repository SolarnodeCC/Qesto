/**
 * Integration: embed public read plane (mint → token → aggregate state).
 * Complements tests/unit/embed-routes.test.ts with the integration test lane label.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { signEmbedToken } from '../../functions/api/lib/embed-token'
import type { Env } from '../../functions/api/types'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const EMBED_SECRET = 'embed-widget-secret-at-least-32-bytes!!'
const HOST = 'embed_host_1'
const ORIGIN = 'https://customer.example.com'

type Row = Record<string, unknown>

class EmbedD1 {
  users = new Map<string, Row>()
  sessions = new Map<string, Row>()
  embedWidgets = new Map<string, Row>()

  prepare(sql: string) {
    return new Stmt(this, sql.replace(/\s+/g, ' ').trim())
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
    if (s.includes('FROM sessions WHERE id = ?1 OR code = ?1')) {
      const k = this.args[0]
      const row = [...this.db.sessions.values()].find((r) => r.id === k || r.code === k)
      return (row
        ? { id: row.id, code: row.code, title: row.title, status: row.status, anonymity: row.anonymity }
        : null) as T | null
    }
    if (s.includes('FROM embed_widgets WHERE id = ?1')) {
      return (this.db.embedWidgets.get(this.args[0] as string) ?? null) as T | null
    }
    if (s.includes('FROM questions WHERE session_id = ?1 ORDER BY position')) {
      return null
    }
    if (s.includes('COUNT(*) AS n FROM votes WHERE session_id = ?1')) {
      return { n: 0 } as T
    }
    return null
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    return { results: [] as T[] }
  }

  async run() {
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

describe('embed public read plane (integration)', () => {
  it('returns aggregate session state for a valid token and origin', async () => {
    const db = new EmbedD1()
    db.users.set(HOST, { id: HOST, plan: 'team' })
    db.sessions.set('sess_live', {
      id: 'sess_live',
      owner_id: HOST,
      code: 'LIVE01',
      title: 'Live embed session',
      status: 'live',
      anonymity: 'full',
    })
    db.embedWidgets.set('wid_1', {
      id: 'wid_1',
      team_id: 'team_1',
      session_id: 'sess_live',
      session_code: 'LIVE01',
      allowed_origins: JSON.stringify([ORIGIN]),
      created_by: HOST,
      created_at: Date.now(),
      revoked_at: null,
    })

    const { token } = await signEmbedToken(EMBED_SECRET, {
      wid: 'wid_1',
      sid: 'sess_live',
      code: 'LIVE01',
      tid: HOST,
      ao: [ORIGIN],
    })

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/embed/v1/sessions/sess_live/state', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}`, origin: ORIGIN },
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { status: string; response_count: number }
    }
    expect(body.ok).toBe(true)
    expect(body.data.status).toBe('live')
    expect(body.data.response_count).toBe(0)
  })

  it('rejects unauthenticated widget mint on free plan', async () => {
    const db = new EmbedD1()
    db.users.set(HOST, { id: HOST, plan: 'free' })
    db.sessions.set('sess_1', { id: 'sess_1', owner_id: HOST, code: 'ABC123', status: 'live' })

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/embed/widgets', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await cookie() },
        body: JSON.stringify({ session_id: 'sess_1', allowed_origins: [ORIGIN] }),
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { details: { feature: string } } }
    expect(body.error.details.feature).toBe('embedWidgets')
  })
})
