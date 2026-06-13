// PEN5-E1 (ADR-0050 §5) — EMBED read-plane rate limit.
//
// Closes the Pentest #5 carry-forward (SEC_PEN5_01_RESULTS.md PEN5-E1): the
// public widget read plane must be throttled per widget id + origin, return
// `429 + Retry-After` over budget, and keep tenants isolated — a flood on one
// widget token must not consume another widget's budget. Handshake (participant
// token allocation) carries its own, tighter bucket.
//
// We exercise the live `widgetTokenMiddleware` through `createApp()` with a
// focused in-memory D1 + KV. The KV counter is pre-seeded to the cap so the
// assertions are deterministic and fast (no 120-request floods).

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signEmbedToken, normaliseOrigin } from '../../functions/api/lib/embed-token'
import type { Env } from '../../functions/api/types'

const EMBED_SECRET = 'embed-widget-secret-at-least-32-bytes!!'
const HOST = 'user_host_1'
const ORIGIN = 'https://customer.example.com'

type Row = Record<string, unknown>

// ── Minimal D1 fake covering exactly the read-plane queries ─────────────────
class RlD1 {
  sessions = new Map<string, Row>()
  embedWidgets = new Map<string, Row>()
  questions: Row[] = []
  votes: Row[] = []

  prepare(sql: string) {
    return new Stmt(this, sql.replace(/\s+/g, ' ').trim())
  }
}

class Stmt {
  private args: unknown[] = []
  constructor(private db: RlD1, private sql: string) {}
  bind(...args: unknown[]) {
    this.args = args
    return this
  }
  async first<T = unknown>(): Promise<T | null> {
    const s = this.sql
    if (s.includes('FROM embed_widgets WHERE id = ?1')) {
      return (this.db.embedWidgets.get(this.args[0] as string) ?? null) as T | null
    }
    if (s.includes('FROM sessions WHERE id = ?1 OR code = ?1')) {
      const k = this.args[0]
      const row = [...this.db.sessions.values()].find((r) => r.id === k || r.code === k)
      return (row ?? null) as T | null
    }
    if (s.includes('FROM sessions WHERE id = ?1')) {
      return (this.db.sessions.get(this.args[0] as string) ?? null) as T | null
    }
    if (s.includes('FROM questions WHERE session_id = ?1 ORDER BY position')) {
      const row = this.db.questions
        .filter((q) => q.session_id === this.args[0])
        .sort((a, b) => (a.position as number) - (b.position as number))[0]
      return (row ?? null) as T | null
    }
    if (s.includes('COUNT(*) AS n FROM votes WHERE session_id = ?1')) {
      return { n: this.db.votes.filter((v) => v.session_id === this.args[0]).length } as T
    }
    return null
  }
  async all<T = unknown>(): Promise<{ results: T[] }> {
    return { results: [] as T[] }
  }
}

// ── In-memory KV honouring the get(key,'json') / put(key,str,opts) contract ──
class FakeKV {
  store = new Map<string, string>()
  async get(key: string, type?: string) {
    const v = this.store.get(key)
    if (v === undefined) return null
    return type === 'json' ? JSON.parse(v) : v
  }
  async put(key: string, value: string) {
    this.store.set(key, value)
  }
  async delete(key: string) {
    this.store.delete(key)
  }
}

function seedSession(db: RlD1, sid: string, code: string) {
  db.sessions.set(sid, { id: sid, code, title: 'Embed Poll', status: 'live', anonymity: 'full' })
}

function seedWidget(db: RlD1, wid: string, sid: string, code: string) {
  db.embedWidgets.set(wid, {
    id: wid,
    team_id: HOST,
    session_id: sid,
    session_code: code,
    allowed_origins: JSON.stringify([ORIGIN]),
    scope: 'read',
    created_by: HOST,
    created_at: Date.now(),
    revoked_at: null,
  })
}

function makeEnv(db: RlD1, kv: FakeKV): Env {
  return {
    ENV: 'dev',
    EMBED_WIDGET_SECRET: EMBED_SECRET,
    DB: db as unknown as D1Database,
    ACTIONS_KV: kv as unknown as KVNamespace,
  } as unknown as Env
}

async function tokenFor(wid: string, sid: string, code: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const { token } = await signEmbedToken(EMBED_SECRET, {
    wid,
    sid,
    code,
    tid: HOST,
    ao: [ORIGIN],
    ttl: 3600,
    now,
  })
  return token
}

const call = (env: Env, path: string, token: string) =>
  createApp().fetch(
    new Request(`http://local/api/embed/v1/${path}`, {
      method: path === 'handshake' ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: `Bearer ${token}` },
    }),
    env,
  )

/** Seed the fixed-window KV counter for a (prefix, wid, origin) bucket at the cap. */
function seedAtCap(kv: FakeKV, prefix: string, wid: string, count: number) {
  const id = `${wid}:${normaliseOrigin(ORIGIN)}`
  kv.store.set(`rl:${prefix}:${id}`, JSON.stringify({ count, resetAt: Date.now() + 60_000 }))
}

describe('EMBED read-plane rate limit (PEN5-E1)', () => {
  it('returns 429 + Retry-After once the per-widget read budget is exhausted', async () => {
    const db = new RlD1()
    const kv = new FakeKV()
    seedSession(db, 'sess_a', 'AAA111')
    seedWidget(db, 'wid_a', 'sess_a', 'AAA111')
    const token = await tokenFor('wid_a', 'sess_a', 'AAA111')

    seedAtCap(kv, 'embed-read', 'wid_a', 120) // at the read cap

    const res = await call(makeEnv(db, kv), 'sessions/sess_a/state', token)
    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThan(0)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')
  })

  it('isolates tenants — flooding one widget does not throttle another', async () => {
    const db = new RlD1()
    const kv = new FakeKV()
    seedSession(db, 'sess_a', 'AAA111')
    seedSession(db, 'sess_b', 'BBB222')
    seedWidget(db, 'wid_a', 'sess_a', 'AAA111')
    seedWidget(db, 'wid_b', 'sess_b', 'BBB222')
    const tokenA = await tokenFor('wid_a', 'sess_a', 'AAA111')
    const tokenB = await tokenFor('wid_b', 'sess_b', 'BBB222')

    seedAtCap(kv, 'embed-read', 'wid_a', 120) // widget A is flooded out

    const a = await call(makeEnv(db, kv), 'sessions/sess_a/state', tokenA)
    expect(a.status).toBe(429)

    // Widget B has its own bucket and is unaffected.
    const b = await call(makeEnv(db, kv), 'sessions/sess_b/state', tokenB)
    expect(b.status).toBe(200)
  })

  it('handshake uses a separate, tighter bucket from the read GETs', async () => {
    const db = new RlD1()
    const kv = new FakeKV()
    seedSession(db, 'sess_a', 'AAA111')
    seedWidget(db, 'wid_a', 'sess_a', 'AAA111')
    const token = await tokenFor('wid_a', 'sess_a', 'AAA111')

    // Saturate ONLY the handshake bucket.
    seedAtCap(kv, 'embed-hs', 'wid_a', 30)

    const hs = await call(makeEnv(db, kv), 'handshake', token)
    expect(hs.status).toBe(429)

    // The read bucket is independent and still serves.
    const state = await call(makeEnv(db, kv), 'sessions/sess_a/state', token)
    expect(state.status).toBe(200)
  })

  it('emits standard rate-limit headers under budget', async () => {
    const db = new RlD1()
    const kv = new FakeKV()
    seedSession(db, 'sess_a', 'AAA111')
    seedWidget(db, 'wid_a', 'sess_a', 'AAA111')
    const token = await tokenFor('wid_a', 'sess_a', 'AAA111')

    const res = await call(makeEnv(db, kv), 'sessions/sess_a/state', token)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-ratelimit-limit')).toBe('120')
    expect(Number(res.headers.get('x-ratelimit-remaining'))).toBeGreaterThanOrEqual(0)
  })
})
